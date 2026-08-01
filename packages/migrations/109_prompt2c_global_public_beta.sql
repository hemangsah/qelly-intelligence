-- Qelly Prompt 2C global public beta
-- Supabase-compatible PostgreSQL migration. No seed users, secrets or provider credentials.
begin;

create extension if not exists pgcrypto;

create or replace function public.qelly_set_updated_at()
returns trigger language plpgsql security invoker set search_path=public as $$
begin new.updated_at=now(); return new; end $$;

create table if not exists public.qelly_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text check (display_name is null or char_length(display_name) between 1 and 80),
  cloud_sync_opt_in boolean not null default false,
  privacy_version text not null default '2026-08-01',
  terms_version text not null default '2026-08-01',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.qelly_workspaces (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.qelly_workspace_members (
  workspace_id uuid not null references public.qelly_workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner','editor','viewer')),
  added_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (workspace_id,user_id)
);

create table if not exists public.qelly_saved_calculations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.qelly_workspaces(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 160),
  formula_id text not null check (char_length(formula_id) between 1 and 160),
  input_payload jsonb not null default '{}'::jsonb check (jsonb_typeof(input_payload)='object'),
  result_payload jsonb not null default '{}'::jsonb check (jsonb_typeof(result_payload)='object'),
  provenance jsonb not null default '{}'::jsonb check (jsonb_typeof(provenance)='object'),
  current_revision integer not null default 1 check (current_revision>0),
  client_updated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.qelly_saved_calculation_revisions (
  id uuid primary key default gen_random_uuid(),
  calculation_id uuid not null references public.qelly_saved_calculations(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  revision_no integer not null check (revision_no>0),
  snapshot jsonb not null check (jsonb_typeof(snapshot)='object'),
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (calculation_id,revision_no)
);

create table if not exists public.qelly_sync_operations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  client_operation_id uuid not null,
  calculation_id uuid references public.qelly_saved_calculations(id) on delete cascade,
  operation_type text not null check (operation_type in ('create','update','rename','duplicate','delete','restore','import')),
  base_revision integer check (base_revision is null or base_revision>=0),
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload)='object'),
  status text not null default 'pending' check (status in ('pending','applied','conflict','rejected')),
  rejection_code text,
  created_at timestamptz not null default now(),
  applied_at timestamptz,
  unique (owner_id,client_operation_id)
);

create table if not exists public.qelly_provider_cache (
  id uuid primary key default gen_random_uuid(),
  provider_id text not null,
  cache_key text not null,
  payload jsonb not null,
  truth_state text not null check (truth_state in ('live_provider','delayed_provider','cached_provider','stale_provider')),
  observation_time timestamptz not null,
  ingestion_time timestamptz not null default now(),
  expires_at timestamptz not null,
  stale_until timestamptz not null,
  attribution text,
  license text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider_id,cache_key),
  check (stale_until>=expires_at)
);

create table if not exists public.qelly_feedback (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete set null,
  category text not null check (category in ('bug','accessibility','data-quality','privacy','support','feature')),
  message text not null check (char_length(message) between 10 and 4000),
  page_path text check (page_path is null or char_length(page_path)<=500),
  status text not null default 'new' check (status in ('new','triaged','resolved','rejected')),
  created_at timestamptz not null default now()
);

create table if not exists public.qelly_account_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references auth.users(id) on delete cascade,
  status text not null default 'requested' check (status in ('requested','processing','completed','cancelled')),
  requested_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.qelly_audit_events (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users(id) on delete set null,
  workspace_id uuid references public.qelly_workspaces(id) on delete cascade,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata)='object'),
  created_at timestamptz not null default now()
);

create index if not exists qelly_workspaces_owner_idx on public.qelly_workspaces(owner_id);
create index if not exists qelly_members_user_idx on public.qelly_workspace_members(user_id,workspace_id);
create index if not exists qelly_saved_workspace_updated_idx on public.qelly_saved_calculations(workspace_id,updated_at desc) where deleted_at is null;
create index if not exists qelly_saved_owner_updated_idx on public.qelly_saved_calculations(owner_id,updated_at desc);
create index if not exists qelly_revisions_calc_idx on public.qelly_saved_calculation_revisions(calculation_id,revision_no desc);
create index if not exists qelly_sync_owner_status_idx on public.qelly_sync_operations(owner_id,status,created_at);
create index if not exists qelly_provider_cache_expiry_idx on public.qelly_provider_cache(expires_at,stale_until);
create index if not exists qelly_feedback_created_idx on public.qelly_feedback(created_at desc);
create index if not exists qelly_audit_workspace_created_idx on public.qelly_audit_events(workspace_id,created_at desc);

create or replace function public.qelly_workspace_role(target_workspace uuid,target_user uuid default auth.uid())
returns text language sql stable security definer set search_path=public as $$
  select case
    when w.owner_id=target_user then 'owner'
    else (select m.role from public.qelly_workspace_members m where m.workspace_id=w.id and m.user_id=target_user)
  end
  from public.qelly_workspaces w where w.id=target_workspace
$$;
revoke all on function public.qelly_workspace_role(uuid,uuid) from public;
grant execute on function public.qelly_workspace_role(uuid,uuid) to authenticated;

create or replace function public.qelly_enforce_calculation_tenant()
returns trigger language plpgsql security definer set search_path=public as $$
declare workspace_owner uuid; member_role text;
begin
  select owner_id into workspace_owner from public.qelly_workspaces where id=new.workspace_id;
  if workspace_owner is null then raise exception 'workspace_not_found' using errcode='23503'; end if;
  select public.qelly_workspace_role(new.workspace_id,new.owner_id) into member_role;
  if member_role is null then raise exception 'calculation_owner_not_workspace_member' using errcode='42501'; end if;
  return new;
end $$;

create or replace function public.qelly_capture_calculation_revision()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if tg_op='INSERT' then
    insert into public.qelly_saved_calculation_revisions(calculation_id,owner_id,revision_no,snapshot,created_by)
    values(new.id,new.owner_id,new.current_revision,jsonb_build_object('title',new.title,'formulaId',new.formula_id,'input',new.input_payload,'result',new.result_payload,'provenance',new.provenance,'deletedAt',new.deleted_at),new.owner_id)
    on conflict do nothing;
  elsif row(old.title,old.input_payload,old.result_payload,old.provenance,old.deleted_at) is distinct from row(new.title,new.input_payload,new.result_payload,new.provenance,new.deleted_at) then
    new.current_revision=old.current_revision+1;
    insert into public.qelly_saved_calculation_revisions(calculation_id,owner_id,revision_no,snapshot,created_by)
    values(new.id,new.owner_id,new.current_revision,jsonb_build_object('title',new.title,'formulaId',new.formula_id,'input',new.input_payload,'result',new.result_payload,'provenance',new.provenance,'deletedAt',new.deleted_at),coalesce(auth.uid(),new.owner_id));
  end if;
  return new;
end $$;

create trigger qelly_profiles_updated before update on public.qelly_profiles for each row execute function public.qelly_set_updated_at();
create trigger qelly_workspaces_updated before update on public.qelly_workspaces for each row execute function public.qelly_set_updated_at();
create trigger qelly_provider_cache_updated before update on public.qelly_provider_cache for each row execute function public.qelly_set_updated_at();
create trigger qelly_calculation_tenant before insert or update of workspace_id,owner_id on public.qelly_saved_calculations for each row execute function public.qelly_enforce_calculation_tenant();
create trigger qelly_calculation_revision before insert or update on public.qelly_saved_calculations for each row execute function public.qelly_capture_calculation_revision();
create trigger qelly_calculation_updated before update on public.qelly_saved_calculations for each row execute function public.qelly_set_updated_at();

alter table public.qelly_profiles enable row level security;
alter table public.qelly_workspaces enable row level security;
alter table public.qelly_workspace_members enable row level security;
alter table public.qelly_saved_calculations enable row level security;
alter table public.qelly_saved_calculation_revisions enable row level security;
alter table public.qelly_sync_operations enable row level security;
alter table public.qelly_provider_cache enable row level security;
alter table public.qelly_feedback enable row level security;
alter table public.qelly_account_deletion_requests enable row level security;
alter table public.qelly_audit_events enable row level security;

create policy qelly_profiles_own_select on public.qelly_profiles for select to authenticated using (user_id=auth.uid());
create policy qelly_profiles_own_insert on public.qelly_profiles for insert to authenticated with check (user_id=auth.uid());
create policy qelly_profiles_own_update on public.qelly_profiles for update to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid());
create policy qelly_profiles_own_delete on public.qelly_profiles for delete to authenticated using (user_id=auth.uid());

create policy qelly_workspaces_member_select on public.qelly_workspaces for select to authenticated using (public.qelly_workspace_role(id,auth.uid()) is not null);
create policy qelly_workspaces_owner_insert on public.qelly_workspaces for insert to authenticated with check (owner_id=auth.uid());
create policy qelly_workspaces_owner_update on public.qelly_workspaces for update to authenticated using (owner_id=auth.uid()) with check (owner_id=auth.uid());
create policy qelly_workspaces_owner_delete on public.qelly_workspaces for delete to authenticated using (owner_id=auth.uid());

create policy qelly_members_visible on public.qelly_workspace_members for select to authenticated using (user_id=auth.uid() or public.qelly_workspace_role(workspace_id,auth.uid())='owner');
create policy qelly_members_owner_insert on public.qelly_workspace_members for insert to authenticated with check (public.qelly_workspace_role(workspace_id,auth.uid())='owner');
create policy qelly_members_owner_update on public.qelly_workspace_members for update to authenticated using (public.qelly_workspace_role(workspace_id,auth.uid())='owner') with check (public.qelly_workspace_role(workspace_id,auth.uid())='owner');
create policy qelly_members_owner_delete on public.qelly_workspace_members for delete to authenticated using (public.qelly_workspace_role(workspace_id,auth.uid())='owner');

create policy qelly_saved_member_select on public.qelly_saved_calculations for select to authenticated using (public.qelly_workspace_role(workspace_id,auth.uid()) is not null);
create policy qelly_saved_editor_insert on public.qelly_saved_calculations for insert to authenticated with check (owner_id=auth.uid() and public.qelly_workspace_role(workspace_id,auth.uid()) in ('owner','editor'));
create policy qelly_saved_editor_update on public.qelly_saved_calculations for update to authenticated using (public.qelly_workspace_role(workspace_id,auth.uid()) in ('owner','editor')) with check (owner_id=auth.uid() and public.qelly_workspace_role(workspace_id,auth.uid()) in ('owner','editor'));
create policy qelly_saved_editor_delete on public.qelly_saved_calculations for delete to authenticated using (owner_id=auth.uid() and public.qelly_workspace_role(workspace_id,auth.uid()) in ('owner','editor'));

create policy qelly_revisions_member_select on public.qelly_saved_calculation_revisions for select to authenticated using (exists(select 1 from public.qelly_saved_calculations c where c.id=calculation_id and public.qelly_workspace_role(c.workspace_id,auth.uid()) is not null));
create policy qelly_sync_own_select on public.qelly_sync_operations for select to authenticated using (owner_id=auth.uid());
create policy qelly_sync_own_insert on public.qelly_sync_operations for insert to authenticated with check (owner_id=auth.uid());
create policy qelly_sync_own_update on public.qelly_sync_operations for update to authenticated using (owner_id=auth.uid()) with check (owner_id=auth.uid());
create policy qelly_sync_own_delete on public.qelly_sync_operations for delete to authenticated using (owner_id=auth.uid());

create policy qelly_feedback_own_select on public.qelly_feedback for select to authenticated using (owner_id=auth.uid());
create policy qelly_feedback_own_insert on public.qelly_feedback for insert to authenticated with check (owner_id=auth.uid());
create policy qelly_deletion_own_select on public.qelly_account_deletion_requests for select to authenticated using (owner_id=auth.uid());
create policy qelly_deletion_own_insert on public.qelly_account_deletion_requests for insert to authenticated with check (owner_id=auth.uid());
create policy qelly_deletion_own_update on public.qelly_account_deletion_requests for update to authenticated using (owner_id=auth.uid()) with check (owner_id=auth.uid());
create policy qelly_audit_member_select on public.qelly_audit_events for select to authenticated using (actor_id=auth.uid() or (workspace_id is not null and public.qelly_workspace_role(workspace_id,auth.uid()) is not null));

-- qelly_provider_cache and audit-event inserts intentionally have no browser write policy.
-- Service-role operations bypass RLS only from server/edge secret stores.

commit;
