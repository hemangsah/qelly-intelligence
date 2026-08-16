create or replace function public.qelly_timeseries_history(p_identifier text, p_limit integer default 90)
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

revoke all on function public.qelly_timeseries_history(text,integer) from public;
revoke all on function public.qelly_timeseries_history(text,integer) from anon;
grant execute on function public.qelly_timeseries_history(text,integer) to authenticated;

comment on function public.qelly_timeseries_history(text,integer) is
  'Authenticated bounded read-only time-series history projection over governed Qelly observations; raw provider cache and privileged storage remain inaccessible.';
