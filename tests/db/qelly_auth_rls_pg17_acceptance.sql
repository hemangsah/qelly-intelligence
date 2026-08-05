\set ON_ERROR_STOP on
\pset pager off

\echo 'QELLY_DB_ACCEPTANCE_BEGIN'

-- Structural RLS and privilege assertions.
select qelly_test.assert_true(
  coalesce((
    select bool_and(c.relrowsecurity)
    from pg_class c
    join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public'
      and c.relkind='r'
      and c.relname like 'qelly_%'
  ),false),
  'every public qelly table must have RLS enabled'
);

select qelly_test.assert_true(
  exists(
    select 1 from pg_policies
    where schemaname='public'
      and tablename='qelly_provider_cache'
      and policyname='qelly_provider_cache_browser_deny'
  ),
  'provider cache must have an explicit browser deny policy'
);

select qelly_test.assert_true(
  not has_table_privilege('anon','public.qelly_provider_cache','select')
  and not has_table_privilege('authenticated','public.qelly_provider_cache','select'),
  'provider cache browser grants must remain revoked'
);

select qelly_test.assert_true(
  has_function_privilege('authenticated','public.qelly_set_cloud_sync_consent(boolean,text,text)','execute')
  and not has_function_privilege('anon','public.qelly_set_cloud_sync_consent(boolean,text,text)','execute'),
  'consent RPC execution boundary must be authenticated-only'
);

select qelly_test.assert_true(
  has_function_privilege('service_role','public.qelly_complete_account_deletion(uuid,jsonb)','execute')
  and not has_function_privilege('authenticated','public.qelly_complete_account_deletion(uuid,jsonb)','execute'),
  'deletion completion RPC execution boundary must be service-role-only'
);

select qelly_test.assert_true(
  has_function_privilege('authenticated','public.qelly_sync_push_batch(uuid,text,text,jsonb)','execute')
  and not has_function_privilege('anon','public.qelly_sync_push_batch(uuid,text,text,jsonb)','execute'),
  'atomic sync RPC execution boundary must be authenticated-only'
);

-- Create two real-looking disposable Auth identities. The hardened bootstrap
-- trigger must provision one profile and one workspace for each identity.
insert into auth.users(id,email,raw_user_meta_data) values
  ('11111111-1111-4111-8111-111111111111','one@example.invalid','{"display_name":"User One"}'::jsonb),
  ('22222222-2222-4222-8222-222222222222','two@example.invalid','{"display_name":"User Two"}'::jsonb);

select qelly_test.assert_true(
  (select count(*) from public.qelly_profiles)=2,
  'Auth bootstrap must create two profiles'
);
select qelly_test.assert_true(
  (select count(*) from public.qelly_workspaces)=2,
  'Auth bootstrap must create two workspaces'
);

select id::text as workspace_id
from public.qelly_workspaces
where owner_id='11111111-1111-4111-8111-111111111111'::uuid
\gset u1_

-- User one sees only their own identity and workspace.
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
set role authenticated;

select qelly_test.assert_true(
  (select count(*) from public.qelly_profiles)=1,
  'user one must see exactly one profile'
);
select qelly_test.assert_true(
  (select count(*) from public.qelly_profiles where user_id='22222222-2222-4222-8222-222222222222'::uuid)=0,
  'user one must not see user two profile'
);
select qelly_test.assert_true(
  (select count(*) from public.qelly_workspaces)=1,
  'user one must see exactly one workspace'
);

-- Consent must be written only through the governance RPC and create three
-- immutable evidence events.
select public.qelly_set_cloud_sync_consent(true,'2026-08-01','2026-08-01');
select qelly_test.assert_true(
  (select cloud_sync_opt_in from public.qelly_profiles where user_id=auth.uid()) is true,
  'consent RPC must enable cloud sync for the caller'
);
select qelly_test.assert_true(
  (select count(*) from public.qelly_consent_events)=3,
  'consent RPC must create cloud, privacy and terms evidence'
);

select qelly_test.expect_denied(
  'update public.qelly_profiles set cloud_sync_opt_in=false',
  'browser must not directly mutate cloud consent columns'
);
select qelly_test.expect_denied(
  'update public.qelly_consent_events set policy_version=''tampered''',
  'consent evidence must be append-only'
);
select qelly_test.expect_denied(
  'delete from public.qelly_consent_events',
  'consent evidence must not be browser-deletable'
);

-- Exercise the atomic sync RPC against the migrated database, including replay.
select qelly_test.assert_true(
  (
    public.qelly_sync_push_batch(
      :'u1_workspace_id'::uuid,
      'acceptance-key-0001',
      repeat('a',64),
      '[{"id":"33333333-3333-4333-8333-333333333333","operationId":"44444444-4444-4444-8444-444444444444","baseRevision":0,"record":{"title":"Acceptance calculation","formula_id":"kelly-criterion","input_payload":{"p":0.55,"b":1.2},"result_payload":{"fraction":0.175},"provenance":{"source":"pg17-acceptance"},"client_updated_at":"2026-08-05T00:00:00Z","deleted_at":null}}]'::jsonb
    )->>'applied'
  )::integer=1,
  'atomic sync must apply one new record'
);

select qelly_test.assert_true(
  (
    public.qelly_sync_push_batch(
      :'u1_workspace_id'::uuid,
      'acceptance-key-0001',
      repeat('a',64),
      '[{"id":"33333333-3333-4333-8333-333333333333","operationId":"44444444-4444-4444-8444-444444444444","baseRevision":0,"record":{"title":"Acceptance calculation","formula_id":"kelly-criterion","input_payload":{"p":0.55,"b":1.2},"result_payload":{"fraction":0.175},"provenance":{"source":"pg17-acceptance"},"client_updated_at":"2026-08-05T00:00:00Z","deleted_at":null}}]'::jsonb
    )->>'replayed'
  )::boolean is true,
  'atomic sync must replay the stored result for the same request'
);

select qelly_test.assert_true(
  (select count(*) from public.qelly_saved_calculations where id='33333333-3333-4333-8333-333333333333'::uuid)=1,
  'user one must see the synced calculation'
);
select qelly_test.expect_denied(
  'update public.qelly_saved_calculations set current_revision=99 where id=''33333333-3333-4333-8333-333333333333''::uuid',
  'browser must not directly mutate current_revision'
);
select qelly_test.expect_denied(
  'update public.qelly_saved_calculations set owner_id=''22222222-2222-4222-8222-222222222222''::uuid where id=''33333333-3333-4333-8333-333333333333''::uuid',
  'calculation ownership must be immutable'
);
select qelly_test.expect_denied(
  'insert into public.qelly_sync_operations(owner_id,client_operation_id,operation_type) values (''11111111-1111-4111-8111-111111111111''::uuid,''55555555-5555-4555-8555-555555555555''::uuid,''create'')',
  'sync operation evidence must be RPC-written only'
);

select (public.qelly_request_account_deletion(
  'PG17 isolated acceptance',
  '2026-08-01',
  '2026-08-01'
)->>'requestId') as request_id
\gset deletion_

select qelly_test.assert_true(
  (select count(*) from public.qelly_account_deletion_events where request_id=:'deletion_request_id'::uuid and event_type='requested')=1,
  'deletion request RPC must create requested evidence'
);
select qelly_test.expect_denied(
  'select public.qelly_complete_account_deletion(''' :'deletion_request_id' '''::uuid,''{}''::jsonb)',
  'authenticated callers must not complete deletion evidence'
);

reset role;

-- User two cannot see user one's cloud records or governance evidence.
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',false);
set role authenticated;
select qelly_test.assert_true(
  (select count(*) from public.qelly_saved_calculations)=0,
  'user two must not see user one calculations'
);
select qelly_test.assert_true(
  (select count(*) from public.qelly_sync_operations)=0,
  'user two must not see user one sync evidence'
);
select qelly_test.assert_true(
  (select count(*) from public.qelly_consent_events)=0,
  'user two must not see user one consent evidence'
);
select qelly_test.assert_true(
  (select count(*) from public.qelly_account_deletion_events)=0,
  'user two must not see user one deletion evidence'
);
reset role;

-- FK-driven Auth deletion must pseudonymize, not erase, append-only evidence.
delete from auth.users where id='11111111-1111-4111-8111-111111111111'::uuid;

select qelly_test.assert_true(
  (select count(*) from public.qelly_consent_events)=3
  and (select count(*) from public.qelly_consent_events where owner_id is null)=3
  and (select count(*) from public.qelly_consent_events where subject_hash ~ '^[0-9a-f]{64}$')=3,
  'consent evidence must survive Auth deletion with pseudonymous subject hashes'
);
select qelly_test.assert_true(
  (select count(*) from public.qelly_account_deletion_events where request_id=:'deletion_request_id'::uuid and owner_id is null)=1,
  'requested deletion evidence must survive Auth deletion'
);

select qelly_test.expect_denied(
  'update public.qelly_consent_events set policy_version=''tampered-by-owner''',
  'append-only trigger must reject privileged mutation'
);
select qelly_test.expect_denied(
  'delete from public.qelly_account_deletion_events',
  'append-only trigger must reject privileged deletion'
);

set role service_role;
select public.qelly_complete_account_deletion(:'deletion_request_id'::uuid,'{"executor":"pg17-acceptance"}'::jsonb);
reset role;

select qelly_test.assert_true(
  (select count(*) from public.qelly_account_deletion_events where request_id=:'deletion_request_id'::uuid)=2
  and (select count(*) from public.qelly_account_deletion_events where request_id=:'deletion_request_id'::uuid and event_type='completed' and owner_id is null)=1,
  'service role completion must append a distinct completed event'
);

-- Emit compact evidence inventory for the workflow artifact.
\echo 'QELLY_DB_ACCEPTANCE_INVENTORY'
select n.nspname as schema_name,c.relname as table_name,c.relrowsecurity as rls_enabled
from pg_class c
join pg_namespace n on n.oid=c.relnamespace
where c.relkind='r' and c.relname like 'qelly_%'
order by n.nspname,c.relname;

select schemaname,tablename,policyname,roles,cmd
from pg_policies
where tablename like 'qelly_%'
order by schemaname,tablename,policyname;

select routine_schema,routine_name,security_type
from information_schema.routines
where routine_schema in ('public','qelly_private')
  and routine_name like 'qelly_%'
order by routine_schema,routine_name;

\echo 'QELLY_DB_ACCEPTANCE_PASS'
