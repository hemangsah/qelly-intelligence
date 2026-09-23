import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {buildTradeResearch} from '../functions/_lib/decision-trade-research.js';
import {runDecisionScan} from '../functions/api/v1/decision-scan.js';

const graph=(overrides={})=>({
  graphId:'dpg-btc-15m-test',
  observedAt:'2026-09-23T00:00:00.000Z',
  horizonBars:16,
  freshness:{intervalMs:900_000},
  market:{lastPrice:108,currentState:{regime:'TRENDING'}},
  metrics:{atrPct:1.5},
  forecast:{fan:[{p05:86,p25:94,p50:103,p75:112,p95:126}]},
  quant:{
    regime:'TRENDING',
    volatility:{regime:'NORMAL',expectedMovePct:12},
    structure:{state:'HH_HL',support:94,resistance:112,breakout:'NONE'},
    calibration:{state:'CALIBRATED',eligible:true,sampleSize:80,brierScore:.19,reliabilityBins:[]}
  },
  qellyView:{
    action:'BUY',
    confidence:.82,
    evidenceGate:{qualityScore:.86,calibrationEligible:true},
    levels:{entryZone:[99,101],invalidation:96},
    contradictions:[],
    changesIf:'Structure fails or evidence alignment deteriorates.'
  },
  ...overrides
});

test('trade lifecycle stays FORMING when price must pull back and does not backfill trigger history',()=>{
  const result=buildTradeResearch(graph(),{requestedRr:'auto'});
  assert.equal(result.status,'VALID');
  assert.equal(result.entry.method,'PULLBACK');
  assert.equal(result.lifecycle.state,'FORMING');
  assert.equal(result.lifecycle.historyAvailable,false);
  assert.match(result.lifecycle.reason,/not currently satisfied/i);
  assert.equal(result.lastValidatedAt,'2026-09-23T00:00:00.000Z');
  assert.ok(Date.parse(result.expiryAt)>Date.parse(result.lastValidatedAt));
});

test('entry-ready setup reports TRIGGERED from the current observation without inventing prior transitions',()=>{
  const result=buildTradeResearch(graph({market:{lastPrice:100,currentState:{regime:'TRENDING'}},truthState:'LIVE'}),{requestedRr:'1'});
  assert.equal(result.status,'VALID');
  assert.equal(result.entry.method,'NOW');
  assert.equal(result.lifecycle.state,'TRIGGERED');
  assert.equal(result.lifecycle.historyAvailable,false);
  assert.match(result.lifecycle.reason,/current observation satisfies the entry condition/i);
});

test('stale directional evidence reports WEAKENING and is not an immediate scan-ready lifecycle',()=>{
  const result=buildTradeResearch(graph({market:{lastPrice:100,currentState:{regime:'TRENDING'}},truthState:'STALE'}),{requestedRr:'1'});
  assert.equal(result.status,'VALID');
  assert.equal(result.lifecycle.state,'WEAKENING');
  assert.equal(result.lifecycle.historyAvailable,false);
});

test('expired setup fails closed even if the target remains structurally feasible',()=>{
  const result=buildTradeResearch(graph({
    generatedAt:'2026-09-23T00:00:00.000Z',
    market:{lastPrice:100,currentState:{regime:'TRENDING'}},
    truthState:'LIVE'
  }),{requestedRr:'1',now:Date.parse('2026-09-24T00:00:00.000Z')});
  assert.equal(result.status,'NO_TRADE');
  assert.equal(result.lifecycle.state,'EXPIRED');
  assert.match(result.reason,/expired/i);
});

test('layered invalidation keeps price structure evidence time event and regime distinct',()=>{
  const result=buildTradeResearch(graph(),{requestedRr:'1'});
  assert.ok(result.invalidation);
  assert.equal(result.invalidation.price.state,'ACTIVE');
  assert.equal(result.invalidation.price.price,96);
  assert.equal(result.invalidation.structural.state,'ACTIVE');
  assert.equal(result.invalidation.structural.price,94);
  assert.equal(result.invalidation.evidence.state,'ACTIVE');
  assert.equal(result.invalidation.time.state,'ACTIVE');
  assert.equal(result.invalidation.event.state,'UNAVAILABLE');
  assert.equal(result.invalidation.regime.state,'ACTIVE');
  assert.match(result.stop.reason,/distinct from structural/i);
});

test('unknown venue costs never become a fabricated zero-cost net R:R',()=>{
  const result=buildTradeResearch(graph(),{requestedRr:'1'});
  assert.equal(result.selected.costState,'UNAVAILABLE');
  assert.equal(result.selected.netRiskReward,null);
  assert.equal(result.selected.estimatedCost,null);
  assert.match(result.selected.costReason,/not fabricated/i);
});

test('known bounded cost assumption produces an explicitly estimated net R:R',()=>{
  const result=buildTradeResearch(graph({costs:{roundTripPct:.1}}),{requestedRr:'1'});
  assert.equal(result.selected.costState,'ESTIMATED');
  assert.ok(Number.isFinite(result.selected.netRiskReward));
  assert.ok(result.selected.netRiskReward<result.selected.grossRiskReward);
  assert.ok(result.selected.estimatedCost>0);
});

test('Auto may expose a feasible structural target without forcing a preset target',()=>{
  const result=buildTradeResearch(graph({
    market:{lastPrice:100,currentState:{regime:'TRENDING'}},
    quant:{
      regime:'TRENDING',
      volatility:{regime:'NORMAL',expectedMovePct:20},
      structure:{state:'HH_HL',support:94,resistance:108,breakout:'NONE'},
      calibration:{state:'CALIBRATED',eligible:true,sampleSize:80,brierScore:.19,reliabilityBins:[]}
    },
    qellyView:{
      action:'BUY',
      confidence:.82,
      evidenceGate:{qualityScore:.86,calibrationEligible:true},
      levels:{entryZone:[99,101],invalidation:95},
      contradictions:[],
      changesIf:'Structure fails.'
    }
  }),{requestedRr:'auto'});
  assert.equal(result.status,'VALID');
  assert.ok(result.structuralTargets.length>=1);
  assert.equal(result.structuralTargets[0].source,'RECENT_RESISTANCE');
  assert.ok(result.targets.some(item=>item.source==='RECENT_RESISTANCE'));
});

test('governed scanner does not mark a FORMING setup immediately eligible',async()=>{
  const forming={
    asset:'BTC',interval:'15m',horizon:'4h',observedAt:'2026-09-23T00:00:00.000Z',truthState:'LIVE',
    market:{lastPrice:108,currentState:{regime:'TRENDING'}},
    quant:{regime:'TRENDING',volatility:{regime:'NORMAL',expectedMovePct:2}},
    qellyView:{action:'BUY',label:'Directional evidence.',contradictions:[],evidenceGate:{qualityScore:.9,scenarioSeparation:.8,timeframeAgreement:.75,freshness:1,timeframeDirection:'BUY',calibrationState:'CALIBRATED',calibrationEligible:true,quantCoverage:'derived'}},
    tradeResearch:{status:'VALID',lifecycle:{state:'FORMING'},reason:'Wait for pullback.',selected:{label:'1:2',feasibility:'HIGH',target:112},entry:{preferred:100},stop:{price:96},expiryAt:'2026-09-23T02:00:00.000Z'}
  };
  const scan=await runDecisionScan({},{now:Date.parse('2026-09-23T00:00:00.000Z'),build:async(_env,{asset})=>({...forming,asset})});
  assert.equal(scan.eligibleCount,0);
  assert.equal(scan.state,'no_eligible_setup');
  assert.equal(scan.candidates[0].trade.lifecycle,'FORMING');
  assert.equal(scan.candidates[0].trade.entryReady,false);
});

test('Decision UI exposes lifecycle entry logic target ladder and all invalidation layers',async()=>{
  const route=await readFile(new URL('../apps/web/public/assets/routes/decision-proven-graph.mjs',import.meta.url),'utf8');
  const css=await readFile(new URL('../apps/web/public/assets/qelly-decision-proven-graph.css',import.meta.url),'utf8');
  for(const phrase of ['Setup forming — entry not ready','Entry logic','Lifecycle','Feasible target ladder','INVALIDATION LAYERS','Price stop ≠ full thesis invalidation','Net R:R unavailable','No triggered/active history is backfilled'])assert.match(route,new RegExp(phrase));
  for(const label of ['Price','Structure','Evidence','Time','Event','Regime'])assert.match(route,new RegExp("\\['"+label+"'"));
  assert.match(css,/\.q-dpg-invalidation\{/);
  assert.match(css,/\.q-dpg-lifecycle\{/);
  assert.match(css,/\.q-dpg-target-ladder\{/);
  assert.match(css,/@media\(max-width:620px\)/);
});
