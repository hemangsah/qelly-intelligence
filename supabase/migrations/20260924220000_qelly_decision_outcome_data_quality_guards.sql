create or replace function qelly_private.prevent_resolved_decision_setup_mutation()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, qelly_private
as $$
begin
  if old.resolved_at is not null and (
    new.source_setup_id is distinct from old.source_setup_id or
    new.source_graph_id is distinct from old.source_graph_id or
    new.asset is distinct from old.asset or
    new.timeframe is distinct from old.timeframe or
    new.horizon is distinct from old.horizon or
    new.direction is distinct from old.direction or
    new.created_observed_at is distinct from old.created_observed_at or
    new.last_observed_at is distinct from old.last_observed_at or
    new.expiry_at is distinct from old.expiry_at or
    new.latest_status is distinct from old.latest_status or
    new.resolved_at is distinct from old.resolved_at or
    new.entry is distinct from old.entry or
    new.stop is distinct from old.stop or
    new.invalidation is distinct from old.invalidation or
    new.targets is distinct from old.targets or
    new.requested_rr is distinct from old.requested_rr or
    new.selected_rr is distinct from old.selected_rr or
    new.evidence_snapshot is distinct from old.evidence_snapshot or
    new.calibration_snapshot is distinct from old.calibration_snapshot or
    new.regime is distinct from old.regime or
    new.event_risk_state is distinct from old.event_risk_state or
    new.resolved_outcome is distinct from old.resolved_outcome or
    new.metrics is distinct from old.metrics or
    new.provenance is distinct from old.provenance
  ) then
    raise exception using errcode = 'check_violation', message = 'resolved QELLY Decision setup scientific fields are immutable';
  end if;
  return new;
end;
$$;

revoke all on function qelly_private.prevent_resolved_decision_setup_mutation() from public;

drop trigger if exists qelly_decision_setups_resolved_immutable on public.qelly_decision_setups;
create trigger qelly_decision_setups_resolved_immutable
before update on public.qelly_decision_setups
for each row execute function qelly_private.prevent_resolved_decision_setup_mutation();

create or replace function qelly_private.prevent_decision_observation_update()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, qelly_private
as $$
begin
  raise exception using errcode = 'check_violation', message = 'QELLY Decision setup observations are append-only';
end;
$$;

revoke all on function qelly_private.prevent_decision_observation_update() from public;

drop trigger if exists qelly_decision_setup_observations_append_only on public.qelly_decision_setup_observations;
create trigger qelly_decision_setup_observations_append_only
before update on public.qelly_decision_setup_observations
for each row execute function qelly_private.prevent_decision_observation_update();

alter table public.qelly_decision_setups
  drop constraint if exists qelly_decision_setups_observation_time_order_check,
  add constraint qelly_decision_setups_observation_time_order_check check (last_observed_at >= created_observed_at);

alter table public.qelly_decision_setups
  drop constraint if exists qelly_decision_setups_expiry_time_order_check,
  add constraint qelly_decision_setups_expiry_time_order_check check (expiry_at is null or expiry_at >= created_observed_at);

alter table public.qelly_decision_setups
  drop constraint if exists qelly_decision_setups_resolution_time_order_check,
  add constraint qelly_decision_setups_resolution_time_order_check check (resolved_at is null or resolved_at >= created_observed_at);

alter table public.qelly_decision_setups
  drop constraint if exists qelly_decision_setups_resolution_state_consistency_check,
  add constraint qelly_decision_setups_resolution_state_consistency_check check (
    (resolved_at is null and coalesce(resolved_outcome->>'state','OPEN') = 'OPEN') or
    (resolved_at is not null and coalesce(resolved_outcome->>'state','') in (
      'EXPIRED_UNTRIGGERED','INVALIDATED_FIRST','INVALIDATED_AFTER_TARGET','TARGET_LADDER_COMPLETE','AMBIGUOUS_INTRABAR'
    ))
  );
