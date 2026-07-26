-- Qelly Intelligence Release A4 - account recovery, quarantine, and outbound network policy evidence
BEGIN;

CREATE TABLE IF NOT EXISTS qelly_account_recovery_challenges (
  challenge_id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES qelly_users(user_id) ON DELETE CASCADE,
  email text NOT NULL,
  code_hash text NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 5,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS qelly_account_recovery_email_idx
  ON qelly_account_recovery_challenges(email,created_at DESC);

ALTER TABLE qelly_secure_imports
  ALTER COLUMN status SET DEFAULT 'released';

COMMIT;
