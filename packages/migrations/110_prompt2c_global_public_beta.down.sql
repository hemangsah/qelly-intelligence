-- Prompt 2C public-beta rollback. Run only after exporting user data and disabling writes.
begin;

drop trigger if exists qelly_calculation_capture_revision on public.qelly_saved_calculations;
drop trigger if exists qelly_calculation_prepare_revision on public.qelly_saved_calculations;
drop trigger if exists qelly_calculation_updated on public.qelly_saved_calculations;
drop trigger if exists qelly_calculation_tenant on public.qelly_saved_calculations;
drop trigger if exists qelly_provider_cache_updated on public.qelly_provider_cache;
drop trigger if exists qelly_workspaces_updated on public.qelly_workspaces;
drop trigger if exists qelly_profiles_updated on public.qelly_profiles;

drop function if exists public.qelly_capture_calculation_revision();
drop function if exists public.qelly_prepare_calculation_revision();
drop function if exists public.qelly_enforce_calculation_tenant();
drop function if exists public.qelly_workspace_role(uuid,uuid);
drop function if exists public.qelly_set_updated_at();

drop table if exists public.qelly_audit_events cascade;
drop table if exists public.qelly_account_deletion_requests cascade;
drop table if exists public.qelly_feedback cascade;
drop table if exists public.qelly_provider_cache cascade;
drop table if exists public.qelly_sync_operations cascade;
drop table if exists public.qelly_saved_calculation_revisions cascade;
drop table if exists public.qelly_saved_calculations cascade;
drop table if exists public.qelly_workspace_members cascade;
drop table if exists public.qelly_workspaces cascade;
drop table if exists public.qelly_profiles cascade;

commit;
