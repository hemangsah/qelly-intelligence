-- Qelly Auth, RLS and governance hardening wave 3.
-- Commit-only migration. Validate on an isolated Supabase branch before production.

begin;

create table if not exists public.qelly_consent_events (
  id uuid primary key default extensions.gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete set null,
  subject_hash text not null,
  consent_kind text not null,
  decision text not null,
  policy_version text not null,
  source text not null default 'qelly-cloudflare-facade',
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  constraint qelly_consent_events_subject_hash_check
    check (subject_hash ~ '^[0-9a-f]{64}$'),
  constraint qelly_consent_events_kind_check
    check (consent_kind in ('cloud_sync','privacy','terms')),
  constraint qelly_consent_events_decision_check
    check (decision in ('granted','withdrawn','accepted')),
  constraint qelly_consent_events_policy_version_check
    check (char_length(policy_version) between 1 and 64),
  constraint qelly_consent_events_metadata_check
    check (jsonb_typeof(metadata) = 'object')
);

create table if not exists public.qelly_account_deletion_events (
  id uuid primary key default extensions.gen_random_uuid(),
  request_id uuid not null,
  owner_id uuid references auth.users(id) on delete set null,
  subject_hash text not null,
  event_type text not null,
  reason text,
  privacy_version text not null,
  terms_version text not null,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  constraint qelly_account_deletion_events_subject_hash_check
    check (subject_hash ~ '^[0-9a-f]{64}$'),
  constraint qelly_account_deletion_events_type_check
    check (event_type in ('requested','completed','failed','cancelled')),
  constraint qelly_account_deletion_events_reason_check
    check (reason is null or char_length(reason) <= 500),
  constraint qelly_account_deletion_events_privacy_version_check
    check (char_length(privacy_version) between 1 and 64),
  constraint qelly_account_deletion_events_terms_version_check
    check (char_length(terms_version) between 1 and 64),
  constraint qelly_account_deletion_events_metadata_check
    check (jsonb_typeof(metadata) = 'object'),
  constraint qelly_account_deletion_events_request_type_unique
    unique (request_id,event_type)
);

create index if not exists qelly_consent_events_owner_occurred_idx
  on public.qelly_consent_events(owner_id,occurred_at desc);
create index if not exists qelly_consent_events_subject_occurred_idx
  on public.qelly_consent_events(subject_hash,occurred_at desc);
create index if not exists qelly_deletion_events_owner_occurred_idx
  on public.qelly_account_deletion_events(owner_id,occurred_at desc);
create index if not exists qelly_deletion_events_subject_occurred_idx
  on public.qelly_account_deletion_events(subject_hash,occurred_at desc);
create index if not exists qelly_deletion_events_request_idx
  on public.qelly_account_deletion_events(request_id,occurred_at asc);

create or replace function qelly_private.prevent_append_only_mutation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  -- Permit only the FK-driven pseudonymization from an Auth user id to NULL.
  if tg_op = 'UPDATE'
     and old.owner_id is not null
     and new.owner_id is null
     and (to_jsonb(new) - 'owner_id') = (to_jsonb(old) - 'owner_id') then
    return new;
  end if;
  raise exception 'append_only_evidence_cannot_be_mutated' using errcode = '42501';
end
$$;

revoke all on function qelly_private.prevent_append_only_mutation()
  from public, anon, authenticated, service_role;

drop trigger if exists qelly_consent_events_append_only on public.qelly_consent_events;
create trigger qelly_consent_events_append_only
before update or delete on public.qelly_consent_events
for each row execute function qelly_private.prevent_append_only_mutation();

drop trigger if exists qelly_deletion_events_append_only on public.qelly_account_deletion_events;
create trigger qelly_deletion_events_append_only
before update or delete on public.qelly_account_deletion_events
for each row execute function qelly_private.prevent_append_only_mutation();

-- Preserve any future legacy request row after Auth identity deletion.
alter table public.qelly_account_deletion_requests
  drop constraint if exists qelly_account_deletion_requests_owner_id_fkey;
alter table public.qelly_account_deletion_requests
  alter column owner_id drop not null;

do $legacy_fk$
begin
  if not exists (
    select 1
      from pg_constraint
     where conrelid = 'public.qelly_account_deletion_requests'::regclass
       and conname = 'qelly_account_deletion_requests_owner_id_fkey'
  ) then
    alter table public.qelly_account_deletion_requests
      add constraint qelly_account_deletion_requests_owner_id_fkey
      foreign key (owner_id) references auth.users(id) on delete set null;
  end if;
end
$legacy_fk$;

alter table public.qelly_consent_events enable row level security;
alter table public.qelly_account_deletion_events enable row level security;

drop policy if exists qelly_consent_events_own_select on public.qelly_consent_events;
create policy qelly_consent_events_own_select
on public.qelly_consent_events for select to authenticated
using (owner_id = (select auth.uid()));

drop policy if exists qelly_deletion_events_own_select on public.qelly_account_deletion_events;
create policy qelly_deletion_events_own_select
on public.qelly_account_deletion_events for select to authenticated
using (owner_id = (select auth.uid()));

create or replace function public.qelly_set_cloud_sync_consent(
  p_enabled boolean,
  p_privacy_version text,
  p_terms_version text
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
  v_privacy_version text := btrim(coalesce(p_privacy_version,''));
  v_terms_version text := btrim(coalesce(p_terms_version,''));
  v_cloud_event_id uuid;
  v_privacy_event_id uuid;
  v_terms_event_id uuid;
  v_occurred_at timestamptz := now();
begin
  if v_actor is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;
  if char_length(v_privacy_version) not between 1 and 64
     or char_length(v_terms_version) not between 1 and 64 then
    raise exception 'policy_version_invalid' using errcode = '22023';
  end if;

  v_subject_hash := encode(
    extensions.digest(convert_to(v_actor::text,'UTF8'),'sha256'),
    'hex'
  );

  insert into public.qelly_profiles(
    user_id,
    display_name,
    cloud_sync_opt_in,
    privacy_version,
    terms_version
  ) values (
    v_actor,
    null,
    coalesce(p_enabled,false),
    v_privacy_version,
    v_terms_version
  )
  on conflict(user_id) do update
    set cloud_sync_opt_in = excluded.cloud_sync_opt_in,
        privacy_version = excluded.privacy_version,
        terms_version = excluded.terms_version;

  insert into public.qelly_consent_events(
    owner_id,subject_hash,consent_kind,decision,policy_version,metadata,occurred_at
  ) values (
    v_actor,
    v_subject_hash,
    'cloud_sync',
    case when coalesce(p_enabled,false) then 'granted' else 'withdrawn' end,
    v_privacy_version,
    jsonb_build_object('termsVersion',v_terms_version),
    v_occurred_at
  ) returning id into v_cloud_event_id;

  insert into public.qelly_consent_events(
    owner_id,subject_hash,consent_kind,decision,policy_version,metadata,occurred_at
  ) values (
    v_actor,v_subject_hash,'privacy','accepted',v_privacy_version,
    jsonb_build_object('cloudSyncEnabled',coalesce(p_enabled,false)),v_occurred_at
  ) returning id into v_privacy_event_id;

  insert into public.qelly_consent_events(
    owner_id,subject_hash,consent_kind,decision,policy_version,metadata,occurred_at
  ) values (
    v_actor,v_subject_hash,'terms','accepted',v_terms_version,
    jsonb_build_object('cloudSyncEnabled',coalesce(p_enabled,false)),v_occurred_at
  ) returning id into v_terms_event_id;

  return jsonb_build_object(
    'enabled',coalesce(p_enabled,false),
    'recordedAt',v_occurred_at,
    'privacyVersion',v_privacy_version,
    'termsVersion',v_terms_version,
    'eventIds',jsonb_build_array(v_cloud_event_id,v_privacy_event_id,v_terms_event_id)
  );
end
$$;

create or replace function public.qelly_request_account_deletion(
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
  v_occurred_at timestamptz := now();
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

  select requested.request_id
    into v_request_id
    from public.qelly_account_deletion_events requested
   where requested.owner_id = v_actor
     and requested.event_type = 'requested'
     and not exists (
       select 1
         from public.qelly_account_deletion_events completed
        where completed.request_id = requested.request_id
          and completed.event_type = 'completed'
     )
   order by requested.occurred_at desc
   limit 1;

  if v_request_id is not null then
    return jsonb_build_object(
      'requestId',v_request_id,
      'status','requested',
      'replayed',true
    );
  end if;

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

create or replace function public.qelly_complete_account_deletion(
  p_request_id uuid,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_requested public.qelly_account_deletion_events%rowtype;
  v_completed_at timestamptz := now();
begin
  if p_request_id is null then
    raise exception 'deletion_request_id_required' using errcode = '22023';
  end if;
  if jsonb_typeof(coalesce(p_metadata,'{}'::jsonb)) is distinct from 'object' then
    raise exception 'deletion_metadata_invalid' using errcode = '22023';
  end if;

  select *
    into v_requested
    from public.qelly_account_deletion_events
   where request_id = p_request_id
     and event_type = 'requested'
   limit 1;

  if not found then
    raise exception 'deletion_request_not_found' using errcode = 'P0002';
  end if;

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
    p_request_id,
    null,
    v_requested.subject_hash,
    'completed',
    null,
    v_requested.privacy_version,
    v_requested.terms_version,
    coalesce(p_metadata,'{}'::jsonb),
    v_completed_at
  )
  on conflict(request_id,event_type) do nothing;

  return jsonb_build_object(
    'requestId',p_request_id,
    'status','completed',
    'completedAt',v_completed_at
  );
end
$$;

revoke all on function public.qelly_set_cloud_sync_consent(boolean,text,text)
  from public, anon, authenticated, service_role;
grant execute on function public.qelly_set_cloud_sync_consent(boolean,text,text)
  to authenticated;

revoke all on function public.qelly_request_account_deletion(text,text,text)
  from public, anon, authenticated, service_role;
grant execute on function public.qelly_request_account_deletion(text,text,text)
  to authenticated;

revoke all on function public.qelly_complete_account_deletion(uuid,jsonb)
  from public, anon, authenticated, service_role;
grant execute on function public.qelly_complete_account_deletion(uuid,jsonb)
  to service_role;

-- Replace remaining direct auth.uid() RLS expressions with init-plan-safe forms.
drop policy if exists qelly_profiles_own_select on public.qelly_profiles;
create policy qelly_profiles_own_select
on public.qelly_profiles for select to authenticated
using (user_id = (select auth.uid()));

drop policy if exists qelly_profiles_own_insert on public.qelly_profiles;
create policy qelly_profiles_own_insert
on public.qelly_profiles for insert to authenticated
with check (user_id = (select auth.uid()));

drop policy if exists qelly_profiles_own_update on public.qelly_profiles;
create policy qelly_profiles_own_update
on public.qelly_profiles for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

drop policy if exists qelly_profiles_own_delete on public.qelly_profiles;
create policy qelly_profiles_own_delete
on public.qelly_profiles for delete to authenticated
using (user_id = (select auth.uid()));

drop policy if exists qelly_workspaces_owner_insert on public.qelly_workspaces;
create policy qelly_workspaces_owner_insert
on public.qelly_workspaces for insert to authenticated
with check (owner_id = (select auth.uid()));

drop policy if exists qelly_workspaces_owner_update on public.qelly_workspaces;
create policy qelly_workspaces_owner_update
on public.qelly_workspaces for update to authenticated
using (owner_id = (select auth.uid()))
with check (owner_id = (select auth.uid()));

drop policy if exists qelly_workspaces_owner_delete on public.qelly_workspaces;
create policy qelly_workspaces_owner_delete
on public.qelly_workspaces for delete to authenticated
using (owner_id = (select auth.uid()));

drop policy if exists qelly_sync_own_select on public.qelly_sync_operations;
create policy qelly_sync_own_select
on public.qelly_sync_operations for select to authenticated
using (owner_id = (select auth.uid()));
drop policy if exists qelly_sync_own_insert on public.qelly_sync_operations;
drop policy if exists qelly_sync_own_update on public.qelly_sync_operations;
drop policy if exists qelly_sync_own_delete on public.qelly_sync_operations;

drop policy if exists qelly_feedback_own_select on public.qelly_feedback;
create policy qelly_feedback_own_select
on public.qelly_feedback for select to authenticated
using (owner_id = (select auth.uid()));

drop policy if exists qelly_feedback_own_insert on public.qelly_feedback;
create policy qelly_feedback_own_insert
on public.qelly_feedback for insert to authenticated
with check (owner_id = (select auth.uid()));

drop policy if exists qelly_deletion_own_select on public.qelly_account_deletion_requests;
create policy qelly_deletion_own_select
on public.qelly_account_deletion_requests for select to authenticated
using (owner_id = (select auth.uid()));
drop policy if exists qelly_deletion_own_insert on public.qelly_account_deletion_requests;
drop policy if exists qelly_deletion_own_update on public.qelly_account_deletion_requests;

-- Browser grants are limited to fields used by the current product surface.
revoke all on table public.qelly_profiles from authenticated;
grant select on table public.qelly_profiles to authenticated;
grant insert (user_id,display_name) on table public.qelly_profiles to authenticated;
grant update (display_name) on table public.qelly_profiles to authenticated;

revoke all on table public.qelly_workspaces from authenticated;
grant select on table public.qelly_workspaces to authenticated;
grant insert (owner_id,name) on table public.qelly_workspaces to authenticated;
grant update (name) on table public.qelly_workspaces to authenticated;

revoke all on table public.qelly_workspace_members from authenticated;
grant select,delete on table public.qelly_workspace_members to authenticated;
grant insert (workspace_id,user_id,role,added_by) on table public.qelly_workspace_members to authenticated;
grant update (role,added_by) on table public.qelly_workspace_members to authenticated;

revoke all on table public.qelly_saved_calculations from authenticated;
grant select on table public.qelly_saved_calculations to authenticated;
grant insert (
  id,workspace_id,owner_id,title,formula_id,input_payload,result_payload,
  provenance,client_updated_at,deleted_at
) on table public.qelly_saved_calculations to authenticated;
grant update (
  title,formula_id,input_payload,result_payload,provenance,client_updated_at,deleted_at
) on table public.qelly_saved_calculations to authenticated;

revoke all on table public.qelly_saved_calculation_revisions from authenticated;
grant select on table public.qelly_saved_calculation_revisions to authenticated;

revoke all on table public.qelly_sync_operations from authenticated;
grant select on table public.qelly_sync_operations to authenticated;

revoke all on table public.qelly_feedback from authenticated;
grant select on table public.qelly_feedback to authenticated;
grant insert (owner_id,category,message,page_path) on table public.qelly_feedback to authenticated;

revoke all on table public.qelly_account_deletion_requests from authenticated;
grant select on table public.qelly_account_deletion_requests to authenticated;

revoke all on table public.qelly_audit_events from authenticated;
grant select on table public.qelly_audit_events to authenticated;

revoke all on table public.qelly_provider_cache from anon,authenticated;

revoke all on table public.qelly_consent_events from anon,authenticated;
grant select on table public.qelly_consent_events to authenticated;

revoke all on table public.qelly_account_deletion_events from anon,authenticated;
grant select on table public.qelly_account_deletion_events to authenticated;

-- Prevent new tables, sequences and functions from inheriting broad browser access.
alter default privileges in schema public
  revoke all on tables from anon,authenticated;
alter default privileges in schema public
  revoke all on sequences from anon,authenticated;
alter default privileges in schema public
  revoke execute on functions from public,anon,authenticated;

commit;
