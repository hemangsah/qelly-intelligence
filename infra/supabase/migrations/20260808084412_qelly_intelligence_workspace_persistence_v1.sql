-- HISTORICAL SOURCE RECOVERY: live migration 20260808084412 qelly_intelligence_workspace_persistence_v1
-- Recovered 2026-08-09 from retained pg_stat_statements + live PostgreSQL catalog.
-- Production already records version 20260808084412. Do not manually replay against current production.

create or replace function qelly_private.prevent_workspace_owner_reassignment()
returns trigger language plpgsql set search_path=''
as $function$
begin
  if new.workspace_id is distinct from old.workspace_id then
    raise exception 'workspace_reassignment_forbidden' using errcode='42501';
  end if;
  if new.owner_id is distinct from old.owner_id then
    raise exception 'owner_reassignment_forbidden' using errcode='42501';
  end if;
  return new;
end;
$function$;

create table public.qelly_research_projects (
  id uuid primary key default extensions.gen_random_uuid(),
  workspace_id uuid not null references public.qelly_workspaces(id) on delete cascade,
  owner_id uuid not null,
  title text not null check (length(btrim(title)) between 1 and 240),
  status text not null default 'draft' check (status in ('draft','active','review','archived')),
  hypothesis text,
  confidence numeric(5,4) check (confidence is null or (confidence >= 0 and confidence <= 1)),
  invalidation_conditions jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  current_revision integer not null default 1 check (current_revision > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.qelly_research_evidence (
  id uuid primary key default extensions.gen_random_uuid(),
  project_id uuid not null references public.qelly_research_projects(id) on delete cascade,
  workspace_id uuid not null references public.qelly_workspaces(id) on delete cascade,
  owner_id uuid not null,
  evidence_role text not null default 'supporting' check (evidence_role in ('supporting','counter','neutral')),
  title text not null check (length(btrim(title)) between 1 and 320),
  source_type text not null default 'user_entered',
  source_ref text,
  source_url text,
  observed_at timestamptz,
  ingested_at timestamptz not null default now(),
  freshness text not null default 'missing' check (freshness in ('fresh','loading','stale','delayed','partial','missing','conflicting','degraded','permission_limited','error')),
  confidence numeric(5,4) check (confidence is null or (confidence >= 0 and confidence <= 1)),
  coverage numeric(5,4) check (coverage is null or (coverage >= 0 and coverage <= 1)),
  method text,
  assumptions jsonb not null default '[]'::jsonb,
  contradictions jsonb not null default '[]'::jsonb,
  limitations jsonb not null default '[]'::jsonb,
  evidence_version text not null default '1',
  audit_id uuid not null default extensions.gen_random_uuid(),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.qelly_research_project_revisions (
  id uuid primary key default extensions.gen_random_uuid(),
  project_id uuid not null references public.qelly_research_projects(id) on delete cascade,
  workspace_id uuid not null references public.qelly_workspaces(id) on delete cascade,
  revision_no integer not null check (revision_no > 0),
  snapshot jsonb not null,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  unique(project_id, revision_no)
);

create table public.qelly_decisions (
  id uuid primary key default extensions.gen_random_uuid(),
  workspace_id uuid not null references public.qelly_workspaces(id) on delete cascade,
  owner_id uuid not null,
  title text not null check (length(btrim(title)) between 1 and 240),
  status text not null default 'draft' check (status in ('draft','decided','review_due','closed','archived')),
  objective text,
  alternatives jsonb not null default '[]'::jsonb,
  evidence_summary jsonb not null default '{}'::jsonb,
  assumptions jsonb not null default '[]'::jsonb,
  probabilities jsonb not null default '{}'::jsonb,
  risks jsonb not null default '[]'::jsonb,
  scenarios jsonb not null default '[]'::jsonb,
  counter_evidence jsonb not null default '[]'::jsonb,
  rationale text,
  review_conditions jsonb not null default '[]'::jsonb,
  outcome jsonb not null default '{}'::jsonb,
  learning jsonb not null default '{}'::jsonb,
  confidence numeric(5,4) check (confidence is null or (confidence >= 0 and confidence <= 1)),
  audit_id uuid not null default extensions.gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.qelly_provenance_nodes (
  id uuid primary key default extensions.gen_random_uuid(),
  workspace_id uuid not null references public.qelly_workspaces(id) on delete cascade,
  decision_id uuid references public.qelly_decisions(id) on delete cascade,
  owner_id uuid not null,
  node_type text not null check (node_type in ('source','provider_observation','normalized_observation','transformation','metric','chart_event','market_move','news_event','hypothesis','risk_assessment','alternative','decision','alert','portfolio_action','evidence_export','outcome','review')),
  label text not null check (length(btrim(label)) between 1 and 320),
  truth_state text not null default 'missing' check (truth_state in ('fresh','loading','stale','delayed','partial','missing','conflicting','degraded','permission_limited','error')),
  evidence jsonb not null default '{}'::jsonb,
  payload jsonb not null default '{}'::jsonb,
  audit_id uuid not null default extensions.gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.qelly_provenance_edges (
  id uuid primary key default extensions.gen_random_uuid(),
  workspace_id uuid not null references public.qelly_workspaces(id) on delete cascade,
  owner_id uuid not null,
  from_node_id uuid not null references public.qelly_provenance_nodes(id) on delete cascade,
  to_node_id uuid not null references public.qelly_provenance_nodes(id) on delete cascade,
  edge_type text not null check (edge_type in ('derived-from','supports','contradicts','explains','triggered-by','considered-in','rejected-because','leads-to','affects','supersedes','verified-by')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(from_node_id,to_node_id,edge_type),
  check (from_node_id <> to_node_id)
);

create table public.qelly_watchlists (
  id uuid primary key default extensions.gen_random_uuid(),
  workspace_id uuid not null references public.qelly_workspaces(id) on delete cascade,
  owner_id uuid not null,
  name text not null check (length(btrim(name)) between 1 and 160),
  description text,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.qelly_watchlist_items (
  id uuid primary key default extensions.gen_random_uuid(),
  watchlist_id uuid not null references public.qelly_watchlists(id) on delete cascade,
  workspace_id uuid not null references public.qelly_workspaces(id) on delete cascade,
  owner_id uuid not null,
  instrument_ref text not null check (length(btrim(instrument_ref)) between 1 and 240),
  instrument_type text,
  notes text,
  tags text[] not null default '{}'::text[],
  rationale jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(watchlist_id,instrument_ref)
);

create table public.qelly_alert_rules (
  id uuid primary key default extensions.gen_random_uuid(),
  workspace_id uuid not null references public.qelly_workspaces(id) on delete cascade,
  owner_id uuid not null,
  name text not null check (length(btrim(name)) between 1 and 200),
  alert_type text not null check (alert_type in ('price','volume','volatility','funding','open_interest','liquidation','technical','institutional_flow','news','event','confidence_change','provider_disagreement','data_freshness','portfolio_risk')),
  target_type text not null default 'instrument',
  target_ref text,
  condition jsonb not null default '{}'::jsonb,
  delivery_preferences jsonb not null default '{}'::jsonb,
  monitoring_state text not null default 'configuration_only' check (monitoring_state in ('configuration_only','integration_required')),
  evidence_requirement jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index qelly_research_projects_workspace_updated_idx on public.qelly_research_projects(workspace_id,updated_at desc) where deleted_at is null;
create index qelly_research_evidence_project_idx on public.qelly_research_evidence(project_id,created_at desc);
create index qelly_research_evidence_workspace_idx on public.qelly_research_evidence(workspace_id,created_at desc);
create index qelly_research_revisions_project_idx on public.qelly_research_project_revisions(project_id,revision_no desc);
create index qelly_decisions_workspace_updated_idx on public.qelly_decisions(workspace_id,updated_at desc) where deleted_at is null;
create index qelly_provenance_nodes_decision_idx on public.qelly_provenance_nodes(decision_id,created_at);
create index qelly_provenance_nodes_workspace_idx on public.qelly_provenance_nodes(workspace_id,created_at desc);
create index qelly_provenance_edges_workspace_idx on public.qelly_provenance_edges(workspace_id,created_at desc);
create index qelly_watchlists_workspace_idx on public.qelly_watchlists(workspace_id,updated_at desc) where deleted_at is null;
create index qelly_watchlist_items_watchlist_idx on public.qelly_watchlist_items(watchlist_id,created_at);
create index qelly_alert_rules_workspace_idx on public.qelly_alert_rules(workspace_id,updated_at desc) where deleted_at is null;

do $policy$
declare t text;
begin
  foreach t in array array['qelly_research_projects','qelly_research_evidence','qelly_decisions','qelly_provenance_nodes','qelly_provenance_edges','qelly_watchlists','qelly_watchlist_items','qelly_alert_rules'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('create policy %I on public.%I for select to authenticated using ((select qelly_private.workspace_role(workspace_id,(select auth.uid()))) is not null)','qelly_'||substring(t from 7)||'_member_select',t);
    execute format('create policy %I on public.%I for insert to authenticated with check (owner_id=(select auth.uid()) and (select qelly_private.workspace_role(workspace_id,(select auth.uid())))=any(array[''owner''::text,''editor''::text]))','qelly_'||substring(t from 7)||'_editor_insert',t);
    execute format('create policy %I on public.%I for update to authenticated using ((select qelly_private.workspace_role(workspace_id,(select auth.uid())))=any(array[''owner''::text,''editor''::text])) with check ((select qelly_private.workspace_role(workspace_id,(select auth.uid())))=any(array[''owner''::text,''editor''::text]))','qelly_'||substring(t from 7)||'_editor_update',t);
    execute format('create policy %I on public.%I for delete to authenticated using (owner_id=(select auth.uid()) or (select qelly_private.workspace_role(workspace_id,(select auth.uid())))=''owner''::text)','qelly_'||substring(t from 7)||'_owner_delete',t);
  end loop;
end;
$policy$;

alter table public.qelly_research_project_revisions enable row level security;
create policy qelly_research_revisions_member_select on public.qelly_research_project_revisions for select to authenticated using ((select qelly_private.workspace_role(workspace_id,(select auth.uid()))) is not null);

do $trigger$
declare t text;
begin
  foreach t in array array['qelly_research_projects','qelly_research_evidence','qelly_decisions','qelly_provenance_nodes','qelly_watchlists','qelly_watchlist_items','qelly_alert_rules'] loop
    execute format('create trigger %I before update on public.%I for each row execute function qelly_private.prevent_workspace_owner_reassignment()','qelly_'||substring(t from 7)||'_no_reassign',t);
  end loop;
  foreach t in array array['qelly_research_projects','qelly_research_evidence','qelly_decisions','qelly_provenance_nodes','qelly_watchlists','qelly_watchlist_items','qelly_alert_rules'] loop
    execute format('create trigger %I before update on public.%I for each row execute function qelly_private.set_updated_at()','qelly_'||substring(t from 7)||'_updated',t);
  end loop;
  create trigger qelly_provenance_edges_no_reassign before update on public.qelly_provenance_edges for each row execute function qelly_private.prevent_workspace_owner_reassignment();
end;
$trigger$;

revoke all on public.qelly_research_projects,public.qelly_research_evidence,public.qelly_research_project_revisions,public.qelly_decisions,public.qelly_provenance_nodes,public.qelly_provenance_edges,public.qelly_watchlists,public.qelly_watchlist_items,public.qelly_alert_rules from anon;
grant select,insert,update,delete on public.qelly_research_projects,public.qelly_research_evidence,public.qelly_decisions,public.qelly_provenance_nodes,public.qelly_provenance_edges,public.qelly_watchlists,public.qelly_watchlist_items,public.qelly_alert_rules to authenticated;
grant select on public.qelly_research_project_revisions to authenticated;
