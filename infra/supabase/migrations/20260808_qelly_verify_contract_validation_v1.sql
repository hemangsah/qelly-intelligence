create or replace function qelly_private.validate_verify_assessment_contract()
returns trigger
language plpgsql
set search_path=''
as $function$
declare
  v_source jsonb;
  v_provenance jsonb;
begin
  if new.report_payload->>'schema' is distinct from new.report_schema then
    raise exception 'verify_report_schema_mismatch' using errcode='23514';
  end if;
  if new.report_payload->>'methodologyVersion' is distinct from new.methodology_version then
    raise exception 'verify_methodology_version_mismatch' using errcode='23514';
  end if;
  if new.report_payload->>'engineVersion' is distinct from new.engine_version then
    raise exception 'verify_engine_version_mismatch' using errcode='23514';
  end if;
  if new.report_payload->>'truthState' is distinct from new.truth_state then
    raise exception 'verify_truth_state_mismatch' using errcode='23514';
  end if;

  v_source := new.report_payload->'source';
  if jsonb_typeof(v_source) is distinct from 'object' then
    raise exception 'verify_source_metadata_missing' using errcode='23514';
  end if;
  if v_source#>>'{fingerprint,algorithm}' is distinct from 'SHA-256' then
    raise exception 'verify_source_fingerprint_algorithm_invalid' using errcode='23514';
  end if;
  if lower(coalesce(v_source#>>'{fingerprint,value}','')) is distinct from new.source_fingerprint then
    raise exception 'verify_source_fingerprint_mismatch' using errcode='23514';
  end if;
  if coalesce((v_source->>'uploaded')::boolean, true) is not false
     or coalesce((v_source->>'retained')::boolean, true) is not false
     or v_source->>'processingBoundary' is distinct from 'browser-local' then
    raise exception 'verify_browser_local_boundary_mismatch' using errcode='23514';
  end if;

  v_provenance := new.report_payload->'provenance';
  if jsonb_typeof(v_provenance) is distinct from 'object' then
    raise exception 'verify_provenance_missing' using errcode='23514';
  end if;
  if v_provenance->>'sourceRevision' is distinct from new.source_revision then
    raise exception 'verify_source_revision_mismatch' using errcode='23514';
  end if;
  if v_provenance->>'methodologyVersion' is distinct from new.methodology_version
     or v_provenance->>'engineVersion' is distinct from new.engine_version
     or v_provenance->>'reportSchema' is distinct from new.report_schema then
    raise exception 'verify_provenance_version_mismatch' using errcode='23514';
  end if;

  if new.report_payload#>>'{sequenceStress,method}' is distinct from 'deterministic-seeded-trade-order-shuffle' then
    raise exception 'verify_sequence_stress_method_mismatch' using errcode='23514';
  end if;
  if coalesce((new.report_payload#>>'{sequenceStress,iterations}')::integer, -1) <> 500 then
    raise exception 'verify_sequence_stress_iteration_mismatch' using errcode='23514';
  end if;
  if new.report_payload#>>'{internalStability,state}' is distinct from 'HEURISTIC' then
    raise exception 'verify_internal_stability_state_mismatch' using errcode='23514';
  end if;

  return new;
exception
  when invalid_text_representation then
    raise exception 'verify_report_contract_invalid' using errcode='23514';
end;
$function$;

revoke all on function qelly_private.validate_verify_assessment_contract() from public, anon, authenticated;

drop trigger if exists qelly_verify_05_validate_contract on public.qelly_verify_assessments;
create trigger qelly_verify_05_validate_contract
before insert or update on public.qelly_verify_assessments
for each row execute function qelly_private.validate_verify_assessment_contract();
