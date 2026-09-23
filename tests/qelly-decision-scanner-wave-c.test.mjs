import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runDecisionScan,__decisionScanTest,DECISION_SCAN_ASSETS} from '../functions/api/v1/decision-scan.js';

const resultFor=(asset,{
  action='NO TRADE',
  calibrated=false,
  tradeStatus='NO_TRADE',
  priority=.7,
  rr='1:2'
}={})=>({
  asset,
  interval:'15m',
  horizon:'4h',
  observedAt:'2026-09-23T00:00:00.000Z',
  truthState:'LIVE',
  market:{lastPrice:100, currentState:{regime:'TRENDING'}},
  quant:{regime:'TRENDING',volatility:{regime:'NORMAL',expectedMovePct:2.4}},
  qellyView:{
    action,
    label:action==='NO TRADE'?'No valid setup':'Research setup',
    contradictions:calibrated?[]:['Calibration unavailable'],
    evidenceGate:{
      qualityScore:priority,
      scenarioSeparation:.6,
      timeframeAgreement:.75,
      freshness:1,
      timeframeDirection:action==='SELL'?'SELL':'BUY',
      calibrationState:calibrated?'CALIBRATED':'UNCALIBRATED',
      calibrationEligible:calibrated,
      quantCoverage:'derived'
    }
  },
  tradeResearch:{
    status:tradeStatus,
    reason:tradeStatus==='VALID'?'Evidence-qualified setup':'No valid setup.',
    selected:tradeStatus==='VALID'?{label:rr,feasibility:'FEASIBLE',target:104,targetCongestion:'CLEAR',selectionScore:82}:null,
    entry:tradeStatus==='VALID'?{preferred:100}:null,
    stop:tradeStatus==='VALID'?{price:98}:null,
    expiryAt:tradeStatus==='VALID'?'2026-09-23T04:00:00.000Z':null
  }
});

test('Decision scanner keeps the approved bounded six-asset universe',()=>{
  assert.deepEqual(DECISION_SCAN_ASSETS,['BTC','ETH','SOL','HYPE','XRP','DOGE']);
});

test('Decision scanner fails closed when calibration does not permit a trade',async()=>{
  const scan=await runDecisionScan({},{
    now:Date.parse('2026-09-23T00:00:00.000Z'),
    build:async (_env,{asset})=>resultFor(asset,{priority:asset==='ETH'?.92:.65})
  });
  assert.equal(scan.state,'NO_ELIGIBLE_SETUP');
  assert.equal(scan.eligibleCount,0);
  assert.equal(scan.availableCount,6);
  assert.equal(scan.eventRisk.state,'unavailable');
  assert.equal(scan.eventRisk.connectedFeed,false);
  assert.match(scan.eventRisk.reason,/does not invent/i);
  assert.equal(scan.candidates[0].asset,'ETH');
  assert.equal(scan.candidates[0].eligible,false);
  assert.equal(scan.candidates[0].trade.targetTouchProbability,null);
  assert.equal(scan.candidates[0].trade.expectedValue,null);
  assert.equal(scan.boundaries.rankingIsSuccessProbability,false);
  assert.match(scan.candidates[0].researchPriorityMeaning,/not a probability/i);
});

test('Decision scanner places a genuinely eligible calibrated setup before research-only candidates',async()=>{
  const scan=await runDecisionScan({},{
    now:Date.parse('2026-09-23T00:00:00.000Z'),
    requestedRr:'2',
    build:async (_env,{asset})=>asset==='SOL'
      ?resultFor(asset,{action:'BUY',calibrated:true,tradeStatus:'VALID',priority:.55,rr:'1:2'})
      :resultFor(asset,{priority:.95})
  });
  assert.equal(scan.state,'VALID_SETUP');
  assert.equal(scan.eligibleCount,1);
  assert.equal(scan.candidates[0].asset,'SOL');
  assert.equal(scan.candidates[0].eligible,true);
  assert.equal(scan.candidates[0].trade.status,'VALID');
  assert.equal(scan.candidates[0].trade.rr,'1:2');
  assert.equal(scan.candidates[0].trade.targetTouchProbability,null);
  assert.equal(scan.candidates[0].trade.expectedValue,null);
});

test('Decision scanner limits concurrent asset evaluation to two workers',async()=>{
  let active=0,maxActive=0;
  const scan=await runDecisionScan({},{
    now:Date.parse('2026-09-23T00:00:00.000Z'),
    build:async (_env,{asset})=>{
      active++;maxActive=Math.max(maxActive,active);
      await new Promise(resolve=>setTimeout(resolve,8));
      active--;
      return resultFor(asset);
    }
  });
  assert.equal(scan.availableCount,6);
  assert.ok(maxActive<=2);
  assert.ok(maxActive>=1);
});

test('scanner helper rejects unsupported controls before provider work',async()=>{
  await assert.rejects(()=>runDecisionScan({},{
    interval:'2m',
    build:async()=>{throw new Error('should not run');}
  }),/Unsupported candle interval/i);
  assert.equal(__decisionScanTest.RR_VALUES.has('custom'),true);
});

test('Decision route connects Find Trade Now to scanner and keeps mobile containment',async()=>{
  const route=await readFile(new URL('../apps/web/public/assets/routes/decision-proven-graph.mjs',import.meta.url),'utf8');
  const css=await readFile(new URL('../apps/web/public/assets/qelly-decision-proven-graph.css',import.meta.url),'utf8');
  assert.match(route,/\/api\/v1\/decision-scan\?/);
  assert.match(route,/data-dpg-scan/);
  assert.match(route,/FIND TRADE NOW 2\.0 · GOVERNED SCAN/);
  assert.match(route,/Evidence triage ranks current research quality, structural feasibility/);
  assert.match(route,/data-dpg-scan-asset/);
  assert.doesNotMatch(route,/data-dpg-find-trade/);
  assert.match(css,/\.q-dpg-scanner\{/);
  assert.match(css,/@media\(max-width:540px\)/);
  assert.match(css,/\.q-dpg-scan-filters/);
});
