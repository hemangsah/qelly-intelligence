-- Qelly Prompt 2B saved-calculation lifecycle completion.
-- Non-destructive additive migration; no table or source history is rewritten.
BEGIN;

ALTER TABLE qelly_saved_calculations
  ADD COLUMN IF NOT EXISTS tags_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS favorite boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS india_rule_version text,
  ADD COLUMN IF NOT EXISTS schema_version integer NOT NULL DEFAULT 2 CHECK (schema_version > 0);

ALTER TABLE qelly_saved_calculation_revisions
  ADD COLUMN IF NOT EXISTS restored_from_revision_id text,
  ADD COLUMN IF NOT EXISTS operation text NOT NULL DEFAULT 'update'
    CHECK (operation IN ('create','update','restore','migration'));

CREATE INDEX IF NOT EXISTS qelly_saved_calculation_name_idx
  ON qelly_saved_calculations(tenant_id,workspace_id,user_id,lower(name));
CREATE INDEX IF NOT EXISTS qelly_saved_calculation_favorite_idx
  ON qelly_saved_calculations(tenant_id,workspace_id,user_id,favorite,updated_at DESC);
CREATE INDEX IF NOT EXISTS qelly_saved_calculation_tags_gin_idx
  ON qelly_saved_calculations USING gin(tags_json);
CREATE INDEX IF NOT EXISTS qelly_saved_calculation_revision_scope_idx
  ON qelly_saved_calculation_revisions(tenant_id,workspace_id,user_id,saved_calculation_id,revision DESC);

-- Existing version-1 rows remain valid and are explicitly marked as migrated snapshots.
UPDATE qelly_saved_calculation_revisions
SET operation='migration'
WHERE operation='update' AND revision=1;

COMMIT;
