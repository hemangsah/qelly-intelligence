-- Serialize account-deletion requests per authenticated user so concurrent
-- calls cannot create multiple active request identifiers. Treat every
-- terminal event as closing the request lifecycle.

begin;

create or replace function qelly_private.qelly_request_account_deletion(
  p_reason text default null,
  p_privacy_version text default '2026-08-01',
  p_terms_version text default '2026-08-01'
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_subject_hash text;
  v_request_id uuid;
  v_reason text := nullif(btrim(coalesce(p_reason,'')),'');
  v_privacy_version text := btrim(coalesce(p_privacy_version,''));
  v_terms_version text := btrim(coalesce(p_terms_version,''));
  v_occurred_at timestamptz;
begin
  if v_actor is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;
  if v_reason is not null and char_length(v_reason) > 500 then
    raise exception 'deletion_reason_invalid' using errcode = '22023';
  end if;
  if char_length(v_privacy_version) not between 1 and 64
     or char_length(v_terms_version) not between 1 and 64 then
    raise exception 'policy_version_invalid' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'qelly:account-deletion:' || v_actor::text,
      0
    )
  );

  select requested.request_id
    into v_request_id
    from public.qelly_account_deletion_events requested
   where requested.owner_id = v_actor
     and requested.event_type = 'requested'
     and not exists (
       select 1
         from public.qelly_account_deletion_events terminal
        where terminal.request_id = requested.request_id
          and terminal.event_type in ('completed','failed','cancelled')
     )
   order by requested.occurred_at desc, requested.id desc
   limit 1;

  if v_request_id is not null then
    return jsonb_build_object(
      'requestId',v_request_id,
      'status','requested',
      'replayed',true
    );
  end if;

  v_occurred_at := clock_timestamp();
  v_request_id := extensions.gen_random_uuid();
  v_subject_hash := encode(
    extensions.digest(convert_to(v_actor::text,'UTF8'),'sha256'),
    'hex'
  );

  insert into public.qelly_account_deletion_events(
    request_id,
    owner_id,
    subject_hash,
    event_type,
    reason,
    privacy_version,
    terms_version,
    metadata,
    occurred_at
  ) values (
    v_request_id,
    v_actor,
    v_subject_hash,
    'requested',
    v_reason,
    v_privacy_version,
    v_terms_version,
    jsonb_build_object('channel','authenticated_api'),
    v_occurred_at
  );

  return jsonb_build_object(
    'requestId',v_request_id,
    'status','requested',
    'requestedAt',v_occurred_at,
    'replayed',false
  );
end
$$;

revoke all on function qelly_private.qelly_request_account_deletion(text,text,text)
  from public, anon, authenticated, service_role;
grant execute on function qelly_private.qelly_request_account_deletion(text,text,text)
  to authenticated;

comment on function qelly_private.qelly_request_account_deletion(text,text,text) is
  'Creates one active deletion request per authenticated user. Concurrent calls serialize and terminal events permit a new lifecycle.';

notify pgrst, 'reload schema';

commit;
