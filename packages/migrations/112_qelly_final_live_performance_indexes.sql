-- Cover foreign keys identified by the live Supabase performance advisor.
begin;
create index if not exists qelly_workspace_members_added_by_idx on public.qelly_workspace_members(added_by) where added_by is not null;
create index if not exists qelly_revisions_owner_idx on public.qelly_saved_calculation_revisions(owner_id);
create index if not exists qelly_revisions_created_by_idx on public.qelly_saved_calculation_revisions(created_by);
create index if not exists qelly_sync_calculation_idx on public.qelly_sync_operations(calculation_id) where calculation_id is not null;
create index if not exists qelly_feedback_owner_idx on public.qelly_feedback(owner_id) where owner_id is not null;
create index if not exists qelly_audit_actor_idx on public.qelly_audit_events(actor_id) where actor_id is not null;
commit;
