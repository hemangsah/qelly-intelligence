-- Qelly Prompt 2B Wave 1 - formula/rule metadata and saved-calculation foundations.
BEGIN;

CREATE TABLE IF NOT EXISTS qelly_formula_definitions (
  formula_id text NOT NULL,
  version text NOT NULL,
  domain text NOT NULL,
  definition_json jsonb NOT NULL,
  effective_from date NOT NULL,
  effective_to date,
  deprecated boolean NOT NULL DEFAULT false,
  source_commit char(40) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (formula_id, version)
);

CREATE TABLE IF NOT EXISTS qelly_financial_rule_sets (
  rule_id text NOT NULL,
  version text NOT NULL,
  jurisdiction text NOT NULL,
  effective_from date NOT NULL,
  effective_to date,
  verification_status text NOT NULL CHECK (verification_status IN ('VERIFIED','UNAVAILABLE','USER_ENTERED_ONLY','PENDING_PRIMARY_SOURCE')),
  source_authority text NOT NULL,
  source_url text,
  rule_json jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (rule_id, version)
);

CREATE TABLE IF NOT EXISTS qelly_saved_calculations (
  saved_calculation_id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES qelly_users(user_id),
  tenant_id text NOT NULL REFERENCES qelly_organizations(organization_id),
  workspace_id text NOT NULL REFERENCES qelly_workspaces(workspace_id),
  name text NOT NULL,
  formula_id text,
  formula_version text,
  indicator_id text,
  indicator_version text,
  effective_rule_date date,
  input_json jsonb NOT NULL,
  output_json jsonb NOT NULL,
  evidence_json jsonb NOT NULL,
  notes text NOT NULL DEFAULT '',
  revision integer NOT NULL DEFAULT 1 CHECK (revision > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT qelly_saved_calculation_method CHECK (formula_id IS NOT NULL OR indicator_id IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS qelly_saved_calculation_revisions (
  revision_id text PRIMARY KEY,
  saved_calculation_id text NOT NULL REFERENCES qelly_saved_calculations(saved_calculation_id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES qelly_users(user_id),
  tenant_id text NOT NULL REFERENCES qelly_organizations(organization_id),
  workspace_id text NOT NULL REFERENCES qelly_workspaces(workspace_id),
  revision integer NOT NULL CHECK (revision > 0),
  snapshot_json jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(saved_calculation_id, revision)
);

CREATE TABLE IF NOT EXISTS qelly_saved_indicator_configurations (
  configuration_id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES qelly_users(user_id),
  tenant_id text NOT NULL REFERENCES qelly_organizations(organization_id),
  workspace_id text NOT NULL REFERENCES qelly_workspaces(workspace_id),
  name text NOT NULL,
  indicator_id text NOT NULL,
  indicator_version text NOT NULL,
  parameters_json jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS qelly_calculation_exports (
  export_id text PRIMARY KEY,
  saved_calculation_id text REFERENCES qelly_saved_calculations(saved_calculation_id) ON DELETE SET NULL,
  user_id text NOT NULL REFERENCES qelly_users(user_id),
  tenant_id text NOT NULL REFERENCES qelly_organizations(organization_id),
  workspace_id text NOT NULL REFERENCES qelly_workspaces(workspace_id),
  format text NOT NULL CHECK (format IN ('json','csv','html')),
  sha256 char(64) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS qelly_saved_calculation_scope_idx ON qelly_saved_calculations(tenant_id,workspace_id,user_id,updated_at DESC);
CREATE INDEX IF NOT EXISTS qelly_saved_indicator_scope_idx ON qelly_saved_indicator_configurations(tenant_id,workspace_id,user_id,updated_at DESC);
CREATE INDEX IF NOT EXISTS qelly_financial_rule_effective_idx ON qelly_financial_rule_sets(jurisdiction,rule_id,effective_from,effective_to);

COMMIT;
