create or replace function qelly_private.jsonb_string_array_bounded(p_value jsonb, p_max_items integer, p_max_chars integer)
returns boolean
language sql
immutable
set search_path=''
as $function$
  select case
    when jsonb_typeof(p_value) is distinct from 'array' then false
    when jsonb_array_length(p_value) > p_max_items then false
    else not exists (
      select 1
      from jsonb_array_elements(p_value) as item(value)
      where jsonb_typeof(item.value) is distinct from 'string'
         or char_length(item.value #>> '{}') > p_max_chars
    )
  end;
$function$;

revoke all on function qelly_private.jsonb_string_array_bounded(jsonb, integer, integer) from public, anon, authenticated;

create or replace function qelly_private.validate_verify_assessment_payload_shape()
returns trigger
language plpgsql
set search_path=''
as $function$
declare
  v_top_allowed text[] := array[
    'schema','reportId','generatedAt','methodologyVersion','engineVersion','product','title','truthState',
    'source','executiveSummary','dataQuality','evidenceCoverage','performance','sample','scores','observedRisk',
    'internalStability','sequenceStress','allocationResearch','warnings','failureConditions','limitations','provenance'
  ]::text[];
  v_source jsonb;
  v_fingerprint jsonb;
  v_sample jsonb;
  v_performance jsonb;
  v_scores jsonb;
  v_object jsonb;
  v_key text;
begin
  if octet_length(new.report_payload::text) > 262144 then
    raise exception 'verify_report_payload_too_large' using errcode='23514';
  end if;

  if not (new.report_payload ?& v_top_allowed)
     or (new.report_payload - v_top_allowed) <> '{}'::jsonb then
    raise exception 'verify_report_top_level_shape_invalid' using errcode='23514';
  end if;

  if new.report_schema is distinct from 'qelly.strategy-evidence-report/1.0.0'
     or new.methodology_version is distinct from 'qelly-verify-methodology/1.0.0'
     or new.engine_version is distinct from 'qelly-verify-local-engine/1.1.0'
     or new.source_revision is distinct from 'c92e6bc36ba5cdb09b4868bfce149e939e25dd9f' then
    raise exception 'verify_governed_version_not_allowed' using errcode='23514';
  end if;

  if new.report_payload->>'product' is distinct from 'Qelly Verify'
     or new.report_payload->>'title' is distinct from 'Qelly Strategy Evidence Report' then
    raise exception 'verify_report_identity_invalid' using errcode='23514';
  end if;

  v_source := new.report_payload->'source';
  if jsonb_typeof(v_source) is distinct from 'object'
     or not (v_source ?& array['name','fingerprint','uploaded','retained','processingBoundary']::text[])
     or (v_source - array['name','fingerprint','uploaded','retained','processingBoundary']::text[]) <> '{}'::jsonb then
    raise exception 'verify_source_shape_invalid' using errcode='23514';
  end if;

  v_fingerprint := v_source->'fingerprint';
  if jsonb_typeof(v_fingerprint) is distinct from 'object'
     or not (v_fingerprint ?& array['algorithm','value','normalizedBytes']::text[])
     or (v_fingerprint - array['algorithm','value','normalizedBytes']::text[]) <> '{}'::jsonb then
    raise exception 'verify_fingerprint_shape_invalid' using errcode='23514';
  end if;

  v_sample := new.report_payload->'sample';
  if jsonb_typeof(v_sample) is distinct from 'object'
     or not (v_sample ?& array['trades','wins','losses','flat']::text[])
     or (v_sample - array['trades','wins','losses','flat']::text[]) <> '{}'::jsonb then
    raise exception 'verify_sample_shape_invalid' using errcode='23514';
  end if;
  foreach v_key in array array['trades','wins','losses','flat']::text[] loop
    if jsonb_typeof(v_sample->v_key) is distinct from 'number' then
      raise exception 'verify_sample_numeric_shape_invalid' using errcode='23514';
    end if;
  end loop;

  v_performance := new.report_payload->'performance';
  if jsonb_typeof(v_performance) is distinct from 'object'
     or not (v_performance ?& array['netProfit','grossProfit','grossLoss','winRate','averageWin','averageLoss','payoffRatio','expectancy','profitFactor','returnDispersion','maxDrawdown','longestLosingStreak','firstHalfExpectancy','secondHalfExpectancy','topThreeConcentration']::text[])
     or (v_performance - array['netProfit','grossProfit','grossLoss','winRate','averageWin','averageLoss','payoffRatio','expectancy','profitFactor','returnDispersion','maxDrawdown','longestLosingStreak','firstHalfExpectancy','secondHalfExpectancy','topThreeConcentration']::text[]) <> '{}'::jsonb then
    raise exception 'verify_performance_shape_invalid' using errcode='23514';
  end if;
  foreach v_key in array array['netProfit','grossProfit','grossLoss','winRate','averageWin','averageLoss','expectancy','returnDispersion','maxDrawdown','longestLosingStreak','firstHalfExpectancy','secondHalfExpectancy','topThreeConcentration']::text[] loop
    if jsonb_typeof(v_performance->v_key) is distinct from 'number' then
      raise exception 'verify_performance_numeric_shape_invalid' using errcode='23514';
    end if;
  end loop;
  foreach v_key in array array['payoffRatio','profitFactor']::text[] loop
    if jsonb_typeof(v_performance->v_key) not in ('number','null') then
      raise exception 'verify_performance_nullable_numeric_shape_invalid' using errcode='23514';
    end if;
  end loop;

  v_scores := new.report_payload->'scores';
  if jsonb_typeof(v_scores) is distinct from 'object'
     or not (v_scores ?& array['strategyQuality','robustness','overfittingRisk']::text[])
     or (v_scores - array['strategyQuality','robustness','overfittingRisk']::text[]) <> '{}'::jsonb then
    raise exception 'verify_scores_shape_invalid' using errcode='23514';
  end if;
  foreach v_key in array array['strategyQuality','robustness','overfittingRisk']::text[] loop
    v_object := v_scores->v_key;
    if jsonb_typeof(v_object) is distinct from 'object'
       or not (v_object ?& array['value','band']::text[])
       or (v_object - array['value','band']::text[]) <> '{}'::jsonb
       or jsonb_typeof(v_object->'value') is distinct from 'number'
       or jsonb_typeof(v_object->'band') is distinct from 'string' then
      raise exception 'verify_score_component_shape_invalid' using errcode='23514';
    end if;
  end loop;

  v_object := new.report_payload->'observedRisk';
  if jsonb_typeof(v_object) is distinct from 'object'
     or not (v_object ?& array['maxDrawdown','longestLosingStreak','topThreeConcentration','returnDispersion','state']::text[])
     or (v_object - array['maxDrawdown','longestLosingStreak','topThreeConcentration','returnDispersion','state']::text[]) <> '{}'::jsonb then
    raise exception 'verify_observed_risk_shape_invalid' using errcode='23514';
  end if;

  v_object := new.report_payload->'internalStability';
  if jsonb_typeof(v_object) is distinct from 'object'
     or not (v_object ?& array['firstHalfExpectancy','secondHalfExpectancy','robustnessScore','overfittingRisk','state','boundary']::text[])
     or (v_object - array['firstHalfExpectancy','secondHalfExpectancy','robustnessScore','overfittingRisk','state','boundary']::text[]) <> '{}'::jsonb then
    raise exception 'verify_internal_stability_shape_invalid' using errcode='23514';
  end if;

  v_object := new.report_payload->'sequenceStress';
  if jsonb_typeof(v_object) is distinct from 'object'
     or not (v_object ?& array['iterations','medianMaxDrawdown','stressMaxDrawdown','stressLosingStreak','state','method']::text[])
     or (v_object - array['iterations','medianMaxDrawdown','stressMaxDrawdown','stressLosingStreak','state','method']::text[]) <> '{}'::jsonb then
    raise exception 'verify_sequence_stress_shape_invalid' using errcode='23514';
  end if;

  v_object := new.report_payload->'allocationResearch';
  if jsonb_typeof(v_object) is distinct from 'object'
     or not (v_object ?& array['rawKelly','constrainedFractionalKellyLow','constrainedFractionalKellyHigh','status','state','boundary']::text[])
     or (v_object - array['rawKelly','constrainedFractionalKellyLow','constrainedFractionalKellyHigh','status','state','boundary']::text[]) <> '{}'::jsonb then
    raise exception 'verify_allocation_shape_invalid' using errcode='23514';
  end if;

  v_object := new.report_payload->'dataQuality';
  if jsonb_typeof(v_object) is distinct from 'object'
     or not (v_object ?& array['state','usableRowRate','totalRows','validRows','invalidRows','delimiter','pnlColumn','mappedFields','issues']::text[])
     or (v_object - array['state','usableRowRate','totalRows','validRows','invalidRows','delimiter','pnlColumn','mappedFields','issues']::text[]) <> '{}'::jsonb then
    raise exception 'verify_data_quality_shape_invalid' using errcode='23514';
  end if;

  v_object := new.report_payload->'evidenceCoverage';
  if jsonb_typeof(v_object) is distinct from 'object'
     or not (v_object ?& array['computed','notAssessed','computedCount','notAssessedCount']::text[])
     or (v_object - array['computed','notAssessed','computedCount','notAssessedCount']::text[]) <> '{}'::jsonb
     or jsonb_typeof(v_object->'computed') is distinct from 'array'
     or jsonb_typeof(v_object->'notAssessed') is distinct from 'array'
     or jsonb_array_length(v_object->'computed') <> 6
     or jsonb_array_length(v_object->'notAssessed') <> 8 then
    raise exception 'verify_evidence_coverage_shape_invalid' using errcode='23514';
  end if;

  v_object := new.report_payload->'executiveSummary';
  if jsonb_typeof(v_object) is distinct from 'object'
     or not (v_object ?& array['posture','strategyQuality','robustness','overfittingRisk','primaryWarning','conclusionBoundary']::text[])
     or (v_object - array['posture','strategyQuality','robustness','overfittingRisk','primaryWarning','conclusionBoundary']::text[]) <> '{}'::jsonb then
    raise exception 'verify_executive_summary_shape_invalid' using errcode='23514';
  end if;

  v_object := new.report_payload->'provenance';
  if jsonb_typeof(v_object) is distinct from 'object'
     or not (v_object ?& array['reportSchema','methodologyVersion','engineVersion','sourceRevision','sourceEnginePath','sourceReportPath','sequenceSeedBoundary','numericalReproducibility','methodologyRoute']::text[])
     or (v_object - array['reportSchema','methodologyVersion','engineVersion','sourceRevision','sourceEnginePath','sourceReportPath','sequenceSeedBoundary','numericalReproducibility','methodologyRoute']::text[]) <> '{}'::jsonb then
    raise exception 'verify_provenance_shape_invalid' using errcode='23514';
  end if;

  if not qelly_private.jsonb_string_array_bounded(new.report_payload->'warnings', 50, 600)
     or not qelly_private.jsonb_string_array_bounded(new.report_payload->'failureConditions', 50, 600)
     or not qelly_private.jsonb_string_array_bounded(new.report_payload->'limitations', 80, 600) then
    raise exception 'verify_report_text_array_shape_invalid' using errcode='23514';
  end if;

  return new;
end;
$function$;

revoke all on function qelly_private.validate_verify_assessment_payload_shape() from public, anon, authenticated;

drop trigger if exists qelly_verify_04_validate_payload_shape on public.qelly_verify_assessments;
create trigger qelly_verify_04_validate_payload_shape
before insert or update on public.qelly_verify_assessments
for each row execute function qelly_private.validate_verify_assessment_payload_shape();
