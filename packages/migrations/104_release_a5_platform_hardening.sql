-- Qelly Intelligence Release A5 - key rotation, quarantine review, and assurance evidence
BEGIN;

ALTER TABLE qelly_secure_imports
  ADD COLUMN IF NOT EXISTS scan_provider text;
ALTER TABLE qelly_secure_imports
  ADD COLUMN IF NOT EXISTS scan_result text;
ALTER TABLE qelly_secure_imports
  ADD COLUMN IF NOT EXISTS updated_at timestamptz;
UPDATE qelly_secure_imports SET updated_at=COALESCE(updated_at,created_at);
ALTER TABLE qelly_secure_imports ALTER COLUMN updated_at SET DEFAULT now();
ALTER TABLE qelly_secure_imports ALTER COLUMN updated_at SET NOT NULL;

CREATE INDEX IF NOT EXISTS qelly_secure_imports_status_idx
  ON qelly_secure_imports(tenant_id,workspace_id,status,created_at DESC);

COMMIT;
