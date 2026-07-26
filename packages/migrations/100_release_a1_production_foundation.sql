-- Qelly Intelligence Release A1 - production platform foundation
-- PostgreSQL 15+
BEGIN;

CREATE TABLE IF NOT EXISTS qelly_migration_history (
  migration_id text PRIMARY KEY,
  checksum text NOT NULL,
  applied_at timestamptz NOT NULL DEFAULT now(),
  runtime text NOT NULL
);

CREATE TABLE IF NOT EXISTS qelly_users (
  user_id text PRIMARY KEY,
  email text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  display_name text NOT NULL,
  email_verified boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended','deleted')),
  locale text NOT NULL DEFAULT 'en-US',
  timezone text NOT NULL DEFAULT 'UTC',
  base_currency text NOT NULL DEFAULT 'USD',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  revision bigint NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS qelly_organizations (
  organization_id text PRIMARY KEY,
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended','deleted')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  revision bigint NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS qelly_workspaces (
  workspace_id text PRIMARY KEY,
  organization_id text NOT NULL REFERENCES qelly_organizations(organization_id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL,
  environment text NOT NULL DEFAULT 'research',
  risk_tier text NOT NULL DEFAULT 'standard',
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  revision bigint NOT NULL DEFAULT 1,
  UNIQUE(organization_id,slug)
);

CREATE TABLE IF NOT EXISTS qelly_memberships (
  membership_id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES qelly_users(user_id) ON DELETE CASCADE,
  organization_id text NOT NULL REFERENCES qelly_organizations(organization_id) ON DELETE CASCADE,
  roles_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  workspace_ids_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  revision bigint NOT NULL DEFAULT 1,
  UNIQUE(user_id,organization_id)
);

CREATE TABLE IF NOT EXISTS qelly_sessions (
  session_id text PRIMARY KEY,
  token_hash text NOT NULL UNIQUE,
  csrf_hash text NOT NULL,
  user_id text NOT NULL REFERENCES qelly_users(user_id) ON DELETE CASCADE,
  organization_id text NOT NULL REFERENCES qelly_organizations(organization_id) ON DELETE CASCADE,
  workspace_id text NOT NULL REFERENCES qelly_workspaces(workspace_id) ON DELETE CASCADE,
  assurance text NOT NULL DEFAULT 'medium',
  authentication_method text NOT NULL,
  user_agent text,
  ip_hash text,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  step_up_expires_at timestamptz,
  rotated_from_session_id text,
  revoked_at timestamptz,
  revocation_reason text,
  revision bigint NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS qelly_sessions_user_idx ON qelly_sessions(user_id,revoked_at,expires_at);
CREATE INDEX IF NOT EXISTS qelly_sessions_org_idx ON qelly_sessions(organization_id,workspace_id);

CREATE TABLE IF NOT EXISTS qelly_jobs (
  job_id text PRIMARY KEY,
  tenant_id text REFERENCES qelly_organizations(organization_id) ON DELETE CASCADE,
  workspace_id text REFERENCES qelly_workspaces(workspace_id) ON DELETE CASCADE,
  job_type text NOT NULL,
  payload_json jsonb NOT NULL,
  status text NOT NULL CHECK (status IN ('queued','running','completed','dead','cancelled')),
  attempts integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 5,
  available_at timestamptz NOT NULL DEFAULT now(),
  locked_at timestamptz,
  locked_by text,
  completed_at timestamptz,
  failed_at timestamptz,
  last_error text,
  idempotency_key text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id,idempotency_key)
);
CREATE INDEX IF NOT EXISTS qelly_jobs_ready_idx ON qelly_jobs(status,available_at,created_at);
CREATE INDEX IF NOT EXISTS qelly_jobs_tenant_idx ON qelly_jobs(tenant_id,workspace_id,created_at DESC);

CREATE TABLE IF NOT EXISTS qelly_notifications (
  notification_id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES qelly_users(user_id) ON DELETE CASCADE,
  tenant_id text NOT NULL REFERENCES qelly_organizations(organization_id) ON DELETE CASCADE,
  workspace_id text NOT NULL REFERENCES qelly_workspaces(workspace_id) ON DELETE CASCADE,
  kind text NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  source_job_id text REFERENCES qelly_jobs(job_id) ON DELETE SET NULL,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id,source_job_id)
);
CREATE INDEX IF NOT EXISTS qelly_notifications_scope_idx ON qelly_notifications(user_id,tenant_id,workspace_id,created_at DESC);

-- Application-scoped tenant settings are set per transaction by the API repository.
-- Empty settings deny access instead of broadening it.
ALTER TABLE qelly_workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE qelly_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE qelly_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE qelly_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE qelly_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS qelly_workspaces_tenant_policy ON qelly_workspaces;
CREATE POLICY qelly_workspaces_tenant_policy ON qelly_workspaces
USING (organization_id = NULLIF(current_setting('qelly.tenant_id', true),'') )
WITH CHECK (organization_id = NULLIF(current_setting('qelly.tenant_id', true),'') );

DROP POLICY IF EXISTS qelly_memberships_tenant_policy ON qelly_memberships;
CREATE POLICY qelly_memberships_tenant_policy ON qelly_memberships
USING (organization_id = NULLIF(current_setting('qelly.tenant_id', true),'') )
WITH CHECK (organization_id = NULLIF(current_setting('qelly.tenant_id', true),'') );

DROP POLICY IF EXISTS qelly_sessions_tenant_policy ON qelly_sessions;
CREATE POLICY qelly_sessions_tenant_policy ON qelly_sessions
USING (organization_id = NULLIF(current_setting('qelly.tenant_id', true),'') )
WITH CHECK (organization_id = NULLIF(current_setting('qelly.tenant_id', true),'') );

DROP POLICY IF EXISTS qelly_jobs_tenant_policy ON qelly_jobs;
CREATE POLICY qelly_jobs_tenant_policy ON qelly_jobs
USING (tenant_id = NULLIF(current_setting('qelly.tenant_id', true),'') )
WITH CHECK (tenant_id = NULLIF(current_setting('qelly.tenant_id', true),'') );

DROP POLICY IF EXISTS qelly_notifications_tenant_policy ON qelly_notifications;
CREATE POLICY qelly_notifications_tenant_policy ON qelly_notifications
USING (tenant_id = NULLIF(current_setting('qelly.tenant_id', true),'') )
WITH CHECK (tenant_id = NULLIF(current_setting('qelly.tenant_id', true),'') );

COMMIT;
