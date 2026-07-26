-- Qelly Intelligence Scope A - Decision Provenance Graph persistence
BEGIN;

CREATE TABLE IF NOT EXISTS qelly_evidence_graphs (
  graph_id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES qelly_users(user_id),
  tenant_id text NOT NULL REFERENCES qelly_organizations(organization_id),
  workspace_id text NOT NULL REFERENCES qelly_workspaces(workspace_id),
  title text NOT NULL,
  canonical_id text NOT NULL,
  status text NOT NULL CHECK (status IN ('active','superseded','reviewed','closed')),
  summary_mode text NOT NULL,
  truth_boundary text NOT NULL,
  revision integer NOT NULL DEFAULT 1 CHECK (revision > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS qelly_evidence_nodes (
  node_id text PRIMARY KEY,
  graph_id text NOT NULL REFERENCES qelly_evidence_graphs(graph_id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES qelly_users(user_id),
  tenant_id text NOT NULL REFERENCES qelly_organizations(organization_id),
  workspace_id text NOT NULL REFERENCES qelly_workspaces(workspace_id),
  node_type text NOT NULL,
  label text NOT NULL,
  classification text NOT NULL CHECK (classification IN ('public','workspace','restricted')),
  data_json jsonb NOT NULL,
  revision integer NOT NULL DEFAULT 1 CHECK (revision > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS qelly_evidence_edges (
  edge_id text PRIMARY KEY,
  graph_id text NOT NULL REFERENCES qelly_evidence_graphs(graph_id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES qelly_users(user_id),
  tenant_id text NOT NULL REFERENCES qelly_organizations(organization_id),
  workspace_id text NOT NULL REFERENCES qelly_workspaces(workspace_id),
  edge_type text NOT NULL,
  from_node_id text NOT NULL REFERENCES qelly_evidence_nodes(node_id) ON DELETE CASCADE,
  to_node_id text NOT NULL REFERENCES qelly_evidence_nodes(node_id) ON DELETE CASCADE,
  evidence_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT qelly_evidence_edge_no_self_loop CHECK (from_node_id <> to_node_id)
);

CREATE TABLE IF NOT EXISTS qelly_evidence_exports (
  export_id text PRIMARY KEY,
  graph_id text NOT NULL REFERENCES qelly_evidence_graphs(graph_id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES qelly_users(user_id),
  tenant_id text NOT NULL REFERENCES qelly_organizations(organization_id),
  workspace_id text NOT NULL REFERENCES qelly_workspaces(workspace_id),
  sha256 char(64) NOT NULL,
  exported_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS qelly_evidence_graph_scope_idx ON qelly_evidence_graphs(tenant_id,workspace_id,updated_at DESC);
CREATE INDEX IF NOT EXISTS qelly_evidence_node_scope_idx ON qelly_evidence_nodes(tenant_id,workspace_id,graph_id,node_type);
CREATE INDEX IF NOT EXISTS qelly_evidence_edge_scope_idx ON qelly_evidence_edges(tenant_id,workspace_id,graph_id,edge_type);
CREATE INDEX IF NOT EXISTS qelly_evidence_edge_from_idx ON qelly_evidence_edges(graph_id,from_node_id);
CREATE INDEX IF NOT EXISTS qelly_evidence_edge_to_idx ON qelly_evidence_edges(graph_id,to_node_id);

COMMIT;
