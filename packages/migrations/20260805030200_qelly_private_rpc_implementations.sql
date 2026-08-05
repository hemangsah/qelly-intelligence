-- Keep exposed RPC signatures stable while moving privileged implementations
-- out of the public Data API schema.

begin;

alter function public.qelly_set_cloud_sync_consent(boolean,text,text)
  set schema qelly_private;
alter function public.qelly_request_account_deletion(text,text,text)
  set schema qelly_private;
alter function public.qelly_sync_push_batch(uuid,text,text,jsonb)
  set schema qelly_private;

revoke all on function qelly_private.qelly_set_cloud_sync_consent(boolean,text,text)
  from public, anon, authenticated, service_role;
revoke all on function qelly_private.qelly_request_account_deletion(text,text,text)
  from public, anon, authenticated, service_role;
revoke all on function qelly_private.qelly_sync_push_batch(uuid,text,text,jsonb)
  from public, anon, authenticated, service_role;

grant execute on function qelly_private.qelly_set_cloud_sync_consent(boolean,text,text)
  to authenticated;
grant execute on function qelly_private.qelly_request_account_deletion(text,text,text)
  to authenticated;
grant execute on function qelly_private.qelly_sync_push_batch(uuid,text,text,jsonb)
  to authenticated;

create function public.qelly_set_cloud_sync_consent(
  p_enabled boolean,
  p_privacy_version text,
  p_terms_version text
)
returns jsonb
language sql
volatile
security invoker
set search_path = ''
as $$
  select qelly_private.qelly_set_cloud_sync_consent($1,$2,$3)
$$;

create function public.qelly_request_account_deletion(
  p_reason text default null,
  p_privacy_version text default '2026-08-01',
  p_terms_version text default '2026-08-01'
)
returns jsonb
language sql
volatile
security invoker
set search_path = ''
as $$
  select qelly_private.qelly_request_account_deletion($1,$2,$3)
$$;

create function public.qelly_sync_push_batch(
  p_workspace_id uuid,
  p_idempotency_key text,
  p_request_hash text,
  p_items jsonb
)
returns jsonb
language sql
volatile
security invoker
set search_path = ''
as $$
  select qelly_private.qelly_sync_push_batch($1,$2,$3,$4)
$$;

revoke all on function public.qelly_set_cloud_sync_consent(boolean,text,text)
  from public, anon, authenticated, service_role;
revoke all on function public.qelly_request_account_deletion(text,text,text)
  from public, anon, authenticated, service_role;
revoke all on function public.qelly_sync_push_batch(uuid,text,text,jsonb)
  from public, anon, authenticated, service_role;

grant execute on function public.qelly_set_cloud_sync_consent(boolean,text,text)
  to authenticated;
grant execute on function public.qelly_request_account_deletion(text,text,text)
  to authenticated;
grant execute on function public.qelly_sync_push_batch(uuid,text,text,jsonb)
  to authenticated;

comment on function public.qelly_set_cloud_sync_consent(boolean,text,text) is
  'Invoker-only exposed wrapper. Privileged consent implementation is held in qelly_private.';
comment on function public.qelly_request_account_deletion(text,text,text) is
  'Invoker-only exposed wrapper. Privileged deletion-request implementation is held in qelly_private.';
comment on function public.qelly_sync_push_batch(uuid,text,text,jsonb) is
  'Invoker-only exposed wrapper. Privileged atomic-sync implementation is held in qelly_private.';

notify pgrst, 'reload schema';

commit;
