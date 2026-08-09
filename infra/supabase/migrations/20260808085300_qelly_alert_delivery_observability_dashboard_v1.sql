-- HISTORICAL SOURCE RECOVERY: live migration 20260808085300 qelly_alert_delivery_observability_dashboard_v1
-- Recovered 2026-08-09 from retained pg_stat_statements + live PostgreSQL catalog.
-- Production already records version 20260808085300. Do not manually replay against current production.

create table public.qelly_alert_events (
  id uuid primary key default extensions.gen_random_uuid(),
  workspace_id uuid not null references public.qelly_workspaces(id) on delete cascade,
  alert_rule_id uuid not null references public.qelly_alert_rules(id) on delete cascade,
  owner_id uuid not null,
  event_status text not null default 'observed' check (event_status in ('observed','suppressed','acknowledged','resolved','invalidated')),
  truth_state text not null check (truth_state in ('fresh','loading','stale','delayed','partial','missing','conflicting','degraded','permission_limited','error')),
  trigger_snapshot jsonb not null default '{}'::jsonb,
  evidence jsonb not null default '{}'::jsonb,
  observed_at timestamptz not null,
  ingested_at timestamptz not null default now(),
  audit_id uuid not null default extensions.gen_random_uuid(),
  created_at timestamptz not null default now()
);

create table public.qelly_notification_deliveries (
  id uuid primary key default extensions.gen_random_uuid(),
  workspace_id uuid not null references public.qelly_workspaces(id) on delete cascade,
  alert_event_id uuid references public.qelly_alert_events(id) on delete cascade,
  recipient_user_id uuid,
  channel text not null check (channel in ('in_app','email','webhook')),
  status text not null default 'queued' check (status in ('queued','sending','sent','failed','suppressed','cancelled')),
  destination_hash text,
  provider_ref text,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  last_error jsonb not null default '{}'::jsonb,
  queued_at timestamptz not null default now(),
  sent_at timestamptz,
  updated_at timestamptz not null default now()
);

create table public.qelly_runtime_jobs (
  id uuid primary key default extensions.gen_random_uuid(),
  workspace_id uuid references public.qelly_workspaces(id) on delete cascade,
  subsystem text not null check (length(btrim(subsystem)) between 1 and 120),
  job_type text not null check (length(btrim(job_type)) between 1 and 120),
  status text not null default 'queued' check (status in ('queued','running','succeeded','failed','cancelled','degraded')),
  truth_state text not null default 'loading' check (truth_state in ('fresh','loading','stale','delayed','partial','missing','conflicting','degraded','permission_limited','error')),
  input_summary jsonb not null default '{}'::jsonb,
  output_summary jsonb not null default '{}'::jsonb,
  error_summary jsonb not null default '{}'::jsonb,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.qelly_release_identity (
  id uuid primary key default extensions.gen_random_uuid(),
  environment text not null check (environment in ('development','preview','staging','production')),
  release_key text not null check (length(btrim(release_key)) between 1 and 200),
  source_revision text,
  schema_version text,
  frontend_version text,
  backend_version text,
  status text not null default 'recorded' check (status in ('recorded','active','superseded','rolled_back','failed')),
  metadata jsonb not null default '{}'::jsonb,
  released_at timestamptz,
  created_at timestamptz not null default now(),
  unique(environment,release_key)
);

create table public.qelly_dashboard_layouts (
  id uuid primary key default extensions.gen_random_uuid(),
  workspace_id uuid not null references public.qelly_workspaces(id) on delete cascade,
  owner_id uuid not null,
  name text not null check (length(btrim(name)) between 1 and 180),
  route_scope text not null default 'dashboard' check (length(btrim(route_scope)) between 1 and 120),
  persona text,
  density text not null default 'comfortable' check (density in ('compact','comfortable','expanded')),
  layout_definition jsonb not null default '{}'::jsonb,
  shared boolean not null default false,
  current_revision integer not null default 1 check (current_revision > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.qelly_dashboard_layout_revisions (
  id uuid primary key default extensions.gen_random_uuid(),
  layout_id uuid not null references public.qelly_dashboard_layouts(id) on delete cascade,
  workspace_id uuid not null references public.qelly_workspaces(id) on delete cascade,
  revision_no integer not null check (revision_no > 0),
  snapshot jsonb not null,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  unique(layout_id,revision_no)
);

create or replace function qelly_private.prepare_dashboard_layout_revision()
returns trigger language plpgsql set search_path=''
as $function$
begin
  if row(old.name,old.route_scope,old.persona,old.density,old.layout_definition,old.shared,old.deleted_at)
     is distinct from row(new.name,new.route_scope,new.persona,new.density,new.layout_definition,new.shared,new.deleted_at)
  then new.current_revision=old.current_revision+1; end if;
  return new;
end;
$function$;

create or replace function qelly_private.capture_dashboard_layout_revision()
returns trigger language plpgsql security definer set search_path=''
as $function$
begin
  if tg_op='INSERT' or new.current_revision is distinct from old.current_revision then
    insert into public.qelly_dashboard_layout_revisions(layout_id,workspace_id,revision_no,snapshot,created_by)
    values(new.id,new.workspace_id,new.current_revision,
      jsonb_build_object('name',new.name,'routeScope',new.route_scope,'persona',new.persona,'density',new.density,'layout',new.layout_definition,'shared',new.shared,'deletedAt',new.deleted_at,'capturedAt',now()),
      coalesce(auth.uid(),new.owner_id))
    on conflict(layout_id,revision_no) do nothing;
  end if;
  return null;
end;
$function$;

create index qelly_alert_events_workspace_idx on public.qelly_alert_events(workspace_id,observed_at desc);
create index qelly_alert_events_rule_idx on public.qelly_alert_events(alert_rule_id,observed_at desc);
create index qelly_notification_delivery_workspace_idx on public.qelly_notification_deliveries(workspace_id,status,queued_at desc);
create index qelly_runtime_jobs_open_idx on public.qelly_runtime_jobs(status,created_at desc) where status=any(array['queued'::text,'running'::text,'failed'::text,'degraded'::text]);
create index qelly_release_identity_env_idx on public.qelly_release_identity(environment,created_at desc);
create index qelly_dashboard_layouts_workspace_idx on public.qelly_dashboard_layouts(workspace_id,updated_at desc) where deleted_at is null;
create index qelly_dashboard_revisions_layout_idx on public.qelly_dashboard_layout_revisions(layout_id,revision_no desc);

alter table public.qelly_alert_events enable row level security;
alter table public.qelly_notification_deliveries enable row level security;
alter table public.qelly_runtime_jobs enable row level security;
alter table public.qelly_release_identity enable row level security;
alter table public.qelly_dashboard_layouts enable row level security;
alter table public.qelly_dashboard_layout_revisions enable row level security;

create policy qelly_alert_events_member_select on public.qelly_alert_events for select to authenticated using ((select qelly_private.workspace_role(workspace_id,(select auth.uid()))) is not null);
create policy qelly_delivery_member_select on public.qelly_notification_deliveries for select to authenticated using ((select qelly_private.workspace_role(workspace_id,(select auth.uid()))) is not null and (recipient_user_id is null or recipient_user_id=(select auth.uid()) or (select qelly_private.workspace_role(workspace_id,(select auth.uid())))='owner'::text));
create policy qelly_runtime_jobs_browser_deny on public.qelly_runtime_jobs for all to anon,authenticated using (false) with check (false);
create policy qelly_release_identity_browser_deny on public.qelly_release_identity for all to anon,authenticated using (false) with check (false);

create policy qelly_dashboard_layouts_member_select on public.qelly_dashboard_layouts for select to authenticated using ((select qelly_private.workspace_role(workspace_id,(select auth.uid()))) is not null and (shared or owner_id=(select auth.uid()) or (select qelly_private.workspace_role(workspace_id,(select auth.uid())))='owner'::text));
create policy qelly_dashboard_layouts_editor_insert on public.qelly_dashboard_layouts for insert to authenticated with check (owner_id=(select auth.uid()) and (select qelly_private.workspace_role(workspace_id,(select auth.uid())))=any(array['owner'::text,'editor'::text]));
create policy qelly_dashboard_layouts_owner_update on public.qelly_dashboard_layouts for update to authenticated using (owner_id=(select auth.uid()) or (select qelly_private.workspace_role(workspace_id,(select auth.uid())))='owner'::text) with check ((select qelly_private.workspace_role(workspace_id,(select auth.uid()))) is not null);
create policy qelly_dashboard_layouts_owner_delete on public.qelly_dashboard_layouts for delete to authenticated using (owner_id=(select auth.uid()) or (select qelly_private.workspace_role(workspace_id,(select auth.uid())))='owner'::text);
create policy qelly_dashboard_revisions_member_select on public.qelly_dashboard_layout_revisions for select to authenticated using ((select qelly_private.workspace_role(workspace_id,(select auth.uid()))) is not null);

create trigger qelly_notification_deliveries_updated before update on public.qelly_notification_deliveries for each row execute function qelly_private.set_updated_at();
create trigger qelly_runtime_jobs_updated before update on public.qelly_runtime_jobs for each row execute function qelly_private.set_updated_at();
create trigger qelly_dashboard_no_reassign before update on public.qelly_dashboard_layouts for each row execute function qelly_private.prevent_workspace_owner_reassignment();
create trigger qelly_dashboard_20_prepare_revision before update on public.qelly_dashboard_layouts for each row execute function qelly_private.prepare_dashboard_layout_revision();
create trigger qelly_dashboard_30_updated before update on public.qelly_dashboard_layouts for each row execute function qelly_private.set_updated_at();
create trigger qelly_dashboard_capture_revision after insert or update on public.qelly_dashboard_layouts for each row execute function qelly_private.capture_dashboard_layout_revision();

revoke all on public.qelly_alert_events,public.qelly_notification_deliveries,public.qelly_runtime_jobs,public.qelly_release_identity from anon,authenticated;
grant select on public.qelly_alert_events,public.qelly_notification_deliveries to authenticated;
revoke all on public.qelly_dashboard_layouts,public.qelly_dashboard_layout_revisions from anon;
grant select,insert,update,delete on public.qelly_dashboard_layouts to authenticated;
grant select on public.qelly_dashboard_layout_revisions to authenticated;
