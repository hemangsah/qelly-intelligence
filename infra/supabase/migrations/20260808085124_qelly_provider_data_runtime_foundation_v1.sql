-- HISTORICAL SOURCE RECOVERY: live migration 20260808085124 qelly_provider_data_runtime_foundation_v1
-- Recovered 2026-08-09 from retained pg_stat_statements + live PostgreSQL catalog.
-- Production already records version 20260808085124. Do not manually replay against current production.

create table public.qelly_providers (
  id uuid primary key default extensions.gen_random_uuid(),
  provider_key text not null unique check (provider_key ~ '^[a-z0-9][a-z0-9_-]{1,63}$'),
  display_name text not null check (length(btrim(display_name)) between 1 and 160),
  provider_type text not null check (provider_type in ('market_data','research','macro','fundamentals','derivatives','onchain','events','reference','internal')),
  lifecycle_status text not null default 'unverified' check (lifecycle_status in ('unverified','verification','integration_ready','active','degraded','disabled','retired')),
  official_docs_url text,
  auth_method text,
  attribution text,
  commercial_rights_status text not null default 'unverified' check (commercial_rights_status in ('unverified','allowed','restricted','prohibited','not_applicable')),
  redistribution_rights_status text not null default 'unverified' check (redistribution_rights_status in ('unverified','allowed','restricted','prohibited','not_applicable')),
  freshness_policy jsonb not null default '{}'::jsonb,
  resilience_policy jsonb not null default '{}'::jsonb,
  coverage jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.qelly_provider_readiness (
  id uuid primary key default extensions.gen_random_uuid(),
  provider_id uuid not null references public.qelly_providers(id) on delete cascade,
  check_name text not null check (check_name in ('official_documentation','current_availability','response_schema','timestamp','freshness','symbol_mapping','venue_mapping','currency','units','null_semantics','pagination','rate_limits','quotas','timeout','retry','circuit_breaker','caching','stale_behavior','cors_delivery_constraints','authentication','terms','attribution','redistribution_rights','commercial_use','monitoring','fallback')),
  status text not null default 'pending' check (status in ('pending','pass','fail','warning','not_applicable')),
  evidence jsonb not null default '{}'::jsonb,
  last_checked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(provider_id,check_name)
);

create table public.qelly_provider_incidents (
  id uuid primary key default extensions.gen_random_uuid(),
  provider_id uuid not null references public.qelly_providers(id) on delete cascade,
  incident_type text not null default 'availability' check (incident_type in ('availability','latency','freshness','schema_drift','quota','auth','licensing','coverage','data_quality','other')),
  severity text not null default 'warning' check (severity in ('info','warning','material','critical')),
  truth_state text not null default 'degraded' check (truth_state in ('fresh','loading','stale','delayed','partial','missing','conflicting','degraded','permission_limited','error')),
  title text not null check (length(btrim(title)) between 1 and 240),
  details jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.qelly_instruments (
  id uuid primary key default extensions.gen_random_uuid(),
  canonical_key text not null unique check (length(btrim(canonical_key)) between 1 and 240),
  symbol text not null check (length(btrim(symbol)) between 1 and 80),
  display_name text,
  asset_class text not null check (asset_class in ('equity','etf','fund','index','fx','crypto','commodity','future','option','bond','rate','macro_series','other')),
  venue text,
  currency text,
  base_asset text,
  quote_asset text,
  contract_spec jsonb not null default '{}'::jsonb,
  identifiers jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.qelly_provider_instrument_mappings (
  id uuid primary key default extensions.gen_random_uuid(),
  provider_id uuid not null references public.qelly_providers(id) on delete cascade,
  instrument_id uuid not null references public.qelly_instruments(id) on delete cascade,
  provider_symbol text not null check (length(btrim(provider_symbol)) between 1 and 240),
  provider_venue text,
  provider_identifier jsonb not null default '{}'::jsonb,
  mapping_status text not null default 'unverified' check (mapping_status in ('unverified','verified','ambiguous','quarantined','retired')),
  mapping_evidence jsonb not null default '{}'::jsonb,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.qelly_timeseries_series (
  id uuid primary key default extensions.gen_random_uuid(),
  series_key text not null unique check (length(btrim(series_key)) between 1 and 320),
  provider_id uuid references public.qelly_providers(id) on delete restrict,
  instrument_id uuid references public.qelly_instruments(id) on delete cascade,
  metric text not null check (length(btrim(metric)) between 1 and 160),
  interval_code text,
  unit text,
  currency text,
  methodology text,
  source_timezone text,
  freshness_policy jsonb not null default '{}'::jsonb,
  lineage jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.qelly_timeseries_points (
  id bigint generated by default as identity primary key,
  series_id uuid not null references public.qelly_timeseries_series(id) on delete cascade,
  observed_at timestamptz not null,
  ingested_at timestamptz not null default now(),
  value_numeric numeric,
  value_json jsonb,
  truth_state text not null default 'fresh' check (truth_state in ('fresh','loading','stale','delayed','partial','missing','conflicting','degraded','permission_limited','error')),
  source_revision text,
  evidence jsonb not null default '{}'::jsonb,
  unique(series_id,observed_at),
  check (value_numeric is not null or value_json is not null)
);

create table public.qelly_data_quality_events (
  id bigint generated by default as identity primary key,
  provider_id uuid references public.qelly_providers(id) on delete set null,
  series_id uuid references public.qelly_timeseries_series(id) on delete set null,
  instrument_id uuid references public.qelly_instruments(id) on delete set null,
  event_type text not null check (event_type in ('missing','stale','delayed','partial','conflicting','schema_drift','unit_mismatch','symbol_mapping','venue_mapping','outlier','duplicate','gap','permission','error','other')),
  severity text not null default 'warning' check (severity in ('info','warning','material','critical')),
  truth_state text not null check (truth_state in ('fresh','loading','stale','delayed','partial','missing','conflicting','degraded','permission_limited','error')),
  details jsonb not null default '{}'::jsonb,
  detected_at timestamptz not null default now(),
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create index qelly_provider_readiness_provider_idx on public.qelly_provider_readiness(provider_id,status,check_name);
create index qelly_provider_incidents_open_idx on public.qelly_provider_incidents(provider_id,severity,started_at desc) where resolved_at is null;
create index qelly_instruments_symbol_idx on public.qelly_instruments(symbol,asset_class,venue) where active;
create unique index qelly_provider_mapping_unique_idx on public.qelly_provider_instrument_mappings(provider_id,provider_symbol,coalesce(provider_venue,''));
create index qelly_provider_mapping_instrument_idx on public.qelly_provider_instrument_mappings(instrument_id,provider_id,mapping_status);
create index qelly_timeseries_series_instrument_idx on public.qelly_timeseries_series(instrument_id,metric,interval_code) where active;
create index qelly_timeseries_points_series_time_idx on public.qelly_timeseries_points(series_id,observed_at desc);
create index qelly_data_quality_open_idx on public.qelly_data_quality_events(severity,detected_at desc) where resolved_at is null;

do $rls$
declare t text;
begin
  foreach t in array array['qelly_providers','qelly_provider_readiness','qelly_provider_incidents','qelly_instruments','qelly_provider_instrument_mappings','qelly_timeseries_series','qelly_timeseries_points','qelly_data_quality_events'] loop
    execute format('alter table public.%I enable row level security',t);
  end loop;
end;
$rls$;

create policy qelly_providers_browser_deny on public.qelly_providers for all to anon,authenticated using (false) with check (false);
create policy qelly_provider_readiness_browser_deny on public.qelly_provider_readiness for all to anon,authenticated using (false) with check (false);
create policy qelly_provider_incidents_browser_deny on public.qelly_provider_incidents for all to anon,authenticated using (false) with check (false);
create policy qelly_provider_mapping_browser_deny on public.qelly_provider_instrument_mappings for all to anon,authenticated using (false) with check (false);
create policy qelly_timeseries_series_browser_deny on public.qelly_timeseries_series for all to anon,authenticated using (false) with check (false);
create policy qelly_timeseries_points_browser_deny on public.qelly_timeseries_points for all to anon,authenticated using (false) with check (false);
create policy qelly_data_quality_browser_deny on public.qelly_data_quality_events for all to anon,authenticated using (false) with check (false);
create policy qelly_instruments_authenticated_select on public.qelly_instruments for select to authenticated using (active=true);

create trigger qelly_providers_updated before update on public.qelly_providers for each row execute function qelly_private.set_updated_at();
create trigger qelly_provider_readiness_updated before update on public.qelly_provider_readiness for each row execute function qelly_private.set_updated_at();
create trigger qelly_instruments_updated before update on public.qelly_instruments for each row execute function qelly_private.set_updated_at();
create trigger qelly_provider_mapping_updated before update on public.qelly_provider_instrument_mappings for each row execute function qelly_private.set_updated_at();
create trigger qelly_timeseries_series_updated before update on public.qelly_timeseries_series for each row execute function qelly_private.set_updated_at();

revoke all on public.qelly_providers,public.qelly_provider_readiness,public.qelly_provider_incidents,public.qelly_provider_instrument_mappings,public.qelly_timeseries_series,public.qelly_timeseries_points,public.qelly_data_quality_events from anon,authenticated;
revoke insert,update,delete on public.qelly_instruments from anon,authenticated;
grant select on public.qelly_instruments to authenticated;
