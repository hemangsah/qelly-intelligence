-- HISTORICAL SOURCE RECOVERY: live migration 20260808091443 qelly_theme_intelligence_persistence_v1
-- Recovered 2026-08-09 from retained pg_stat_statements + live PostgreSQL catalog.
-- Production already records version 20260808091443. Do not manually replay against current production.

create table public.qelly_theme_presets (
  id uuid primary key default extensions.gen_random_uuid(),
  workspace_id uuid not null references public.qelly_workspaces(id) on delete cascade,
  owner_id uuid not null,
  name text not null check (length(btrim(name)) between 1 and 180),
  scope text not null default 'user' check (scope in ('user','workspace')),
  theme_family text not null check (theme_family in ('Sovereign Obsidian','Porcelain Signal','Crimson Vector','Obsidian Strike','White Heat','Ember Protocol','Arctic Quant','Emerald Conviction','Cobalt Circuit','Violet Oracle','Gold Dominion','Monochrome Ledger','Signal Access')),
  appearance_mode text not null default 'Dark' check (appearance_mode in ('Dark','Porcelain / Light','OLED','High Contrast','System','Scheduled')),
  persona text not null check (persona in ('Scalper Velocity','Investor Compound','Aggressive Alpha','Quant Operator','Research Oracle','Signal Access')),
  mindset text,
  alpha_level text check (alpha_level is null or alpha_level in ('Focused Edge','Tactical Surge','Conviction Strike','Redline Apex')),
  alpha_pack text check (alpha_pack is null or alpha_pack in ('Crimson Vector','Obsidian Strike','White Heat','Ember Protocol','Apex Monochrome','Scarlet Circuit')),
  accent_hex text check (accent_hex is null or accent_hex ~ '^#[0-9A-Fa-f]{6}$'),
  density text not null default 'comfortable' check (density in ('compact','comfortable','expanded')),
  motion text not null default 'standard' check (motion in ('none','reduced','standard','expressive')),
  surface_depth text not null default 'balanced' check (surface_depth in ('flat','subtle','balanced','layered')),
  corner_style text not null default 'curved' check (corner_style in ('square','soft','curved','pill')),
  contrast_mode text not null default 'standard' check (contrast_mode in ('standard','enhanced','high')),
  chart_palette text not null default 'protected-semantics',
  table_emphasis text not null default 'balanced',
  config jsonb not null default '{}'::jsonb,
  validation jsonb not null default '{}'::jsonb,
  current_revision integer not null default 1 check (current_revision > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.qelly_theme_preset_revisions (
  id uuid primary key default extensions.gen_random_uuid(),
  preset_id uuid not null references public.qelly_theme_presets(id) on delete cascade,
  workspace_id uuid not null references public.qelly_workspaces(id) on delete cascade,
  revision_no integer not null check (revision_no > 0),
  snapshot jsonb not null,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  unique(preset_id,revision_no)
);

create table public.qelly_theme_schedules (
  id uuid primary key default extensions.gen_random_uuid(),
  workspace_id uuid not null references public.qelly_workspaces(id) on delete cascade,
  owner_id uuid not null,
  preset_id uuid not null references public.qelly_theme_presets(id) on delete cascade,
  enabled boolean not null default false,
  schedule_type text not null default 'manual_time' check (schedule_type in ('manual_time','system','sunrise_sunset')),
  timezone text not null default 'UTC',
  start_local_time time,
  end_local_time time,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function qelly_private.prepare_theme_preset_revision()
returns trigger language plpgsql set search_path=''
as $function$
begin
  if row(old.name,old.scope,old.theme_family,old.appearance_mode,old.persona,old.mindset,old.alpha_level,old.alpha_pack,old.accent_hex,old.density,old.motion,old.surface_depth,old.corner_style,old.contrast_mode,old.chart_palette,old.table_emphasis,old.config,old.validation,old.deleted_at)
     is distinct from row(new.name,new.scope,new.theme_family,new.appearance_mode,new.persona,new.mindset,new.alpha_level,new.alpha_pack,new.accent_hex,new.density,new.motion,new.surface_depth,new.corner_style,new.contrast_mode,new.chart_palette,new.table_emphasis,new.config,new.validation,new.deleted_at)
  then new.current_revision=old.current_revision+1; end if;
  return new;
end;
$function$;

create or replace function qelly_private.capture_theme_preset_revision()
returns trigger language plpgsql security definer set search_path=''
as $function$
begin
  if tg_op='INSERT' or new.current_revision is distinct from old.current_revision then
    insert into public.qelly_theme_preset_revisions(preset_id,workspace_id,revision_no,snapshot,created_by)
    values(new.id,new.workspace_id,new.current_revision,
      jsonb_build_object('name',new.name,'scope',new.scope,'themeFamily',new.theme_family,'appearanceMode',new.appearance_mode,'persona',new.persona,'mindset',new.mindset,'alphaLevel',new.alpha_level,'alphaPack',new.alpha_pack,'accentHex',new.accent_hex,'density',new.density,'motion',new.motion,'surfaceDepth',new.surface_depth,'cornerStyle',new.corner_style,'contrastMode',new.contrast_mode,'chartPalette',new.chart_palette,'tableEmphasis',new.table_emphasis,'config',new.config,'validation',new.validation,'deletedAt',new.deleted_at,'capturedAt',now()),
      coalesce(auth.uid(),new.owner_id))
    on conflict(preset_id,revision_no) do nothing;
  end if;
  return null;
end;
$function$;

create index qelly_theme_presets_workspace_idx on public.qelly_theme_presets(workspace_id,updated_at desc) where deleted_at is null;
create index qelly_theme_revisions_preset_idx on public.qelly_theme_preset_revisions(preset_id,revision_no desc);
create index qelly_theme_schedules_workspace_idx on public.qelly_theme_schedules(workspace_id,enabled,updated_at desc);

alter table public.qelly_theme_presets enable row level security;
alter table public.qelly_theme_preset_revisions enable row level security;
alter table public.qelly_theme_schedules enable row level security;

create policy qelly_theme_presets_member_select on public.qelly_theme_presets for select to authenticated using ((select qelly_private.workspace_role(workspace_id,(select auth.uid()))) is not null and (scope='workspace'::text or owner_id=(select auth.uid()) or (select qelly_private.workspace_role(workspace_id,(select auth.uid())))='owner'::text));
create policy qelly_theme_presets_editor_insert on public.qelly_theme_presets for insert to authenticated with check (owner_id=(select auth.uid()) and (select qelly_private.workspace_role(workspace_id,(select auth.uid())))=any(array['owner'::text,'editor'::text]) and (scope='user'::text or (select qelly_private.workspace_role(workspace_id,(select auth.uid())))='owner'::text));
create policy qelly_theme_presets_owner_update on public.qelly_theme_presets for update to authenticated using (owner_id=(select auth.uid()) or (select qelly_private.workspace_role(workspace_id,(select auth.uid())))='owner'::text) with check ((select qelly_private.workspace_role(workspace_id,(select auth.uid()))) is not null and (scope='user'::text or (select qelly_private.workspace_role(workspace_id,(select auth.uid())))='owner'::text));
create policy qelly_theme_presets_owner_delete on public.qelly_theme_presets for delete to authenticated using (owner_id=(select auth.uid()) or (select qelly_private.workspace_role(workspace_id,(select auth.uid())))='owner'::text);
create policy qelly_theme_revisions_member_select on public.qelly_theme_preset_revisions for select to authenticated using ((select qelly_private.workspace_role(workspace_id,(select auth.uid()))) is not null);
create policy qelly_theme_schedules_member_select on public.qelly_theme_schedules for select to authenticated using ((select qelly_private.workspace_role(workspace_id,(select auth.uid()))) is not null and (owner_id=(select auth.uid()) or (select qelly_private.workspace_role(workspace_id,(select auth.uid())))='owner'::text));
create policy qelly_theme_schedules_owner_insert on public.qelly_theme_schedules for insert to authenticated with check (owner_id=(select auth.uid()) and (select qelly_private.workspace_role(workspace_id,(select auth.uid()))) is not null);
create policy qelly_theme_schedules_owner_update on public.qelly_theme_schedules for update to authenticated using (owner_id=(select auth.uid()) or (select qelly_private.workspace_role(workspace_id,(select auth.uid())))='owner'::text) with check ((select qelly_private.workspace_role(workspace_id,(select auth.uid()))) is not null);
create policy qelly_theme_schedules_owner_delete on public.qelly_theme_schedules for delete to authenticated using (owner_id=(select auth.uid()) or (select qelly_private.workspace_role(workspace_id,(select auth.uid())))='owner'::text);

create trigger qelly_theme_presets_no_reassign before update on public.qelly_theme_presets for each row execute function qelly_private.prevent_workspace_owner_reassignment();
create trigger qelly_theme_presets_20_prepare_revision before update on public.qelly_theme_presets for each row execute function qelly_private.prepare_theme_preset_revision();
create trigger qelly_theme_presets_30_updated before update on public.qelly_theme_presets for each row execute function qelly_private.set_updated_at();
create trigger qelly_theme_presets_capture_revision after insert or update on public.qelly_theme_presets for each row execute function qelly_private.capture_theme_preset_revision();
create trigger qelly_theme_schedules_no_reassign before update on public.qelly_theme_schedules for each row execute function qelly_private.prevent_workspace_owner_reassignment();
create trigger qelly_theme_schedules_updated before update on public.qelly_theme_schedules for each row execute function qelly_private.set_updated_at();

revoke all on public.qelly_theme_presets,public.qelly_theme_preset_revisions,public.qelly_theme_schedules from anon;
grant select,insert,update,delete on public.qelly_theme_presets,public.qelly_theme_schedules to authenticated;
grant select on public.qelly_theme_preset_revisions to authenticated;
