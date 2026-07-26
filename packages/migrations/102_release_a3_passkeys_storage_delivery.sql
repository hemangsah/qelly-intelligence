-- Release A3: correct A2 PostgreSQL repository/table parity and add passkey/challenge persistence.
CREATE TABLE IF NOT EXISTS qelly_mfa_factors(
  user_id TEXT PRIMARY KEY REFERENCES qelly_users(user_id) ON DELETE CASCADE,
  secret_encrypted TEXT NOT NULL,
  status TEXT NOT NULL,
  recovery_codes_hashes JSONB NOT NULL DEFAULT '[]'::jsonb,
  recovery_codes_remaining INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS qelly_secure_imports(
  import_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES qelly_users(user_id) ON DELETE CASCADE,
  tenant_id TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  object_key TEXT NOT NULL,
  file_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size BIGINT NOT NULL,
  sha256 TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_qelly_secure_imports_scope ON qelly_secure_imports(user_id,tenant_id,workspace_id,created_at DESC);
CREATE TABLE IF NOT EXISTS qelly_delivery_attempts(
  delivery_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES qelly_users(user_id) ON DELETE CASCADE,
  tenant_id TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  channel TEXT NOT NULL,
  destination TEXT,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  source_job_id TEXT,
  status TEXT NOT NULL,
  provider TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_qelly_delivery_attempts_scope ON qelly_delivery_attempts(user_id,tenant_id,workspace_id,created_at DESC);
CREATE TABLE IF NOT EXISTS qelly_passkey_credentials(
  credential_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES qelly_users(user_id) ON DELETE CASCADE,
  public_key_jwk JSONB NOT NULL,
  sign_count BIGINT NOT NULL DEFAULT 0,
  transports_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  label TEXT NOT NULL DEFAULT 'Passkey',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_qelly_passkeys_user ON qelly_passkey_credentials(user_id,revoked_at,created_at DESC);
CREATE TABLE IF NOT EXISTS qelly_auth_challenges(
  challenge_id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES qelly_users(user_id) ON DELETE CASCADE,
  email TEXT,
  kind TEXT NOT NULL,
  challenge TEXT NOT NULL,
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_qelly_auth_challenges_lookup ON qelly_auth_challenges(kind,email,expires_at,used_at);
