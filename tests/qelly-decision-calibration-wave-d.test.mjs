import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {buildDecisionWalkForwardCalibration} from '../functions/_lib/decision-proven-graph.js';
import {calibrateDecisionEvidence} from '../functions/api/v1/decision-proven-graph.js';

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
    const high=Math.max(open,close)*(1+width);
    const low=Math.min(open,close)*(1-width*.9);
    rows.push({time:start+i*900_000,open,high,low,close,volume:1000+(i%23)*31,trades:120+i%50});
  }
  return rows;
}

test('walk-forward calibration is deterministic and resolved without future leakage claims',()=>{
  const input=candles();
  const a=buildDecisionWalkForwardCalibration(input,{interval:'15m',horizonBars:16});
  const b=buildDecisionWalkForwardCalibration(input,{interval:'15m',horizonBars:16});
  assert.deepEqual(a,b);
  assert.ok(a.sampleSize>=36);
  assert.ok(['CALIBRATED','WEAK_CALIBRATION'].includes(a.state));
  assert.equal(typeof a.eligible,'boolean');
  assert.equal(Number.isFinite(a.brierScore),true);
  assert.equal(Number.isFinite(a.baselineBrierScore),true);
  assert.equal(Number.isFinite(a.skillScore),true);
  assert.equal(Number.isFinite(a.reliabilityGap),true);
  assert.ok(Array.isArray(a.reliabilityBins));
  assert.equal(a.bootstrapPaths,64);
  assert.match(a.method,/bounded 64-path bootstrap/i);
  assert.match(a.method,/walk-forward/i);
  assert.match(a.leakageGuard,/Future candles are used only to score/i);
  assert.ok(Date.parse(a.firstResolvedAt)<=Date.parse(a.lastResolvedAt));
});

test('walk-forward calibration stays uncalibrated when resolved sample is too small',()=>{
  const result=buildDecisionWalkForwardCalibration(candles(150),{interval:'15m',horizonBars:16,minSamples:36});
  assert.equal(result.state,'UNCALIBRATED');
  assert.equal(result.eligible,false);
  assert.ok(result.sampleSize<36);
});

const baseGraph=(calibration)=>({
  truthState:'LIVE',
  market:{points:500},
  metrics:{atrPct:.9},
  quant:{state:'DERIVED',volatility:{regime:'NORMAL',expectedMovePct:2},structure:{state:'HH_HL'},calibration},
  forecast:{probabilities:{bull:.66,base:.17,bear:.17}},
  confidence:{score:.8,calibration:'base'},
  qellyView:{
    action:'BUY',
    confidence:.8,
    levels:{entryZone:[99,101],invalidation:97,targets:[102,104,106],riskReward:[.8,1.6,2.4]},
    why:['Base directional evidence.'],
    label:'Research signal only.',
    changesIf:'Base invalidation.'
  },
  graph:{nodes:[{id:'decision',label:'QELLY VIEW BUY'}],edges:[]}
});

test('CALIBRATED label alone cannot clear signal gate unless calibration eligible is true',()=>{
  const calibration={state:'CALIBRATED',eligible:false,sampleSize:60,brierScore:.2,skillScore:.2,reliabilityGap:.05,reliabilityBins:[]};
  const result=calibrateDecisionEvidence(baseGraph(calibration),{state:'live',agreement:{direction:'BUY',aligned:4,directional:4,total:4}},{state:'live'});
  assert.equal(result.qellyView.action,'NO TRADE');
  assert.equal(result.qellyView.evidenceGate.calibrationEligible,false);
  assert.match(result.qellyView.contradictions.join(' '),/calibration/i);
});

test('eligible calibrated evidence can preserve an otherwise aligned directional view',()=>{
  const calibration={state:'CALIBRATED',eligible:true,sampleSize:60,brierScore:.2,skillScore:.2,reliabilityGap:.05,reliabilityBins:[]};
  const result=calibrateDecisionEvidence(baseGraph(calibration),{state:'live',agreement:{direction:'BUY',aligned:4,directional:4,total:4}},{state:'live'});
  assert.equal(result.qellyView.action,'BUY');
  assert.equal(result.qellyView.evidenceGate.calibrationEligible,true);
  assert.ok(result.qellyView.levels);
  assert.equal(result.confidence.probabilityCalibration.eligible,true);
});

test('Decision UI surfaces calibration evidence and mobile containment',async()=>{
  const route=await readFile(new URL('../apps/web/public/assets/routes/decision-proven-graph.mjs',import.meta.url),'utf8');
  const css=await readFile(new URL('../apps/web/public/assets/qelly-decision-proven-graph.css',import.meta.url),'utf8');
  for(const phrase of ['MODEL CALIBRATION · WALK-FORWARD','Resolved samples','Brier score','Skill vs uniform','Reliability gap','Reliability bins'])assert.match(route,new RegExp(phrase));
  assert.match(route,/probabilityCalibrationMarkup\(data,escapeHtml\)/);
  assert.match(css,/\.q-dpg-model-calibration\{/);
  assert.match(css,/@media\(max-width:520px\)\{\.q-dpg-model-calibration__metrics,\.q-dpg-reliability-bins\{grid-template-columns:1fr/);
});
