-- Prevent authenticated callers from using the private RLS helper to inspect
-- another user's workspace membership role while preserving the established
-- two-argument signature used by existing policies and tenant triggers.

begin;

create or replace function qelly_private.workspace_role(
  target_workspace uuid,
  target_user uuid default auth.uid()
)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when workspace.owner_id = target_user then 'owner'
    else member.role
  end
  from public.qelly_workspaces workspace
  left join public.qelly_workspace_members member
    on member.workspace_id = workspace.id
   and member.user_id = target_user
  where workspace.id = target_workspace
    and auth.uid() is not null
    and target_user = auth.uid()
  limit 1
$$;

revoke all on function qelly_private.workspace_role(uuid,uuid)
  from public, anon, authenticated, service_role;
grant execute on function qelly_private.workspace_role(uuid,uuid)
  to authenticated;

comment on function qelly_private.workspace_role(uuid,uuid) is
  'RLS helper restricted to the authenticated caller. Explicit target_user values must equal auth.uid().';

notify pgrst, 'reload schema';

commit;
