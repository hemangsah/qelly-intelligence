-- Prepare RLS policies for migration 111 without rewriting applied history.
-- This migration is safe both before and after the private-helper hardening.
begin;

create schema if not exists qelly_private;
revoke all on schema qelly_private from public, anon;
grant usage on schema qelly_private to authenticated;

create or replace function qelly_private.workspace_role(
  target_workspace uuid,
  target_user uuid default auth.uid()
)
returns text
language sql
stable
security definer
set search_path=''
as $$
  select case when w.owner_id=target_user then 'owner'
    else (
      select m.role
      from public.qelly_workspace_members m
      where m.workspace_id=w.id and m.user_id=target_user
    )
  end
  from public.qelly_workspaces w
  where w.id=target_workspace
$$;

revoke all on function qelly_private.workspace_role(uuid,uuid) from public, anon;
grant execute on function qelly_private.workspace_role(uuid,uuid) to authenticated;

-- These policies exist both before and after migration 111. Recreate them so
-- no RLS dependency remains on public.qelly_workspace_role.
drop policy if exists qelly_workspaces_member_select on public.qelly_workspaces;
create policy qelly_workspaces_member_select
on public.qelly_workspaces for select to authenticated
using (
  (select qelly_private.workspace_role(id,(select auth.uid()))) is not null
);

drop policy if exists qelly_members_visible on public.qelly_workspace_members;
create policy qelly_members_visible
on public.qelly_workspace_members for select to authenticated
using (
  user_id=(select auth.uid())
  or (select qelly_private.workspace_role(workspace_id,(select auth.uid())))='owner'
);

drop policy if exists qelly_members_owner_insert on public.qelly_workspace_members;
create policy qelly_members_owner_insert
on public.qelly_workspace_members for insert to authenticated
with check (
  (select qelly_private.workspace_role(workspace_id,(select auth.uid())))='owner'
);

drop policy if exists qelly_members_owner_update on public.qelly_workspace_members;
create policy qelly_members_owner_update
on public.qelly_workspace_members for update to authenticated
using (
  (select qelly_private.workspace_role(workspace_id,(select auth.uid())))='owner'
)
with check (
  (select qelly_private.workspace_role(workspace_id,(select auth.uid())))='owner'
);

drop policy if exists qelly_members_owner_delete on public.qelly_workspace_members;
create policy qelly_members_owner_delete
on public.qelly_workspace_members for delete to authenticated
using (
  (select qelly_private.workspace_role(workspace_id,(select auth.uid())))='owner'
);

drop policy if exists qelly_saved_member_select on public.qelly_saved_calculations;
create policy qelly_saved_member_select
on public.qelly_saved_calculations for select to authenticated
using (
  (select qelly_private.workspace_role(workspace_id,(select auth.uid()))) is not null
);

drop policy if exists qelly_revisions_member_select on public.qelly_saved_calculation_revisions;
create policy qelly_revisions_member_select
on public.qelly_saved_calculation_revisions for select to authenticated
using (
  exists (
    select 1
    from public.qelly_saved_calculations c
    where c.id=calculation_id
      and (select qelly_private.workspace_role(c.workspace_id,(select auth.uid()))) is not null
  )
);

drop policy if exists qelly_audit_member_select on public.qelly_audit_events;
create policy qelly_audit_member_select
on public.qelly_audit_events for select to authenticated
using (
  actor_id=(select auth.uid())
  or (
    workspace_id is not null
    and (select qelly_private.workspace_role(workspace_id,(select auth.uid()))) is not null
  )
);

-- Fresh installations still have the three editor policies from migration 109.
-- Existing hardened installations do not; never reintroduce them post-111.
do $transition$
begin
  if to_regprocedure('public.qelly_workspace_role(uuid,uuid)') is not null then
    execute 'drop policy if exists qelly_saved_editor_insert on public.qelly_saved_calculations';
    execute $policy$
      create policy qelly_saved_editor_insert
      on public.qelly_saved_calculations for insert to authenticated
      with check (
        owner_id=(select auth.uid())
        and (select qelly_private.workspace_role(workspace_id,(select auth.uid()))) in ('owner','editor')
      )
    $policy$;

    execute 'drop policy if exists qelly_saved_editor_update on public.qelly_saved_calculations';
    execute $policy$
      create policy qelly_saved_editor_update
      on public.qelly_saved_calculations for update to authenticated
      using (
        (select qelly_private.workspace_role(workspace_id,(select auth.uid()))) in ('owner','editor')
      )
      with check (
        owner_id=(select auth.uid())
        and (select qelly_private.workspace_role(workspace_id,(select auth.uid()))) in ('owner','editor')
      )
    $policy$;

    execute 'drop policy if exists qelly_saved_editor_delete on public.qelly_saved_calculations';
    execute $policy$
      create policy qelly_saved_editor_delete
      on public.qelly_saved_calculations for delete to authenticated
      using (
        owner_id=(select auth.uid())
        and (select qelly_private.workspace_role(workspace_id,(select auth.uid()))) in ('owner','editor')
      )
    $policy$;
  end if;
end
$transition$;

commit;
