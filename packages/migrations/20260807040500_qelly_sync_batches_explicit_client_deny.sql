DROP POLICY IF EXISTS qelly_sync_batches_explicit_client_deny
  ON qelly_private.sync_batches;

CREATE POLICY qelly_sync_batches_explicit_client_deny
  ON qelly_private.sync_batches
  AS RESTRICTIVE
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

COMMENT ON POLICY qelly_sync_batches_explicit_client_deny
  ON qelly_private.sync_batches IS
  'Explicitly denies direct anonymous and authenticated access. Synchronization is available only through qelly_private.qelly_sync_push_batch, whose SECURITY DEFINER implementation authenticates the caller and verifies workspace role and cloud opt-in.';
