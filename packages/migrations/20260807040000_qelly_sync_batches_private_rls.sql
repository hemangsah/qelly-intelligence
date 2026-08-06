DO $$
DECLARE
  function_owner text;
  table_owner text;
  is_security_definer boolean;
BEGIN
  SELECT pg_get_userbyid(c.relowner)
    INTO table_owner
  FROM pg_class c
  WHERE c.oid = 'qelly_private.sync_batches'::regclass;

  SELECT pg_get_userbyid(p.proowner), p.prosecdef
    INTO function_owner, is_security_definer
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'qelly_private'
    AND p.proname = 'qelly_sync_push_batch';

  IF table_owner IS DISTINCT FROM 'postgres' THEN
    RAISE EXCEPTION 'Expected qelly_private.sync_batches owner postgres, found %', table_owner;
  END IF;

  IF function_owner IS DISTINCT FROM table_owner OR is_security_definer IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'qelly_sync_push_batch must remain an owner-executed SECURITY DEFINER function';
  END IF;
END
$$;

ALTER TABLE qelly_private.sync_batches ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE qelly_private.sync_batches FROM PUBLIC;
REVOKE ALL ON TABLE qelly_private.sync_batches FROM anon;
REVOKE ALL ON TABLE qelly_private.sync_batches FROM authenticated;

COMMENT ON TABLE qelly_private.sync_batches IS
  'Private idempotency ledger for qelly_private.qelly_sync_push_batch. RLS is enabled without client policies as defense in depth. The owner-executed SECURITY DEFINER function performs authentication, workspace-role and cloud-opt-in checks before accessing this table.';
