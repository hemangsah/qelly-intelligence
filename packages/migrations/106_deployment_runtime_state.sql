-- Qelly Intelligence deployment runtime state, portfolio persistence, and durable audit chain
BEGIN;

CREATE TABLE IF NOT EXISTS qelly_runtime_documents (
  document_key text PRIMARY KEY,
  document_type text NOT NULL,
  body_json jsonb NOT NULL,
  revision bigint NOT NULL DEFAULT 1 CHECK (revision > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS qelly_portfolios (
  portfolio_id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES qelly_users(user_id) ON DELETE CASCADE,
  tenant_id text NOT NULL REFERENCES qelly_organizations(organization_id) ON DELETE CASCADE,
  workspace_id text NOT NULL REFERENCES qelly_workspaces(workspace_id) ON DELETE CASCADE,
  name text NOT NULL,
  base_currency text NOT NULL DEFAULT 'USD',
  cash_value numeric(24,8) NOT NULL DEFAULT 0,
  positions_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  model_only boolean NOT NULL DEFAULT true,
  revision bigint NOT NULL DEFAULT 1 CHECK (revision > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id,tenant_id,workspace_id,name)
);
CREATE INDEX IF NOT EXISTS qelly_portfolios_scope_idx
  ON qelly_portfolios(user_id,tenant_id,workspace_id,updated_at DESC);

CREATE TABLE IF NOT EXISTS qelly_audit_records (
  sequence_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  event_id text NOT NULL UNIQUE,
  tenant_id text REFERENCES qelly_organizations(organization_id) ON DELETE SET NULL,
  workspace_id text REFERENCES qelly_workspaces(workspace_id) ON DELETE SET NULL,
  event_type text NOT NULL,
  record_json jsonb NOT NULL,
  previous_hash text NOT NULL,
  record_hash char(64) NOT NULL UNIQUE,
  occurred_at timestamptz NOT NULL,
  stored_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS qelly_audit_scope_idx
  ON qelly_audit_records(tenant_id,workspace_id,sequence_id DESC);

ALTER TABLE qelly_portfolios ENABLE ROW LEVEL SECURITY;
ALTER TABLE qelly_audit_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS qelly_portfolios_tenant_policy ON qelly_portfolios;
CREATE POLICY qelly_portfolios_tenant_policy ON qelly_portfolios
USING (tenant_id = NULLIF(current_setting('qelly.tenant_id', true),''))
WITH CHECK (tenant_id = NULLIF(current_setting('qelly.tenant_id', true),''));

DROP POLICY IF EXISTS qelly_audit_tenant_policy ON qelly_audit_records;
CREATE POLICY qelly_audit_tenant_policy ON qelly_audit_records
USING (tenant_id IS NULL OR tenant_id = NULLIF(current_setting('qelly.tenant_id', true),''))
WITH CHECK (tenant_id IS NULL OR tenant_id = NULLIF(current_setting('qelly.tenant_id', true),''));

COMMIT;
