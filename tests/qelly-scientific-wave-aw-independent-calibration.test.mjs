import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {buildDecisionWalkForwardCalibration} from '../functions/_lib/decision-proven-graph.js';
import {compactDecisionToolReceipt} from '../functions/_lib/qelly-chat-tools.js';

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

test('Wave AW uses one full forecast horizon between calibration cuts',()=>{
  const result=buildDecisionWalkForwardCalibration(candles(),{interval:'15m',horizonBars:16,minSamples:36});
  assert.equal(result.schemaVersion,'qelly.decision-walk-forward-calibration/1.1.0');
  assert.equal(result.horizonBars,16);
  assert.equal(result.stepBars,16);
  assert.equal(result.resolutionWindowBars,16);
  assert.equal(result.minimumOutcomeSeparationBars,16);
  assert.equal(result.outcomeWindowOverlap,false);
  assert.equal(result.sampleSize,25);
  assert.equal(result.minimumSampleGate,36);
  assert.equal(result.state,'UNCALIBRATED');
  assert.equal(result.eligible,false);
  assert.equal(result.diagnosticMetricsOnly,true);
  assert.match(result.independenceGuard,/no realized return bar belongs to two scored outcomes/i);
});

test('Wave AW keeps Brier and reliability visible only as diagnostics below the independent sample gate',()=>{
  const result=buildDecisionWalkForwardCalibration(candles(),{interval:'15m',horizonBars:16,minSamples:36});
  assert.ok(Number.isFinite(result.brierScore));
  assert.ok(Number.isFinite(result.baselineBrierScore));
  assert.ok(Number.isFinite(result.skillScore));
  assert.ok(Number.isFinite(result.reliabilityGap));
  assert.ok(result.reliabilityBins.length>0);
  assert.equal(result.diagnosticMetricsOnly,true);
  assert.match(result.reason,/Independent resolved walk-forward sample is below the minimum calibration size/i);
  assert.match(result.method,/non-overlapping stepped walk-forward/i);
});

test('Wave AW exact horizon boundary removes the prior off-by-one terminal observation',async()=>{
  const source=await read('functions/_lib/decision-proven-graph.js');
  assert.match(source,/const terminal=candles\[cut\+horizon-1\]\?\.close/);
  assert.match(source,/resolveTime:candles\[cut\+horizon-1\]\.time/);
  assert.match(source,/for\(let cut=first;cut\+horizon-1<candles\.length;cut\+=step\)/);
  assert.doesNotMatch(source,/const terminal=candles\[cut\+horizon\]\?\.close/);
  assert.doesNotMatch(source,/resolveTime:candles\[cut\+horizon\]\.time/);
});

test('Wave AW does not lower the 36-observation gate to preserve a calibrated label',()=>{
  const result=buildDecisionWalkForwardCalibration(candles(),{interval:'15m',horizonBars:16,minSamples:36});
  assert.equal(result.minimumSampleGate,36);
  assert.ok(result.sampleSize<result.minimumSampleGate);
  assert.equal(result.state,'UNCALIBRATED');
  assert.equal(result.eligible,false);
});

test('Wave AW UI distinguishes diagnostic metrics from eligible calibration',async()=>{
  const route=await read('apps/web/public/assets/routes/decision-proven-graph.mjs');
  for(const phrase of [
    'MODEL CALIBRATION · WALK-FORWARD',
    'Outcome separation',
    'independent sample gate',
    'DIAGNOSTIC ONLY',
    'diagnostic only'
  ])assert.ok(route.includes(phrase),phrase);
  assert.match(route,/overlap '+escapeHtml\(overlap\)/);
  assert.match(route,/UNAVAILABLE/);
});

test('Wave AW Evidence Graph and PPF expose independent-sample calibration governance',async()=>{
  const context=await read('functions/_lib/decision-context.js');
  assert.match(context,/minimumOutcomeSeparationBars/);
  assert.match(context,/diagnosticMetricsOnly/);
  assert.match(context,/Only non-overlapping resolved walk-forward observations can satisfy the calibration sample gate/);
  assert.match(context,/Brier, reliability and skill are diagnostic only below the independent minimum sample gate/);
});

test('Wave AW QELLY Chat receipt exposes sample gate and overlap boundary without recalculating calibration',()=>{
  const calibration=buildDecisionWalkForwardCalibration(candles(),{interval:'15m',horizonBars:16,minSamples:36});
  const receipt=compactDecisionToolReceipt({
    asset:'BTC',interval:'15m',horizon:'4h',truthState:'LIVE',observedAt:'2026-09-25T09:15:00.000Z',
    qellyView:{action:'WAIT',confidence:.6,evidenceGate:{}},
    quant:{calibration},
    evidence:{news:{},liquidity:{},derivatives:{},macro:{},eventRisk:{},crossAsset:{}},
    tradeResearch:{status:'NO_TRADE',matrix:[],targets:[]},
    historicalAnalogs:{},contradictionAnalysis:{},pastPresentFuture:{},evidenceGraph:{nodes:[]}
  });
  const value=receipt.data.calibration;
  assert.equal(value.sampleSize,25);
  assert.equal(value.minimumSampleGate,36);
  assert.equal(value.stepBars,16);
  assert.equal(value.minimumOutcomeSeparationBars,16);
  assert.equal(value.outcomeWindowOverlap,false);
  assert.equal(value.diagnosticMetricsOnly,true);
  assert.match(value.independenceGuard,/no realized return bar belongs to two scored outcomes/i);
});
