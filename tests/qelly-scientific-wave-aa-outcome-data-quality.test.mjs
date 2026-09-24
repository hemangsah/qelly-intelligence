import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {auditDecisionOutcomeData} from '../functions/_lib/decision-outcome-data-quality.js';

const read=(path)=>readFile(new URL('../'+path,import.meta.url),'utf8');
const now='2026-09-02T00:00:00.000Z';
const validRow=(overrides={})=>({
  id:'setup-a',source_setup_id:'source-a',asset:'BTC',timeframe:'15m',horizon:'4h',direction:'BUY',
  created_observed_at:'2026-09-01T00:00:00.000Z',last_observed_at:'2026-09-01T01:00:00.000Z',expiry_at:'2026-09-01T02:00:00.000Z',resolved_at:'2026-09-01T00:30:00.000Z',latest_status:'INVALIDATED',
  targets:[{slot:1,price:101,ratio:1}],metrics:{mfeR:1.1,maeR:.4,triggerAt:'2026-09-01T00:05:00.000Z',targetReachedAt:{},invalidatedAt:'2026-09-01T00:30:00.000Z'},
  resolved_outcome:{state:'INVALIDATED_FIRST',calibrationEligible:true},
  evidence_snapshot:{observedAt:'2026-09-01T00:00:00.000Z'},
  calibration_snapshot:{state:'UNCALIBRATED',lastResolvedAt:'2026-08-31T23:00:00.000Z'},
  ...overrides
});

test('Wave AA reports NO_OBSERVED_DATA without inventing scientific performance',()=>{
  const result=auditDecisionOutcomeData([],[],{now});
  assert.equal(result.state,'NO_OBSERVED_DATA');
  assert.equal(result.scientificallyUsable,false);
  assert.equal(result.setupSampleSize,0);
  assert.match(result.boundary,/no empirical performance claim/i);
});

test('Wave AA accepts temporally coherent resolved labels',()=>{
  const result=auditDecisionOutcomeData([validRow()],[],{now});
  assert.equal(result.state,'VALID');
  assert.equal(result.errorCount,0);
  assert.equal(result.scientificallyUsable,true);
  assert.equal(result.calibrationEligibleResolutions,1);
});

test('Wave AA rejects future leakage and terminal outcome mutation',()=>{
  const row=validRow({calibration_snapshot:{lastResolvedAt:'2026-09-01T00:10:00.000Z'}});
  const observations=[
    {setup_id:'setup-a',observed_at:'2026-09-01T00:30:00.000Z',resolution:{state:'INVALIDATED_FIRST',calibrationEligible:true}},
    {setup_id:'setup-a',observed_at:'2026-09-01T00:31:00.000Z',resolution:{state:'TARGET_LADDER_COMPLETE',calibrationEligible:true}}
  ];
  const result=auditDecisionOutcomeData([row],observations,{now});
  assert.equal(result.state,'CONTAMINATED');
  assert.ok(result.violationCounts.FUTURE_CALIBRATION_LEAKAGE>=1);
  assert.ok(result.violationCounts.TERMINAL_OUTCOME_MUTATION>=1);
});

test('Wave AA rejects duplicate identity, timestamp inversion and target-order corruption',()=>{
  const result=auditDecisionOutcomeData([validRow(),validRow({last_observed_at:'2026-08-31T23:00:00.000Z',targets:[{slot:2,price:102},{slot:1,price:101}]})],[],{now});
  assert.equal(result.state,'CONTAMINATED');
  assert.ok(result.violationCounts.DUPLICATE_SETUP_ID>=1);
  assert.ok(result.violationCounts.DUPLICATE_SOURCE_SETUP_ID>=1);
  assert.ok(result.violationCounts.LAST_BEFORE_CREATED>=1);
  assert.ok(result.violationCounts.TARGET_SLOT_ORDER>=1);
});

test('Wave AA migration locks terminal labels and observation updates',async()=>{
  const migration=await read('supabase/migrations/20260924220000_qelly_decision_outcome_data_quality_guards.sql');
  assert.match(migration,/prevent_resolved_decision_setup_mutation/);
  assert.match(migration,/scientific fields are immutable/);
  assert.match(migration,/prevent_decision_observation_update/);
  assert.match(migration,/observations are append-only/);
  assert.match(migration,/observation_time_order_check/);
  assert.match(migration,/resolution_state_consistency_check/);
});
