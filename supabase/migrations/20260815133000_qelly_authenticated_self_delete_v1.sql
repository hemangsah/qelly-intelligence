-- Complete authenticated Qelly account deletion without exposing a Supabase
-- service-role credential to the Cloudflare runtime.
--
-- The caller cannot choose a user id: auth.uid() is the only deletion target.
-- Existing requested/completed evidence is retained transactionally, while
-- user-owned application rows continue to follow their declared CASCADE/SET NULL
-- foreign-key policies. Storage objects must be removed through the Storage API
-- before identity deletion so metadata is never orphaned by direct SQL.

create or replace function public.qelly_self_delete_account(
  p_reason text default null,
  p_privacy_version text default '2026-08-01',
  p_terms_version text default '2026-08-01'
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_actor uuid := auth.uid();
  v_requested jsonb;
  v_completed jsonb;
  v_request_id uuid;
  v_storage_objects bigint := 0;
  v_deleted integer := 0;
begin
  if v_actor is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('qelly:account-self-delete:' || v_actor::text, 0)
  );

  select count(*)
    into v_storage_objects
    from storage.objects o
   where o.owner_id = v_actor::text;

  if v_storage_objects > 0 then
    raise exception 'account_storage_cleanup_required'
      using errcode = '55000',
            detail = format('The authenticated account owns %s Storage object(s).', v_storage_objects),
            hint = 'Delete owned Storage objects through the Storage API before retrying account deletion.';
  end if;

  v_requested := qelly_private.qelly_request_account_deletion(
    p_reason,
    p_privacy_version,
    p_terms_version
  );

  begin
    v_request_id := nullif(v_requested ->> 'requestId', '')::uuid;
  exception when invalid_text_representation then
    v_request_id := null;
  end;

  if v_request_id is null then
    raise exception 'deletion_request_id_missing' using errcode = 'P0001';
  end if;

  -- Write terminal evidence before deleting the Auth row. PostgreSQL transaction
  -- atomicity guarantees this completion event rolls back if the Auth delete fails.
  v_completed := public.qelly_complete_account_deletion(
    v_request_id,
    jsonb_build_object(
      'completedBy', 'qelly-supabase-self-delete-rpc',
      'identityDeletionMode', 'transactional-auth-row-delete'
    )
  );

  delete from auth.users where id = v_actor;
  get diagnostics v_deleted = row_count;

  if v_deleted <> 1 then
    raise exception 'authenticated_identity_delete_failed' using errcode = 'P0001';
  end if;

  return jsonb_build_object(
    'requested', true,
    'requestId', v_request_id,
    'replayed', coalesce((v_requested ->> 'replayed')::boolean, false),
    'identityDeleted', true,
    'identityDeletionStatus', 204,
    'evidenceCompleted', true,
    'evidenceError', null,
    'status', 'completed',
    'completedAt', v_completed ->> 'completedAt'
  );
end
$$;

revoke all on function public.qelly_self_delete_account(text,text,text) from public;
revoke all on function public.qelly_self_delete_account(text,text,text) from anon;
revoke all on function public.qelly_self_delete_account(text,text,text) from service_role;
grant execute on function public.qelly_self_delete_account(text,text,text) to authenticated;

comment on function public.qelly_self_delete_account(text,text,text) is
  'Deletes only auth.uid() and records Qelly deletion evidence transactionally; authenticated role only.';
