create table if not exists public.qelly_decision_setups (
  id uuid primary key default extensions.gen_random_uuid(),
  workspace_id uuid not null references public.qelly_workspaces(id) on delete cascade,
  owner_id uuid not null,
  source_setup_id text not null check (length(btrim(source_setup_id)) between 1 and 240),
  source_graph_id text,
  asset text not null check (asset in ('BTC','ETH','SOL','HYPE','XRP','DOGE')),
  timeframe text not null check (timeframe in ('1m','5m','15m','30m','1h','4h','1d')),
  horizon text not null check (horizon in ('1h','4h','12h','1d','3d','7d')),
  direction text not null check (direction in ('BUY','SELL')),
  created_observed_at timestamptz not null,
  last_observed_at timestamptz not null,
  expiry_at timestamptz,
  latest_status text not null check (latest_status in ('FORMING','VALID','TRIGGERED','ACTIVE','WEAKENING','T1_REACHED','T2_REACHED','T3_REACHED','T4_REACHED','INVALIDATED','EXPIRED','NO_TRADE')),
  resolved_at timestamptz,
  entry jsonb not null,
  stop jsonb not null,
  invalidation jsonb not null default '{}'::jsonb,
  targets jsonb not null default '[]'::jsonb,
  requested_rr text not null,
  selected_rr numeric(10,4),
  evidence_snapshot jsonb not null default '{}'::jsonb,
  calibration_snapshot jsonb not null default '{}'::jsonb,
  regime text,
  event_risk_state text,
  resolved_outcome jsonb not null default '{"state":"OPEN"}'::jsonb,
  metrics jsonb not null default '{}'::jsonb,
  provenance jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(workspace_id,source_setup_id)
);

create table if not exists public.qelly_decision_setup_observations (
  id uuid primary key default extensions.gen_random_uuid(),
  setup_id uuid not null references public.qelly_decision_setups(id) on delete cascade,
  workspace_id uuid not null references public.qelly_workspaces(id) on delete cascade,
  owner_id uuid not null,
  observed_at timestamptz not null,
  status text not null check (status in ('FORMING','VALID','TRIGGERED','ACTIVE','WEAKENING','T1_REACHED','T2_REACHED','T3_REACHED','T4_REACHED','INVALIDATED','EXPIRED','NO_TRADE')),
  market jsonb not null default '{}'::jsonb,
  evidence_snapshot jsonb not null default '{}'::jsonb,
  target_events jsonb not null default '[]'::jsonb,
  invalidation_event jsonb,
  metrics jsonb not null default '{}'::jsonb,
  resolution jsonb not null default '{"state":"OPEN"}'::jsonb,
  provenance jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(setup_id,observed_at,status)
);

create index if not exists qelly_decision_setups_workspace_created_idx on public.qelly_decision_setups(workspace_id,created_observed_at desc);
create index if not exists qelly_decision_setups_workspace_status_idx on public.qelly_decision_setups(workspace_id,latest_status,last_observed_at desc);
create index if not exists qelly_decision_setup_observations_setup_idx on public.qelly_decision_setup_observations(setup_id,observed_at asc);

alter table public.qelly_decision_setups enable row level security;
alter table public.qelly_decision_setup_observations enable row level security;

drop policy if exists qelly_decision_setups_member_select on public.qelly_decision_setups;
create policy qelly_decision_setups_member_select on public.qelly_decision_setups for select to authenticated
using ((select qelly_private.workspace_role(workspace_id,(select auth.uid()))) is not null);

drop policy if exists qelly_decision_setups_editor_insert on public.qelly_decision_setups;
create policy qelly_decision_setups_editor_insert on public.qelly_decision_setups for insert to authenticated
with check (owner_id=(select auth.uid()) and (select qelly_private.workspace_role(workspace_id,(select auth.uid())))=any(array['owner'::text,'editor'::text]));

drop policy if exists qelly_decision_setups_editor_update on public.qelly_decision_setups;
create policy qelly_decision_setups_editor_update on public.qelly_decision_setups for update to authenticated
using ((select qelly_private.workspace_role(workspace_id,(select auth.uid())))=any(array['owner'::text,'editor'::text]))
with check ((select qelly_private.workspace_role(workspace_id,(select auth.uid())))=any(array['owner'::text,'editor'::text]));

drop policy if exists qelly_decision_setups_owner_delete on public.qelly_decision_setups;
create policy qelly_decision_setups_owner_delete on public.qelly_decision_setups for delete to authenticated
using (owner_id=(select auth.uid()) or (select qelly_private.workspace_role(workspace_id,(select auth.uid())))='owner'::text);

drop policy if exists qelly_decision_setup_observations_member_select on public.qelly_decision_setup_observations;
create policy qelly_decision_setup_observations_member_select on public.qelly_decision_setup_observations for select to authenticated
using ((select qelly_private.workspace_role(workspace_id,(select auth.uid()))) is not null);

drop policy if exists qelly_decision_setup_observations_editor_insert on public.qelly_decision_setup_observations;
create policy qelly_decision_setup_observations_editor_insert on public.qelly_decision_setup_observations for insert to authenticated
with check (
  owner_id=(select auth.uid())
  and (select qelly_private.workspace_role(workspace_id,(select auth.uid())))=any(array['owner'::text,'editor'::text])
  and exists (select 1 from public.qelly_decision_setups setup where setup.id=setup_id and setup.workspace_id=workspace_id)
);

drop trigger if exists qelly_decision_setups_no_reassign on public.qelly_decision_setups;
create trigger qelly_decision_setups_no_reassign before update on public.qelly_decision_setups
for each row execute function qelly_private.prevent_workspace_owner_reassignment();

drop trigger if exists qelly_decision_setups_updated on public.qelly_decision_setups;
create trigger qelly_decision_setups_updated before update on public.qelly_decision_setups
for each row execute function qelly_private.set_updated_at();

revoke all on public.qelly_decision_setups,public.qelly_decision_setup_observations from anon;
grant select,insert,update,delete on public.qelly_decision_setups to authenticated;
grant select,insert on public.qelly_decision_setup_observations to authenticated;
