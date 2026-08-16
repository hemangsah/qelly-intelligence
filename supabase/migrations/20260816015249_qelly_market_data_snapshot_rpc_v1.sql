create or replace function public.qelly_market_data_snapshot(p_limit integer default 100)
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

revoke all on function public.qelly_market_data_snapshot(integer) from public;
revoke all on function public.qelly_market_data_snapshot(integer) from anon;
grant execute on function public.qelly_market_data_snapshot(integer) to authenticated;

comment on function public.qelly_market_data_snapshot(integer) is
  'Authenticated read-only governed market snapshot. Bypasses raw-table browser-deny RLS only inside this constrained projection; does not expose provider cache payloads or enable execution.';
