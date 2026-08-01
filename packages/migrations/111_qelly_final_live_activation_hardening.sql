-- Qelly final live activation hardening.
-- Apply after migrations 109 and 110. No seed users, secrets or paid resources.
begin;

create schema if not exists qelly_private;
revoke all on schema qelly_private from public, anon;
grant usage on schema qelly_private to authenticated;

-- Replace exposed helper functions/triggers with private-schema equivalents.
drop trigger if exists qelly_calculation_revision on public.qelly_saved_calculations;
drop trigger if exists qelly_calculation_prepare_revision on public.qelly_saved_calculations;
drop trigger if exists qelly_calculation_capture_revision on public.qelly_saved_calculations;
drop trigger if exists qelly_calculation_tenant on public.qelly_saved_calculations;
drop trigger if exists qelly_calculation_updated on public.qelly_saved_calculations;
drop trigger if exists qelly_profiles_updated on public.qelly_profiles;
drop trigger if exists qelly_workspaces_updated on public.qelly_workspaces;
drop trigger if exists qelly_provider_cache_updated on public.qelly_provider_cache;
drop function if exists public.qelly_capture_calculation_revision();
drop function if exists public.qelly_prepare_calculation_revision();
drop function if exists public.qelly_enforce_calculation_tenant();
drop function if exists public.qelly_workspace_role(uuid,uuid);
drop function if exists public.qelly_set_updated_at();

create or replace function qelly_private.set_updated_at()
returns trigger language plpgsql security invoker set search_path='' as $$
begin new.updated_at=now(); return new; end $$;

create or replace function qelly_private.workspace_role(target_workspace uuid,target_user uuid default auth.uid())
returns text language sql stable security definer set search_path='' as $$
  select case when w.owner_id=target_user then 'owner'
    else (select m.role from public.qelly_workspace_members m where m.workspace_id=w.id and m.user_id=target_user)
  end from public.qelly_workspaces w where w.id=target_workspace
$$;

create or replace function qelly_private.enforce_calculation_tenant()
returns trigger language plpgsql security definer set search_path='' as $$
declare member_role text;
begin
  select qelly_private.workspace_role(new.workspace_id,new.owner_id) into member_role;
  if member_role is null then raise exception 'calculation_owner_not_workspace_member' using errcode='42501'; end if;
  return new;
end $$;

create or replace function qelly_private.prevent_calculation_reassignment()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
  if new.owner_id is distinct from old.owner_id or new.workspace_id is distinct from old.workspace_id then
    raise exception 'calculation_tenant_is_immutable' using errcode='42501';
  end if;
  return new;
end $$;

create or replace function qelly_private.prepare_calculation_revision()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
  if row(old.title,old.formula_id,old.input_payload,old.result_payload,old.provenance,old.deleted_at)
     is distinct from row(new.title,new.formula_id,new.input_payload,new.result_payload,new.provenance,new.deleted_at)
  then new.current_revision=old.current_revision+1; end if;
  return new;
end $$;

create or replace function qelly_private.capture_calculation_revision()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if tg_op='INSERT' or new.current_revision is distinct from old.current_revision then
    insert into public.qelly_saved_calculation_revisions(calculation_id,owner_id,revision_no,snapshot,created_by)
    values(new.id,new.owner_id,new.current_revision,
      jsonb_build_object('title',new.title,'formulaId',new.formula_id,'input',new.input_payload,'result',new.result_payload,'provenance',new.provenance,'deletedAt',new.deleted_at,'capturedAt',now()),
      coalesce(auth.uid(),new.owner_id))
    on conflict(calculation_id,revision_no) do nothing;
  end if;
  return null;
end $$;

create or replace function qelly_private.bootstrap_user()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  insert into public.qelly_profiles(user_id,display_name)
  values(new.id,nullif(coalesce(new.raw_user_meta_data->>'display_name',split_part(coalesce(new.email,''),'@',1)),''))
  on conflict(user_id) do nothing;
  insert into public.qelly_workspaces(owner_id,name)
  select new.id,'My Qelly Workspace'
  where not exists(select 1 from public.qelly_workspaces where owner_id=new.id);
  return new;
end $$;

revoke all on all functions in schema qelly_private from public, anon;
grant execute on function qelly_private.workspace_role(uuid,uuid) to authenticated;

create trigger qelly_profiles_updated before update on public.qelly_profiles for each row execute function qelly_private.set_updated_at();
create trigger qelly_workspaces_updated before update on public.qelly_workspaces for each row execute function qelly_private.set_updated_at();
create trigger qelly_provider_cache_updated before update on public.qelly_provider_cache for each row execute function qelly_private.set_updated_at();
create trigger qelly_calculation_tenant before insert on public.qelly_saved_calculations for each row execute function qelly_private.enforce_calculation_tenant();
create trigger qelly_10_calculation_no_reassign before update on public.qelly_saved_calculations for each row execute function qelly_private.prevent_calculation_reassignment();
create trigger qelly_20_calculation_prepare_revision before update on public.qelly_saved_calculations for each row execute function qelly_private.prepare_calculation_revision();
create trigger qelly_30_calculation_updated before update on public.qelly_saved_calculations for each row execute function qelly_private.set_updated_at();
create trigger qelly_calculation_capture_revision after insert or update on public.qelly_saved_calculations for each row execute function qelly_private.capture_calculation_revision();
drop trigger if exists qelly_auth_user_bootstrap on auth.users;
create trigger qelly_auth_user_bootstrap after insert on auth.users for each row execute function qelly_private.bootstrap_user();

-- Require the authenticated user to remain the immutable calculation owner.
drop policy if exists qelly_saved_editor_insert on public.qelly_saved_calculations;
drop policy if exists qelly_saved_editor_update on public.qelly_saved_calculations;
drop policy if exists qelly_saved_editor_delete on public.qelly_saved_calculations;
drop policy if exists qelly_saved_owner_insert on public.qelly_saved_calculations;
drop policy if exists qelly_saved_owner_update on public.qelly_saved_calculations;
drop policy if exists qelly_saved_owner_delete on public.qelly_saved_calculations;
create policy qelly_saved_owner_insert on public.qelly_saved_calculations for insert to authenticated
with check(owner_id=(select auth.uid()) and (select qelly_private.workspace_role(workspace_id,(select auth.uid()))) in('owner','editor'));
create policy qelly_saved_owner_update on public.qelly_saved_calculations for update to authenticated
using(owner_id=(select auth.uid()) and (select qelly_private.workspace_role(workspace_id,(select auth.uid()))) in('owner','editor'))
with check(owner_id=(select auth.uid()) and (select qelly_private.workspace_role(workspace_id,(select auth.uid()))) in('owner','editor'));
create policy qelly_saved_owner_delete on public.qelly_saved_calculations for delete to authenticated
using(owner_id=(select auth.uid()) and (select qelly_private.workspace_role(workspace_id,(select auth.uid()))) in('owner','editor'));

-- Least-privilege browser grants. Provider cache stays server-only.
revoke all on all tables in schema public from anon;
grant select,insert,update,delete on public.qelly_profiles,public.qelly_workspaces,public.qelly_workspace_members,public.qelly_saved_calculations,public.qelly_sync_operations to authenticated;
grant select on public.qelly_saved_calculation_revisions,public.qelly_audit_events to authenticated;
grant select,insert on public.qelly_feedback to authenticated;
grant select,insert,update on public.qelly_account_deletion_requests to authenticated;
revoke all on public.qelly_provider_cache from anon,authenticated;

-- Backfill only real existing Auth users; no synthetic identities are committed.
insert into public.qelly_profiles(user_id,display_name)
select id,nullif(coalesce(raw_user_meta_data->>'display_name',split_part(coalesce(email,''),'@',1)),'') from auth.users
on conflict(user_id) do nothing;
insert into public.qelly_workspaces(owner_id,name)
select u.id,'My Qelly Workspace' from auth.users u
where not exists(select 1 from public.qelly_workspaces w where w.owner_id=u.id);

commit;
