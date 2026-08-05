\set ON_ERROR_STOP on

select qelly_test.assert_true(
  (
    select count(*)=3
    from information_schema.routines
    where routine_schema='public'
      and routine_name in (
        'qelly_set_cloud_sync_consent',
        'qelly_request_account_deletion',
        'qelly_sync_push_batch'
      )
      and security_type='INVOKER'
  ),
  'all exposed authenticated RPC wrappers must be SECURITY INVOKER'
);

select qelly_test.assert_true(
  (
    select count(*)=3
    from information_schema.routines
    where routine_schema='qelly_private'
      and routine_name in (
        'qelly_set_cloud_sync_consent',
        'qelly_request_account_deletion',
        'qelly_sync_push_batch'
      )
      and security_type='DEFINER'
  ),
  'all privileged RPC implementations must live in qelly_private'
);

select qelly_test.assert_true(
  has_function_privilege('authenticated','public.qelly_set_cloud_sync_consent(boolean,text,text)','execute')
  and has_function_privilege('authenticated','public.qelly_request_account_deletion(text,text,text)','execute')
  and has_function_privilege('authenticated','public.qelly_sync_push_batch(uuid,text,text,jsonb)','execute')
  and not has_function_privilege('anon','public.qelly_set_cloud_sync_consent(boolean,text,text)','execute')
  and not has_function_privilege('anon','public.qelly_request_account_deletion(text,text,text)','execute')
  and not has_function_privilege('anon','public.qelly_sync_push_batch(uuid,text,text,jsonb)','execute'),
  'exposed wrapper execution must remain authenticated-only'
);

\echo 'QELLY_PRIVATE_RPC_BOUNDARY_PASS'
