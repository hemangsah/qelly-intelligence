-- Wave BK: remove directly exposed SECURITY DEFINER read RPCs.
-- Keep raw governed tables browser-denied. Privileged implementations live in
-- qelly_private; public Data API functions are SECURITY INVOKER wrappers only.

begin;

create or replace function qelly_private.qelly_market_data_snapshot(p_limit integer default 100)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $$
declare
  v_actor uuid := auth.uid();
  v_limit integer := greatest(1, least(coalesce(p_limit, 100), 200));
  v_snapshot jsonb;
begin
  if v_actor is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'generatedAt', now(),
    'truthBoundary', 'Governed read-only observations. Provider truth state, observation time and rights remain attached to every returned value.',
    'execution', false,
    'dataPlane', jsonb_build_object(
      'instrumentCount', (select count(*) from public.qelly_instruments where active is true),
      'providerMappingCount', (select count(*) from public.qelly_provider_instrument_mappings),
      'seriesCount', (select count(*) from public.qelly_timeseries_series where active is true),
      'pointCount', (select count(*) from public.qelly_timeseries_points),
      'providerCacheCount', (select count(*) from public.qelly_provider_cache),
      'openQualityEventCount', (select count(*) from public.qelly_data_quality_events where resolved_at is null),
      'releaseIdentityCount', (select count(*) from public.qelly_release_identity),
      'latestObservedAt', (select max(observed_at) from public.qelly_timeseries_points),
      'latestIngestedAt', (select max(ingested_at) from public.qelly_timeseries_points)
    ),
    'providers', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'providerKey', p.provider_key,
          'displayName', p.display_name,
          'providerType', p.provider_type,
          'lifecycleStatus', p.lifecycle_status,
          'commercialRightsStatus', p.commercial_rights_status,
          'redistributionRightsStatus', p.redistribution_rights_status,
          'attribution', p.attribution,
          'verifiedAt', p.verified_at,
          'readiness', coalesce((
            select jsonb_agg(
              jsonb_build_object(
                'checkName', r.check_name,
                'status', r.status,
                'lastCheckedAt', r.last_checked_at
              ) order by r.check_name
            )
            from public.qelly_provider_readiness r
            where r.provider_id = p.id
          ), '[]'::jsonb)
        ) order by p.provider_key
      )
      from public.qelly_providers p
    ), '[]'::jsonb),
    'items', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'instrumentId', q.instrument_id,
          'canonicalKey', q.canonical_key,
          'symbol', q.symbol,
          'displayName', q.display_name,
          'assetClass', q.asset_class,
          'venue', q.venue,
          'currency', q.currency,
          'baseAsset', q.base_asset,
          'quoteAsset', q.quote_asset,
          'seriesId', q.series_id,
          'seriesKey', q.series_key,
          'metric', q.metric,
          'interval', q.interval_code,
          'unit', q.unit,
          'observedAt', q.observed_at,
          'ingestedAt', q.ingested_at,
          'value', q.value_numeric,
          'truthState', upper(q.truth_state),
          'sourceRevision', q.source_revision,
          'evidence', q.evidence
        ) order by q.symbol, q.series_key
      )
      from (
        select
          i.id as instrument_id,
          i.canonical_key,
          i.symbol,
          i.display_name,
          i.asset_class,
          i.venue,
          i.currency,
          i.base_asset,
          i.quote_asset,
          s.id as series_id,
          s.series_key,
          s.metric,
          s.interval_code,
          s.unit,
          lp.observed_at,
          lp.ingested_at,
          lp.value_numeric,
          lp.truth_state,
          lp.source_revision,
          lp.evidence
        from public.qelly_instruments i
        join public.qelly_timeseries_series s on s.instrument_id = i.id and s.active is true
        join lateral (
          select tp.observed_at,tp.ingested_at,tp.value_numeric,tp.truth_state,tp.source_revision,tp.evidence
          from public.qelly_timeseries_points tp
          where tp.series_id = s.id
          order by tp.observed_at desc,tp.id desc
          limit 1
        ) lp on true
        where i.active is true
        order by i.symbol,s.series_key
        limit v_limit
      ) q
    ), '[]'::jsonb),
    'quality', jsonb_build_object(
      'openCount', (select count(*) from public.qelly_data_quality_events where resolved_at is null),
      'recent', coalesce((
        select jsonb_agg(jsonb_build_object(
          'eventType', d.event_type,
          'severity', d.severity,
          'truthState', upper(d.truth_state),
          'detectedAt', d.detected_at,
          'resolvedAt', d.resolved_at
        ) order by d.detected_at desc)
        from (
          select event_type,severity,truth_state,detected_at,resolved_at
          from public.qelly_data_quality_events
          order by detected_at desc
          limit 20
        ) d
      ), '[]'::jsonb)
    ),
    'releaseIdentity', (
      select jsonb_build_object(
        'environment', r.environment,
        'releaseKey', r.release_key,
        'sourceRevision', r.source_revision,
        'schemaVersion', r.schema_version,
        'frontendVersion', r.frontend_version,
        'backendVersion', r.backend_version,
        'status', r.status,
        'releasedAt', r.released_at
      )
      from public.qelly_release_identity r
      order by r.released_at desc nulls last,r.created_at desc
      limit 1
    )
  ) into v_snapshot;

  return v_snapshot;
end
$$;

revoke all on function qelly_private.qelly_market_data_snapshot(integer)
  from public, anon, authenticated, service_role;
grant execute on function qelly_private.qelly_market_data_snapshot(integer)
  to authenticated;

create or replace function public.qelly_market_data_snapshot(p_limit integer default 100)
returns jsonb
language sql
stable
security invoker
set search_path to ''
as $$
  select qelly_private.qelly_market_data_snapshot($1)
$$;

revoke all on function public.qelly_market_data_snapshot(integer)
  from public, anon, authenticated, service_role;
grant execute on function public.qelly_market_data_snapshot(integer)
  to authenticated;

comment on function qelly_private.qelly_market_data_snapshot(integer) is
  'Privileged authenticated read-only implementation over browser-denied governed market tables. Not exposed through the public Data API schema.';
comment on function public.qelly_market_data_snapshot(integer) is
  'Authenticated SECURITY INVOKER wrapper for the private governed market snapshot implementation.';

create or replace function qelly_private.qelly_timeseries_history(p_identifier text, p_limit integer default 90)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $$
declare
  v_actor uuid := auth.uid();
  v_identifier text := trim(coalesce(p_identifier,''));
  v_limit integer := greatest(2, least(coalesce(p_limit,90),400));
  v_series record;
  v_result jsonb;
begin
  if v_actor is null then
    raise exception 'authentication_required' using errcode='42501';
  end if;
  if length(v_identifier) < 2 or length(v_identifier) > 200 then
    return jsonb_build_object('found',false,'reason','invalid_identifier','execution',false);
  end if;

  select
    s.id as series_id,s.series_key,s.metric,s.interval_code,s.unit,s.currency,s.methodology,s.source_timezone,s.freshness_policy,s.lineage,
    i.id as instrument_id,i.canonical_key,i.symbol,i.display_name,i.asset_class,i.venue,i.base_asset,i.quote_asset,
    p.provider_key,p.display_name as provider_name,p.commercial_rights_status,p.redistribution_rights_status,p.attribution
  into v_series
  from public.qelly_timeseries_series s
  join public.qelly_instruments i on i.id=s.instrument_id
  join public.qelly_providers p on p.id=s.provider_id
  where s.active is true and i.active is true and (
    lower(s.series_key)=lower(v_identifier) or
    lower(i.canonical_key)=lower(v_identifier) or
    upper(i.symbol)=upper(v_identifier)
  )
  order by case when upper(i.symbol)=upper(v_identifier) then 0 when lower(i.canonical_key)=lower(v_identifier) then 1 else 2 end,s.created_at
  limit 1;

  if v_series.series_id is null then
    return jsonb_build_object('found',false,'identifier',v_identifier,'reason','timeseries_not_found','execution',false);
  end if;

  select jsonb_build_object(
    'found',true,
    'generatedAt',now(),
    'truthBoundary','Governed provider observations for research/reference use. Reference-rate history is not an executable price series.',
    'execution',false,
    'instrument',jsonb_build_object(
      'instrumentId',v_series.instrument_id,
      'canonicalKey',v_series.canonical_key,
      'symbol',v_series.symbol,
      'displayName',v_series.display_name,
      'assetClass',v_series.asset_class,
      'venue',v_series.venue,
      'baseAsset',v_series.base_asset,
      'quoteAsset',v_series.quote_asset
    ),
    'series',jsonb_build_object(
      'seriesId',v_series.series_id,
      'seriesKey',v_series.series_key,
      'metric',v_series.metric,
      'interval',v_series.interval_code,
      'unit',v_series.unit,
      'currency',v_series.currency,
      'methodology',v_series.methodology,
      'sourceTimezone',v_series.source_timezone,
      'freshnessPolicy',v_series.freshness_policy,
      'lineage',v_series.lineage
    ),
    'provider',jsonb_build_object(
      'providerKey',v_series.provider_key,
      'displayName',v_series.provider_name,
      'commercialRightsStatus',v_series.commercial_rights_status,
      'redistributionRightsStatus',v_series.redistribution_rights_status,
      'attribution',v_series.attribution
    ),
    'points',coalesce((
      select jsonb_agg(jsonb_build_object(
        'observedAt',q.observed_at,
        'ingestedAt',q.ingested_at,
        'value',q.value_numeric,
        'truthState',upper(q.truth_state),
        'sourceRevision',q.source_revision,
        'evidence',q.evidence
      ) order by q.observed_at)
      from (
        select tp.observed_at,tp.ingested_at,tp.value_numeric,tp.truth_state,tp.source_revision,tp.evidence
        from public.qelly_timeseries_points tp
        where tp.series_id=v_series.series_id
        order by tp.observed_at desc,tp.id desc
        limit v_limit
      ) q
    ),'[]'::jsonb)
  ) into v_result;

  return v_result;
end
$$;

revoke all on function qelly_private.qelly_timeseries_history(text,integer)
  from public, anon, authenticated, service_role;
grant execute on function qelly_private.qelly_timeseries_history(text,integer)
  to authenticated;

create or replace function public.qelly_timeseries_history(
  p_identifier text,
  p_limit integer default 90
)
returns jsonb
language sql
stable
security invoker
set search_path to ''
as $$
  select qelly_private.qelly_timeseries_history($1,$2)
$$;

revoke all on function public.qelly_timeseries_history(text,integer)
  from public, anon, authenticated, service_role;
grant execute on function public.qelly_timeseries_history(text,integer)
  to authenticated;

comment on function qelly_private.qelly_timeseries_history(text,integer) is
  'Privileged authenticated bounded history implementation over browser-denied governed time-series tables. Not exposed through the public Data API schema.';
comment on function public.qelly_timeseries_history(text,integer) is
  'Authenticated SECURITY INVOKER wrapper for the private governed time-series history implementation.';

notify pgrst, 'reload schema';

commit;
