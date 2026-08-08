create table public.qelly_verify_assessments (
  id uuid primary key default extensions.gen_random_uuid(),
  workspace_id uuid not null references public.qelly_workspaces(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 180),
  source_name text not null default 'Local strategy CSV' check (char_length(source_name) <= 180),
  source_fingerprint text not null check (source_fingerprint ~ '^[a-f0-9]{64}$'),
  source_normalized_bytes bigint check (source_normalized_bytes is null or source_normalized_bytes >= 0),
  source_revision text not null,
  methodology_version text not null,
  engine_version text not null,
  report_schema text not null,
  truth_state text not null check (truth_state = 'DETERMINISTIC LOCAL EVIDENCE'),
  report_payload jsonb not null check (jsonb_typeof(report_payload) = 'object'),
  report_hash text not null check (report_hash ~ '^[a-f0-9]{64}$'),
  current_revision integer not null default 1 check (current_revision > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint qelly_verify_no_raw_rows check (not (report_payload ? 'trades') and not (report_payload ? 'csv') and not (report_payload ? 'sourceText'))
);

create index qelly_verify_assessments_workspace_idx on public.qelly_verify_assessments(workspace_id, updated_at desc) where deleted_at is null;
create index qelly_verify_assessments_owner_idx on public.qelly_verify_assessments(owner_id, updated_at desc) where deleted_at is null;
create index qelly_verify_assessments_source_fp_idx on public.qelly_verify_assessments(source_fingerprint);

create table public.qelly_verify_assessment_revisions (
  id uuid primary key default extensions.gen_random_uuid(),
  assessment_id uuid not null references public.qelly_verify_assessments(id) on delete cascade,
  workspace_id uuid not null references public.qelly_workspaces(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  revision integer not null check (revision > 0),
  report_hash text not null check (report_hash ~ '^[a-f0-9]{64}$'),
  snapshot jsonb not null check (jsonb_typeof(snapshot) = 'object'),
  created_at timestamptz not null default now(),
  unique (assessment_id, revision)
);

create index qelly_verify_revisions_assessment_idx on public.qelly_verify_assessment_revisions(assessment_id, revision desc);
create index qelly_verify_revisions_workspace_idx on public.qelly_verify_assessment_revisions(workspace_id, created_at desc);

alter table public.qelly_verify_assessments enable row level security;
alter table public.qelly_verify_assessment_revisions enable row level security;

revoke all on public.qelly_verify_assessments from anon;
revoke all on public.qelly_verify_assessment_revisions from anon;
revoke all on public.qelly_verify_assessment_revisions from authenticated;
grant select, insert, update, delete on public.qelly_verify_assessments to authenticated;
grant select on public.qelly_verify_assessment_revisions to authenticated;

create policy qelly_verify_member_select on public.qelly_verify_assessments
for select to authenticated
using ((select qelly_private.workspace_role(workspace_id, (select auth.uid()))) is not null);

create policy qelly_verify_editor_insert on public.qelly_verify_assessments
for insert to authenticated
with check (
  owner_id = (select auth.uid())
  and (select qelly_private.workspace_role(workspace_id, (select auth.uid()))) = any (array['owner'::text,'editor'::text])
);

create policy qelly_verify_editor_update on public.qelly_verify_assessments
for update to authenticated
using ((select qelly_private.workspace_role(workspace_id, (select auth.uid()))) = any (array['owner'::text,'editor'::text]))
with check ((select qelly_private.workspace_role(workspace_id, (select auth.uid()))) = any (array['owner'::text,'editor'::text]));

create policy qelly_verify_owner_delete on public.qelly_verify_assessments
for delete to authenticated
using (owner_id = (select auth.uid()) or (select qelly_private.workspace_role(workspace_id, (select auth.uid()))) = 'owner'::text);

create policy qelly_verify_revisions_member_select on public.qelly_verify_assessment_revisions
for select to authenticated
using ((select qelly_private.workspace_role(workspace_id, (select auth.uid()))) is not null);

create or replace function qelly_private.prepare_verify_assessment_revision()
returns trigger
language plpgsql
set search_path=''
as $function$
begin
  new.current_revision := old.current_revision + 1;
  return new;
end;
$function$;

create or replace function qelly_private.capture_verify_assessment_revision()
returns trigger
language plpgsql
security definer
set search_path=''
as $function$
begin
  insert into public.qelly_verify_assessment_revisions(
    assessment_id, workspace_id, owner_id, revision, report_hash, snapshot
  ) values (
    new.id,
    new.workspace_id,
    new.owner_id,
    new.current_revision,
    new.report_hash,
    to_jsonb(new)
  );
  return new;
end;
$function$;

revoke all on function qelly_private.prepare_verify_assessment_revision() from public, anon, authenticated;
revoke all on function qelly_private.capture_verify_assessment_revision() from public, anon, authenticated;

drop trigger if exists qelly_verify_assessments_no_reassign on public.qelly_verify_assessments;
create trigger qelly_verify_assessments_no_reassign
before update on public.qelly_verify_assessments
for each row execute function qelly_private.prevent_workspace_owner_reassignment();

drop trigger if exists qelly_verify_20_prepare_revision on public.qelly_verify_assessments;
create trigger qelly_verify_20_prepare_revision
before update on public.qelly_verify_assessments
for each row execute function qelly_private.prepare_verify_assessment_revision();

drop trigger if exists qelly_verify_assessments_updated on public.qelly_verify_assessments;
create trigger qelly_verify_assessments_updated
before update on public.qelly_verify_assessments
for each row execute function qelly_private.set_updated_at();

drop trigger if exists qelly_verify_capture_revision on public.qelly_verify_assessments;
create trigger qelly_verify_capture_revision
after insert or update on public.qelly_verify_assessments
for each row execute function qelly_private.capture_verify_assessment_revision();
