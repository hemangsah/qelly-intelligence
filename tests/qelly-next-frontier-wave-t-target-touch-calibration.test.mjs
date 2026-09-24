import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {buildTargetTouchCalibration,__targetTouchCalibrationTest} from '../functions/_lib/decision-target-touch-calibration.js';

const read=(path)=>readFile(new URL(`../${path}`,import.meta.url),'utf8');
const base=Date.parse('2026-09-01T00:00:00.000Z');
const row=(index,{hit=true,regime='TRENDING',eligible=true}={})=>{
  const resolved=new Date(base+index*3_600_000).toISOString();
  const targetReachedAt=hit?{
    T1:new Date(base+index*3_600_000-3_000_000).toISOString(),
    T2:new Date(base+index*3_600_000-2_000_000).toISOString(),
    T3:new Date(base+index*3_600_000-1_000_000).toISOString(),
    T4:new Date(base+index*3_600_000-500_000).toISOString()
  }:{};
  return {
    id:'row-'+String(index).padStart(4,'0'),
    targets:[1,2,3,4].map(slot=>({slot,price:100+slot,ratio:slot})),
    metrics:{targetReachedAt,invalidatedAt:hit?null:new Date(base+index*3_600_000-2_500_000).toISOString()},
    resolved_outcome:{
      state:hit?'TARGET_LADDER_COMPLETE':'INVALIDATED_FIRST',
      calibrationEligible:eligible
    },
    regime,
    resolved_at:resolved,
    created_observed_at:new Date(base+(index-1)*3_600_000).toISOString()
  };
};

test('Wave T remains UNCALIBRATED below the real-outcome sample gate and exposes no target probability',()=>{
  const result=buildTargetTouchCalibration(Array.from({length:49},(_,i)=>row(i,{hit:i%2===0})));
  assert.equal(result.state,'UNCALIBRATED');
  assert.equal(result.eligible,false);
  assert.equal(result.eligibleResolvedSetups,49);
  for(const key of ['T1','T2','T3','T4','INVALIDATION_FIRST']){
    assert.equal(result.metrics[key].state,'UNCALIBRATED');
    assert.equal(result.metrics[key].probability,null);
    assert.equal(result.metrics[key].brierScore,null);
  }
  assert.match(result.analogBoundary,/not used/i);
});

test('chronological expanding-window calibration can become eligible only after independent quality gates pass',()=>{
  const result=buildTargetTouchCalibration(Array.from({length:80},(_,i)=>row(i,{hit:true})));
  assert.equal(result.state,'CALIBRATED');
  assert.equal(result.eligible,true);
  assert.equal(result.metrics.T1.eligible,true);
  assert.equal(result.metrics.T1.sampleSize,80);
  assert.ok(result.metrics.T1.probability>.98);
  assert.ok(result.metrics.T1.brierScore<.01);
  assert.ok(result.metrics.T1.reliabilityGap<.05);
  assert.ok(result.metrics.T1.confidenceInterval95.low>.94);
  assert.equal(result.metrics.INVALIDATION_FIRST.eligible,true);
  assert.ok(result.metrics.INVALIDATION_FIRST.probability<.02);
  assert.equal(result.metrics.T4.eligible,true);
});

test('walk-forward prediction at a cut depends only on earlier outcomes, never the outcome being scored',()=>{
  const {walkForwardPredictions}=__targetTouchCalibrationTest;
  const first=walkForwardPredictions([1,1,1,1,1,0],{warmup:5});
  const second=walkForwardPredictions([1,1,1,1,1,1],{warmup:5});
  assert.equal(first.length,1);
  assert.equal(second.length,1);
  assert.equal(first[0].probability,second[0].probability);
  assert.equal(first[0].probability,(5+.5)/(5+1));
  assert.notEqual(first[0].actual,second[0].actual);
});

test('ambiguous or non-eligible outcomes are excluded from target-touch calibration',()=>{
  const rows=[
    ...Array.from({length:50},(_,i)=>row(i,{hit:true})),
    row(51,{hit:false,eligible:false}),
    {...row(52,{hit:false}),resolved_outcome:{state:'AMBIGUOUS_INTRABAR',calibrationEligible:false}}
  ];
  const result=buildTargetTouchCalibration(rows);
  assert.equal(result.eligibleResolvedSetups,50);
  assert.equal(result.metrics.T1.sampleSize,50);
  assert.equal(result.metrics.INVALIDATION_FIRST.hits,0);
});

test('regime segmentation appears only when that regime independently clears its own sample gate',()=>{
  const rows=[
    ...Array.from({length:55},(_,i)=>row(i,{hit:true,regime:'TRENDING'})),
    ...Array.from({length:30},(_,i)=>row(i+100,{hit:false,regime:'RANGING'}))
  ];
  const result=buildTargetTouchCalibration(rows);
  assert.ok(result.metrics.T1.regimeSegments.TRENDING);
  assert.equal(result.metrics.T1.regimeSegments.RANGING,undefined);
  assert.equal(result.minimumRegimeSegmentSample,50);
});

test('Wave T API computes calibration from resolved history rather than the visible item page',async()=>{
  const api=await read('functions/api/v1/decision-ledger/[[route]].js');
  assert.match(api,/buildTargetTouchCalibration/);
  assert.match(api,/resolved_at:'not\.is\.null'/);
  assert.match(api,/limit=2000|historyLimit=2000/);
  assert.match(api,/calibrationRows\(env,session,workspaceId/);
  assert.match(api,/calibrationState:calibration\.state/);
  assert.match(api,/minimumSampleGate:calibration\.minimumSampleGate/);
  assert.match(api,/historyLimitReached/);
  assert.doesNotMatch(api,/historicalAnalogs.*probability/i);
});

test('Wave T migration covers the workspace foreign key reported by the production advisor',async()=>{
  const migration=await read('supabase/migrations/20260924090000_qelly_decision_outcome_ledger_workspace_index.sql');
  assert.match(migration,/qelly_decision_setup_observations_workspace_idx/);
  assert.match(migration,/\(workspace_id,observed_at desc\)/);
});

test('Decision ledger UI discloses target-touch calibration state and never labels unavailable output as a probability',async()=>{
  const [route,css]=await Promise.all([
    read('apps/web/public/assets/routes/decision-proven-graph.mjs'),
    read('apps/web/public/assets/qelly-decision-proven-graph.css')
  ]);
  for(const phrase of ['Target-touch calibration','UNAVAILABLE','95% CI','Historical analog positive-rate is not used as probability'])assert.ok(route.includes(phrase),phrase);
  assert.match(route,/calibration\.metrics/);
  assert.match(route,/item\.eligible\?pct\(item\.probability\):'UNAVAILABLE'/);
  assert.match(css,/\.q-dpg-target-calibration\{/);
  assert.match(css,/max-width:560px/);
});
