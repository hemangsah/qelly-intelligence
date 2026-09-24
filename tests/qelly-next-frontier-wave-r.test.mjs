import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {buildTradeResearch} from '../functions/_lib/decision-trade-research.js';
import {runDecisionScan} from '../functions/api/v1/decision-scan.js';

const directionalGraph=(overrides={})=>({
  graphId:'dpg-btc-15m-wave-r',
  generatedAt:'2026-09-24T00:00:00.000Z',
  observedAt:'2026-09-24T00:00:00.000Z',
  truthState:'LIVE',
  horizonBars:16,
  freshness:{intervalMs:900_000},
  market:{lastPrice:100,currentState:{regime:'TRENDING'}},
  metrics:{atrPct:1},
  forecast:{fan:[{p05:70,p25:85,p50:103,p75:115,p95:130}]},
  quant:{
    regime:'TRENDING',
    volatility:{regime:'NORMAL',expectedMovePct:11},
    structure:{state:'HH_HL',support:92,resistance:140,breakout:'NONE'},
    calibration:{state:'CALIBRATED',eligible:true,sampleSize:120,brierScore:.17,reliabilityGap:.04,reliabilityBins:[]}
  },
  liquidity:{
    state:'live',currentOnly:true,spreadBps:1.8,spreadState:'TIGHT',
    top5Imbalance:.1,imbalanceState:'BALANCED'
  },
  eventRisk:{
    state:'unavailable',level:'UNAVAILABLE',
    reason:'No verified scheduled-event feed is attached.'
  },
  qellyView:{
    action:'BUY',
    confidence:.82,
    label:'Evidence-qualified research setup.',
    evidenceGate:{
      qualityScore:.88,scenarioSeparation:.58,timeframeAgreement:.75,freshness:1,
      timeframeDirection:'BUY',calibrationState:'CALIBRATED',calibrationEligible:true,quantCoverage:'derived'
    },
    levels:{entryZone:[99,101],invalidation:95},
    contradictions:[],
    changesIf:'Structure, calibration, liquidity or evidence alignment deteriorates.'
  },
  ...overrides
});

test('Wave R: Auto R:R selects best structural/volatility fit instead of maximum nominal ratio',()=>{
  const result=buildTradeResearch(directionalGraph(),{requestedRr:'auto'});
  assert.equal(result.status,'VALID');
  assert.equal(result.selected.ratio,2);
  assert.equal(result.selected.feasibility,'HIGHLY FEASIBLE');
  assert.ok(Number.isFinite(result.selected.selectionScore));
  assert.match(result.selected.selectionReason,/does not simply choose the largest/i);
  assert.equal(result.matrix.find(item=>item.ratio===3)?.feasibility,'CONDITIONAL');
  assert.equal(result.matrix.find(item=>item.ratio===4)?.feasibility,'LOW FEASIBILITY');
  assert.equal(result.selected.targetTouchProbability,null);
  assert.equal(result.selected.expectedValue,null);
});

test('Wave R: liquidity is a distinct observed invalidation layer when verified L2 exists',()=>{
  const result=buildTradeResearch(directionalGraph(),{requestedRr:'2'});
  assert.equal(result.invalidation.liquidity.state,'ACTIVE');
  assert.equal(result.invalidation.liquidity.spreadState,'TIGHT');
  assert.equal(result.invalidation.liquidity.spreadBps,1.8);
  assert.match(result.invalidation.liquidity.condition,/spread exceeds 15 bps/i);
  assert.match(result.stop.reason,/liquidity invalidation/i);
});

const scannerResult=(asset,{action='BUY',feasibility='FEASIBLE',lifecycle='TRIGGERED',eventRisk='unavailable'}={})=>({
  ...directionalGraph(),
  asset,
  interval:'15m',
  horizon:'4h',
  truthState:'LIVE',
  qellyView:{
    action,
    confidence:.8,
    label:'Research setup.',
    contradictions:[],
    evidenceGate:{
      qualityScore:.84,scenarioSeparation:.55,timeframeAgreement:.75,freshness:1,
      timeframeDirection:action==='SELL'?'SELL':'BUY',calibrationState:'CALIBRATED',calibrationEligible:true,quantCoverage:'derived'
    }
  },
  eventRisk:eventRisk==='live'
    ?{state:'live',level:'LOW',reason:'Verified low-risk calendar state.'}
    :{state:'unavailable',level:'UNAVAILABLE',reason:'No verified event calendar.'},
  tradeResearch:{
    status:'VALID',
    reason:'Evidence-qualified setup.',
    lifecycle:{state:lifecycle},
    selected:{
      label:'1:2',ratio:2,feasibility,target:110,targetCongestion:'CLEAR',
      selectionScore:92,selectionReason:'Structurally valid bounded selection.'
    },
    entry:{preferred:100},
    stop:{price:95},
    expiryAt:'2026-09-24T02:00:00.000Z'
  }
});

test('Wave R: scanner can restrict the governed universe and return a valid evidence-gated setup',async()=>{
  const calls=[];
  const scan=await runDecisionScan({},{
    now:Date.parse('2026-09-24T00:30:00.000Z'),
    assets:'BTC,ETH',
    direction:'long',
    minEvidenceQuality:.8,
    minCalibratedConfidence:.7,
    minMtfAgreement:.5,
    liquidity:'tight',
    freshness:'live',
    build:async(_env,{asset})=>{calls.push(asset);return scannerResult(asset);}
  });
  assert.deepEqual(calls.sort(),['BTC','ETH']);
  assert.deepEqual(scan.universe,['BTC','ETH']);
  assert.deepEqual(scan.governedUniverse,['BTC','ETH','SOL','HYPE','XRP','DOGE']);
  assert.equal(scan.state,'VALID_SETUP');
  assert.equal(scan.eligibleCount,2);
  assert.equal(scan.candidates[0].eligible,true);
  assert.equal(scan.candidates[0].trade.entryReady,true);
  assert.equal(scan.candidates[0].trade.feasibility,'FEASIBLE');
  assert.equal(scan.boundaries.noTradeFirstClass,true);
  assert.equal(scan.boundaries.rankingIsSuccessProbability,false);
});

test('Wave R: strict event-risk filters fail closed when the feed is unavailable',async()=>{
  const scan=await runDecisionScan({},{
    now:Date.parse('2026-09-24T00:30:00.000Z'),
    assets:'BTC',
    eventRiskTolerance:'low',
    build:async(_env,{asset})=>scannerResult(asset,{eventRisk:'unavailable'})
  });
  assert.equal(scan.state,'NO_ELIGIBLE_SETUP');
  assert.equal(scan.eligibleCount,0);
  assert.equal(scan.candidates[0].eligible,false);
  assert.ok(scan.candidates[0].filterFailures.includes('event_risk_unavailable'));
  assert.match(scan.eventRisk.reason,/does not invent/i);
});

test('Wave R: forming entry state stays conditional instead of being mislabeled immediately valid',async()=>{
  const scan=await runDecisionScan({},{
    now:Date.parse('2026-09-24T00:30:00.000Z'),
    assets:'BTC',
    build:async(_env,{asset})=>scannerResult(asset,{lifecycle:'FORMING'})
  });
  assert.equal(scan.state,'CONDITIONAL_SETUP');
  assert.equal(scan.eligibleCount,0);
  assert.equal(scan.conditionalCount,1);
  assert.equal(scan.candidates[0].conditional,true);
  assert.equal(scan.candidates[0].trade.entryReady,false);
});

test('Wave R: unsupported scanner assets and thresholds fail before provider work',async()=>{
  let called=false;
  await assert.rejects(()=>runDecisionScan({},{
    assets:'BTC,FAKE',
    build:async()=>{called=true;return scannerResult('BTC');}
  }),/Scanner assets must be drawn from/i);
  assert.equal(called,false);
  await assert.rejects(()=>runDecisionScan({},{
    minEvidenceQuality:1.5,
    build:async()=>{called=true;return scannerResult('BTC');}
  }),/minimum evidence quality must be between 0 and 1/i);
  assert.equal(called,false);
});

test('Wave R: Decision UI exposes governed scanner filters and semantic feasibility states responsively',async()=>{
  const route=await readFile(new URL('../apps/web/public/assets/routes/decision-proven-graph.mjs',import.meta.url),'utf8');
  const css=await readFile(new URL('../apps/web/public/assets/qelly-decision-proven-graph.css',import.meta.url),'utf8');
  for(const phrase of ['Find Trade Now filters','Min calibrated confidence','Event-risk tolerance','FIND TRADE NOW 2.0 · GOVERNED SCAN','Liquidity'])assert.match(route,new RegExp(phrase));
  assert.match(route,/data-dpg-scan-filter/);
  assert.match(route,/URLSearchParams/);
  assert.match(css,/\.q-dpg-scan-filters/);
  assert.match(css,/\.q-dpg-rr-card--highly-feasible/);
  assert.match(css,/\.q-dpg-rr-card--conditional/);
  assert.match(css,/@media\(max-width:540px\)/);
});
