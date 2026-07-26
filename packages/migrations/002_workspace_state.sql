-- Qelly Part 21 migration contract only. Tenant-scoped production design.
CREATE TABLE IF NOT EXISTS workspace_objects (
  object_id text PRIMARY KEY,
  organization_id text NOT NULL,
  workspace_id text NOT NULL,
  user_id text NOT NULL,
  object_type text NOT NULL,
  revision bigint NOT NULL DEFAULT 1,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, workspace_id, object_type, object_id)
);
CREATE INDEX IF NOT EXISTS workspace_objects_scope_idx ON workspace_objects(organization_id, workspace_id, user_id, object_type);
