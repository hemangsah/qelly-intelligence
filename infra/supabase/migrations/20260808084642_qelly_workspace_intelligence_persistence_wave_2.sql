-- HISTORICAL SOURCE RECOVERY: live migration 20260808084642 qelly_workspace_intelligence_persistence_wave_2
-- Recovered 2026-08-09 from retained pg_stat_statements + live PostgreSQL catalog.
-- Production already records version 20260808084642. Do not manually replay against current production.

alter table public.qelly_decisions add column if not exists current_revision integer not null default 1 check (current_revision > 0);

create table public.qelly_decision_revisions (
  id uuid primary key default extensions.gen_random_uuid(),
  decision_id uuid not null references public.qelly_decisions(id) on delete cascade,
  workspace_id uuid not null references public.qelly_workspaces(id) on delete cascade,
  revision_no integer not null check (revision_no > 0),
  snapshot jsonb not null,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  unique(decision_id,revision_no)
);

create table public.qelly_portfolios (
  id uuid primary key default extensions.gen_random_uuid(),
  workspace_id uuid not null references public.qelly_workspaces(id) on delete cascade,
  owner_id uuid not null,
  name text not null check (length(btrim(name)) between 1 and 200),
  base_currency text not null default 'USD' check (length(base_currency) between 3 and 12),
  source_kind text not null default 'user_entered' check (source_kind in ('user_entered','imported')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.qelly_portfolio_positions (
  id uuid primary key default extensions.gen_random_uuid(),
  portfolio_id uuid not null references public.qelly_portfolios(id) on delete cascade,
  workspace_id uuid not null references public.qelly_workspaces(id) on delete cascade,
  owner_id uuid not null,
  instrument_ref text not null check (length(btrim(instrument_ref)) between 1 and 240),
  instrument_type text,
  source_kind text not null default 'user_entered' check (source_kind in ('user_entered','imported')),
  input_payload jsonb not null default '{}'::jsonb,
  provenance jsonb not null default '{}'::jsonb,
  observed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(portfolio_id,instrument_ref)
);

create table public.qelly_import_jobs (
  id uuid primary key default extensions.gen_random_uuid(),
  workspace_id uuid not null references public.qelly_workspaces(id) on delete cascade,
  owner_id uuid not null,
  file_name text not null check (length(btrim(file_name)) between 1 and 320),
  import_type text not null default 'portfolio' check (import_type in ('portfolio','research','timeseries','watchlist','generic_dataset')),
  status text not null default 'staged' check (status in ('staged','validating','review_required','accepted','rejected','failed')),
  source_kind text not null default 'user_upload' check (source_kind in ('user_upload','external_reference')),
  schema_mapping jsonb not null default '{}'::jsonb,
  validation_summary jsonb not null default '{}'::jsonb,
  provenance jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create table public.qelly_saved_views (
  id uuid primary key default extensions.gen_random_uuid(),
  workspace_id uuid not null references public.qelly_workspaces(id) on delete cascade,
  owner_id uuid not null,
  name text not null check (length(btrim(name)) between 1 and 180),
  route_id text not null check (length(btrim(route_id)) between 1 and 120),
  view_type text not null default 'table' check (view_type in ('table','chart','dashboard','research','screener','portfolio','provider')),
  query_definition jsonb not null default '{}'::jsonb,
  columns jsonb not null default '[]'::jsonb,
  sort_definition jsonb not null default '[]'::jsonb,
  density text not null default 'comfortable' check (density in ('compact','comfortable','expanded')),
  shared boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.qelly_workspace_comments (
  id uuid primary key default extensions.gen_random_uuid(),
  workspace_id uuid not null references public.qelly_workspaces(id) on delete cascade,
  owner_id uuid not null,
  entity_type text not null check (entity_type in ('research_project','research_evidence','decision','provenance_node','saved_view','watchlist','portfolio')),
  entity_id uuid not null,
  parent_comment_id uuid references public.qelly_workspace_comments(id) on delete cascade,
  body text not null check (length(btrim(body)) between 1 and 10000),
  evidence_refs jsonb not null default '[]'::jsonb,
  status text not null default 'active' check (status in ('active','resolved','deleted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.qelly_review_requests (
  id uuid primary key default extensions.gen_random_uuid(),
  workspace_id uuid not null references public.qelly_workspaces(id) on delete cascade,
  owner_id uuid not null,
  entity_type text not null check (entity_type in ('research_project','research_evidence','decision','saved_view','portfolio')),
  entity_id uuid not null,
  requested_from uuid,
  status text not null default 'open' check (status in ('open','approved','changes_requested','cancelled','closed')),
  note text,
  response_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  closed_at timestamptz
);

create or replace function qelly_private.prepare_research_revision()
returns trigger language plpgsql set search_path=''
as $function$
begin
  if row(old.title,old.status,old.hypothesis,old.confidence,old.invalidation_conditions,old.metadata,old.deleted_at)
     is distinct from row(new.title,new.status,new.hypothesis,new.confidence,new.invalidation_conditions,new.metadata,new.deleted_at)
  then new.current_revision=old.current_revision+1; end if;
  return new;
end;
$function$;

create or replace function qelly_private.capture_research_revision()
returns trigger language plpgsql security definer set search_path=''
as $function$
begin
  if tg_op='INSERT' or new.current_revision is distinct from old.current_revision then
    insert into public.qelly_research_project_revisions(project_id,workspace_id,revision_no,snapshot,created_by)
    values(new.id,new.workspace_id,new.current_revision,
      jsonb_build_object('title',new.title,'status',new.status,'hypothesis',new.hypothesis,'confidence',new.confidence,'invalidationConditions',new.invalidation_conditions,'metadata',new.metadata,'deletedAt',new.deleted_at,'capturedAt',now()),
      coalesce(auth.uid(),new.owner_id))
    on conflict(project_id,revision_no) do nothing;
  end if;
  return null;
end;
$function$;

create or replace function qelly_private.prepare_decision_revision()
returns trigger language plpgsql set search_path=''
as $function$
begin
  if row(old.title,old.status,old.objective,old.alternatives,old.evidence_summary,old.assumptions,old.probabilities,old.risks,old.scenarios,old.counter_evidence,old.rationale,old.review_conditions,old.outcome,old.learning,old.confidence,old.deleted_at)
     is distinct from row(new.title,new.status,new.objective,new.alternatives,new.evidence_summary,new.assumptions,new.probabilities,new.risks,new.scenarios,new.counter_evidence,new.rationale,new.review_conditions,new.outcome,new.learning,new.confidence,new.deleted_at)
  then new.current_revision=old.current_revision+1; end if;
  return new;
end;
$function$;

create or replace function qelly_private.capture_decision_revision()
returns trigger language plpgsql security definer set search_path=''
as $function$
begin
  if tg_op='INSERT' or new.current_revision is distinct from old.current_revision then
    insert into public.qelly_decision_revisions(decision_id,workspace_id,revision_no,snapshot,created_by)
    values(new.id,new.workspace_id,new.current_revision,
      jsonb_build_object('title',new.title,'status',new.status,'objective',new.objective,'alternatives',new.alternatives,'evidenceSummary',new.evidence_summary,'assumptions',new.assumptions,'probabilities',new.probabilities,'risks',new.risks,'scenarios',new.scenarios,'counterEvidence',new.counter_evidence,'rationale',new.rationale,'reviewConditions',new.review_conditions,'outcome',new.outcome,'learning',new.learning,'confidence',new.confidence,'auditId',new.audit_id,'deletedAt',new.deleted_at,'capturedAt',now()),
      coalesce(auth.uid(),new.owner_id))
    on conflict(decision_id,revision_no) do nothing;
  end if;
  return null;
end;
$function$;

create index qelly_decision_revisions_decision_idx on public.qelly_decision_revisions(decision_id,revision_no desc);
create index qelly_portfolios_workspace_idx on public.qelly_portfolios(workspace_id,updated_at desc) where deleted_at is null;
create index qelly_portfolio_positions_portfolio_idx on public.qelly_portfolio_positions(portfolio_id,created_at);
create index qelly_import_jobs_workspace_idx on public.qelly_import_jobs(workspace_id,created_at desc);
create index qelly_saved_views_workspace_idx on public.qelly_saved_views(workspace_id,updated_at desc) where deleted_at is null;
create index qelly_comments_entity_idx on public.qelly_workspace_comments(workspace_id,entity_type,entity_id,created_at);
create index qelly_reviews_workspace_idx on public.qelly_review_requests(workspace_id,status,created_at desc);

alter table public.qelly_decision_revisions enable row level security;
alter table public.qelly_portfolios enable row level security;
alter table public.qelly_portfolio_positions enable row level security;
alter table public.qelly_import_jobs enable row level security;
alter table public.qelly_saved_views enable row level security;
alter table public.qelly_workspace_comments enable row level security;
alter table public.qelly_review_requests enable row level security;

create policy qelly_decision_revisions_member_select on public.qelly_decision_revisions for select to authenticated using ((select qelly_private.workspace_role(workspace_id,(select auth.uid()))) is not null);

create policy qelly_portfolios_member_select on public.qelly_portfolios for select to authenticated using ((select qelly_private.workspace_role(workspace_id,(select auth.uid()))) is not null);
create policy qelly_portfolios_editor_insert on public.qelly_portfolios for insert to authenticated with check (owner_id=(select auth.uid()) and (select qelly_private.workspace_role(workspace_id,(select auth.uid())))=any(array['owner'::text,'editor'::text]));
create policy qelly_portfolios_editor_update on public.qelly_portfolios for update to authenticated using ((select qelly_private.workspace_role(workspace_id,(select auth.uid())))=any(array['owner'::text,'editor'::text])) with check ((select qelly_private.workspace_role(workspace_id,(select auth.uid())))=any(array['owner'::text,'editor'::text]));
create policy qelly_portfolios_owner_delete on public.qelly_portfolios for delete to authenticated using (owner_id=(select auth.uid()) or (select qelly_private.workspace_role(workspace_id,(select auth.uid())))='owner'::text);

create policy qelly_portfolio_positions_member_select on public.qelly_portfolio_positions for select to authenticated using ((select qelly_private.workspace_role(workspace_id,(select auth.uid()))) is not null);
create policy qelly_portfolio_positions_editor_insert on public.qelly_portfolio_positions for insert to authenticated with check (owner_id=(select auth.uid()) and (select qelly_private.workspace_role(workspace_id,(select auth.uid())))=any(array['owner'::text,'editor'::text]));
create policy qelly_portfolio_positions_editor_update on public.qelly_portfolio_positions for update to authenticated using ((select qelly_private.workspace_role(workspace_id,(select auth.uid())))=any(array['owner'::text,'editor'::text])) with check ((select qelly_private.workspace_role(workspace_id,(select auth.uid())))=any(array['owner'::text,'editor'::text]));
create policy qelly_portfolio_positions_owner_delete on public.qelly_portfolio_positions for delete to authenticated using (owner_id=(select auth.uid()) or (select qelly_private.workspace_role(workspace_id,(select auth.uid())))='owner'::text);

create policy qelly_import_jobs_member_select on public.qelly_import_jobs for select to authenticated using ((select qelly_private.workspace_role(workspace_id,(select auth.uid()))) is not null);
create policy qelly_import_jobs_owner_insert on public.qelly_import_jobs for insert to authenticated with check (owner_id=(select auth.uid()) and (select qelly_private.workspace_role(workspace_id,(select auth.uid())))=any(array['owner'::text,'editor'::text]));
create policy qelly_import_jobs_owner_update on public.qelly_import_jobs for update to authenticated using (owner_id=(select auth.uid())) with check (owner_id=(select auth.uid()) and (select qelly_private.workspace_role(workspace_id,(select auth.uid()))) is not null);
create policy qelly_import_jobs_owner_delete on public.qelly_import_jobs for delete to authenticated using (owner_id=(select auth.uid()) or (select qelly_private.workspace_role(workspace_id,(select auth.uid())))='owner'::text);

create policy qelly_saved_views_member_select on public.qelly_saved_views for select to authenticated using ((select qelly_private.workspace_role(workspace_id,(select auth.uid()))) is not null and (shared or owner_id=(select auth.uid()) or (select qelly_private.workspace_role(workspace_id,(select auth.uid())))='owner'::text));
create policy qelly_saved_views_editor_insert on public.qelly_saved_views for insert to authenticated with check (owner_id=(select auth.uid()) and (select qelly_private.workspace_role(workspace_id,(select auth.uid())))=any(array['owner'::text,'editor'::text]));
create policy qelly_saved_views_owner_update on public.qelly_saved_views for update to authenticated using (owner_id=(select auth.uid()) or (select qelly_private.workspace_role(workspace_id,(select auth.uid())))='owner'::text) with check ((select qelly_private.workspace_role(workspace_id,(select auth.uid()))) is not null);
create policy qelly_saved_views_owner_delete on public.qelly_saved_views for delete to authenticated using (owner_id=(select auth.uid()) or (select qelly_private.workspace_role(workspace_id,(select auth.uid())))='owner'::text);

create policy qelly_comments_member_select on public.qelly_workspace_comments for select to authenticated using ((select qelly_private.workspace_role(workspace_id,(select auth.uid()))) is not null);
create policy qelly_comments_member_insert on public.qelly_workspace_comments for insert to authenticated with check (owner_id=(select auth.uid()) and (select qelly_private.workspace_role(workspace_id,(select auth.uid()))) is not null);
create policy qelly_comments_owner_update on public.qelly_workspace_comments for update to authenticated using (owner_id=(select auth.uid()) or (select qelly_private.workspace_role(workspace_id,(select auth.uid())))='owner'::text) with check ((select qelly_private.workspace_role(workspace_id,(select auth.uid()))) is not null);
create policy qelly_comments_owner_delete on public.qelly_workspace_comments for delete to authenticated using (owner_id=(select auth.uid()) or (select qelly_private.workspace_role(workspace_id,(select auth.uid())))='owner'::text);

create policy qelly_reviews_member_select on public.qelly_review_requests for select to authenticated using ((select qelly_private.workspace_role(workspace_id,(select auth.uid()))) is not null);
create policy qelly_reviews_editor_insert on public.qelly_review_requests for insert to authenticated with check (owner_id=(select auth.uid()) and (select qelly_private.workspace_role(workspace_id,(select auth.uid())))=any(array['owner'::text,'editor'::text]));
create policy qelly_reviews_participant_update on public.qelly_review_requests for update to authenticated using (owner_id=(select auth.uid()) or requested_from=(select auth.uid()) or (select qelly_private.workspace_role(workspace_id,(select auth.uid())))='owner'::text) with check ((select qelly_private.workspace_role(workspace_id,(select auth.uid()))) is not null);
create policy qelly_reviews_owner_delete on public.qelly_review_requests for delete to authenticated using (owner_id=(select auth.uid()) or (select qelly_private.workspace_role(workspace_id,(select auth.uid())))='owner'::text);

create trigger qelly_research_20_prepare_revision before update on public.qelly_research_projects for each row execute function qelly_private.prepare_research_revision();
create trigger qelly_research_capture_revision after insert or update on public.qelly_research_projects for each row execute function qelly_private.capture_research_revision();
create trigger qelly_decision_20_prepare_revision before update on public.qelly_decisions for each row execute function qelly_private.prepare_decision_revision();
create trigger qelly_decision_capture_revision after insert or update on public.qelly_decisions for each row execute function qelly_private.capture_decision_revision();

do $trigger$
declare t text;
begin
  foreach t in array array['qelly_portfolios','qelly_portfolio_positions','qelly_import_jobs','qelly_saved_views','qelly_workspace_comments','qelly_review_requests'] loop
    execute format('create trigger %I before update on public.%I for each row execute function qelly_private.prevent_workspace_owner_reassignment()','qelly_'||case t when 'qelly_workspace_comments' then 'comments' when 'qelly_review_requests' then 'reviews' else substring(t from 7) end||'_no_reassign',t);
    execute format('create trigger %I before update on public.%I for each row execute function qelly_private.set_updated_at()','qelly_'||case t when 'qelly_workspace_comments' then 'comments' when 'qelly_review_requests' then 'reviews' else substring(t from 7) end||'_updated',t);
  end loop;
end;
$trigger$;

revoke all on public.qelly_decision_revisions,public.qelly_portfolios,public.qelly_portfolio_positions,public.qelly_import_jobs,public.qelly_saved_views,public.qelly_workspace_comments,public.qelly_review_requests from anon;
grant select,insert,update,delete on public.qelly_portfolios,public.qelly_portfolio_positions,public.qelly_import_jobs,public.qelly_saved_views,public.qelly_workspace_comments,public.qelly_review_requests to authenticated;
grant select on public.qelly_decision_revisions to authenticated;
