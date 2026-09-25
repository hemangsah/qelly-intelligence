import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {buildDecisionWalkForwardCalibration} from '../functions/_lib/decision-proven-graph.js';

const read=(path)=>readFile(new URL('../'+path,import.meta.url),'utf8');

function candles(count=520){
  const rows=[];
  let close=100;
  const start=1_760_000_000_000;
  for(let i=0;i<count;i++){
    const regime=i%120<72?1:-1;
    const cycle=Math.sin(i/7)*.0025+Math.sin(i/19)*.0013;
    const shock=((i*37)%17-8)*.00022;
    const ret=regime*.00075+cycle+shock;
    const open=close;
    close=Math.max(1,open*Math.exp(ret));
    const width=.0025+Math.abs(Math.sin(i/11))*.002;
    rows.push({
      time:start+i*900_000,
      open,
      high:Math.max(open,close)*(1+width),
      low:Math.min(open,close)*(1-width*.9),
      close,
      volume:1000+(i%23)*31,
      trades:120+i%50
    });
  }
  return rows;
}

test('BQ acceptance state cannot turn zero production outcomes into empirical validation',async()=>{
  const state=JSON.parse(await read('project-state/QELLY_POST_PR397_SCIENTIFIC_ACCEPTANCE_2026-09-26.json'));
  assert.equal(state.overallState,'ENGINEERING_ACCEPTED_SCIENTIFICALLY_UNCALIBRATED');
  assert.equal(state.data.setupRows,0);
  assert.equal(state.data.resolvedSetups,0);
  assert.equal(state.data.observationRows,0);
  assert.equal(state.calibration.targetTouch.state,'UNCALIBRATED');
  assert.equal(state.calibration.targetTouch.eligibleResolvedSetups,0);
  assert.equal(state.riskReward.realizedPerformanceState,'BLOCKED_BY_SAMPLE');
  assert.equal(state.regime.state,'BLOCKED_BY_SAMPLE');
  assert.equal(state.ablation.state,'BLOCKED_BY_SAMPLE');
  assert.equal(state.acceptance.scientific.noTradeQuality,'BLOCKED_BY_SAMPLE');
  assert.equal(state.acceptance.scientific.setupExpiry,'BLOCKED_BY_SAMPLE');
});

test('BQ reported scenario diagnostics match the reproducible independent AW fixture',async()=>{
  const state=JSON.parse(await read('project-state/QELLY_POST_PR397_SCIENTIFIC_ACCEPTANCE_2026-09-26.json'));
  const result=buildDecisionWalkForwardCalibration(candles(),{interval:'15m',horizonBars:16,minSamples:36});
  const recorded=state.calibration.scenarioFixture;
  assert.equal(result.sampleSize,recorded.sampleSize);
  assert.equal(result.minimumSampleGate,recorded.minimumSampleGate);
  assert.equal(result.state,recorded.state);
  assert.equal(result.diagnosticMetricsOnly,recorded.diagnosticOnly);
  assert.equal(result.brierScore,recorded.brierScore);
  assert.equal(result.skillScore,recorded.skillScore);
  assert.equal(result.reliabilityGap,recorded.reliabilityGap);
  assert.equal(result.outcomeWindowOverlap,false);
  assert.equal(result.minimumOutcomeSeparationBars,16);
});

test('BQ report contains every master-prompt scientific report section and explicit limitations',async()=>{
  const report=await read('docs/validation/QELLY_WAVE_BQ_FINAL_SCIENTIFIC_VALIDATION_REPORT.md');
  for(const heading of [
    '## 1. Data','## 2. Calibration','## 3. R:R science','## 4. Regime quality',
    '## 5. Model / component ablation','## 6. Latency','## 7. Reliability and chaos',
    '## 10. Security','## 11. Master acceptance checklist','## 12. Final scientific conclusion'
  ])assert.ok(report.includes(heading),heading);
  for(const phrase of [
    '0 tracked Decision setups',
    'BLOCKED_BY_SAMPLE',
    'UNCALIBRATED',
    'Leaked Password Protection Disabled',
    'not empirically validated as a profitable or calibrated trading system',
    'No result below converts missing evidence into a pass'
  ])assert.ok(report.includes(phrase),phrase);
});

test('BQ latency evidence preserves reliability denominators instead of hiding scanner failures',async()=>{
  const state=JSON.parse(await read('project-state/QELLY_POST_PR397_SCIENTIFIC_ACCEPTANCE_2026-09-26.json'));
  assert.deepEqual(state.latency.baseline.decision,{n:20,p50Ms:7960,p90Ms:9440,p95Ms:10030});
  assert.equal(state.latency.currentBoundedSample.decision.http200,20);
  assert.equal(state.latency.currentBoundedSample.decision.totalN,20);
  assert.equal(state.latency.currentBoundedSample.scanner.http200,7);
  assert.equal(state.latency.currentBoundedSample.scanner.http503,2);
  assert.equal(state.latency.currentBoundedSample.scanner.http429,1);
  assert.equal(state.latency.currentBoundedSample.scanner.certificationState,'INSUFFICIENT_SAMPLE');
});

test('BQ conditional waves remain conditional instead of manufacturing unsupported private features',async()=>{
  const state=JSON.parse(await read('project-state/QELLY_POST_PR397_SCIENTIFIC_ACCEPTANCE_2026-09-26.json'));
  assert.equal(state.conditionalWaves.AZ.state,'NOT_ACTIVATED');
  assert.equal(state.conditionalWaves.BA.state,'NOT_ACTIVATED');
  assert.equal(state.conditionalWaves.BB.state,'PARTIAL_EXISTING');
});
