import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {__decisionContextTest} from '../functions/_lib/decision-context.js';
import {compareDecisionSnapshots,__qellyChatToolsTest} from '../functions/_lib/qelly-chat-tools.js';
import {normalizeDecisionChatContext} from '../functions/api/v1/intelligence/chat.js';
import {__qellyChatTest} from '../apps/web/public/assets/ai/qelly-chat.mjs';
import {runGroundedFinanceInference} from '../functions/_lib/finance-intelligence.js';

const read=(path)=>readFile(new URL('../'+path,import.meta.url),'utf8');

const previous={
  observedAt:'2026-09-25T06:00:00.000Z',asset:'BTC',interval:'15m',price:84000,
  truthState:'LIVE',freshnessState:'LIVE',trendState:'uptrend',
  action:'BUY',confidence:.72,evidenceQuality:.78,
  calibrationState:'CALIBRATED',calibrationEligible:true,calibrationBrierScore:.19,calibrationReliabilityGap:.04,
  regime:'TRENDING',volatilityRegime:'NORMAL',structureState:'BREAKOUT',structureBias:'UPSIDE',
  timeframeDirection:'BUY',timeframeAgreement:.75,
  liquidityState:'live',liquiditySpreadBps:2,liquidityDepthConsensus:'BALANCED',
  derivativesState:'live',fundingPct:.001,fundingChangeBps:.1,openInterestNotionalUsd:2_000_000_000,openInterestChangeState:'UNAVAILABLE',
  newsState:'cached',
  tradeStatus:'VALID',lifecycle:'FORMING',selectedRr:'1:2',selectedRrFeasibility:'FEASIBLE',selectedTarget:85000,stopPrice:83500,expiryAt:'2026-09-25T10:00:00.000Z'
};

const current={
  ...previous,
  observedAt:'2026-09-25T06:15:00.000Z',price:83800,
  trendState:'range',action:'NO TRADE',confidence:.61,evidenceQuality:.59,
  calibrationState:'WEAK_CALIBRATION',calibrationEligible:false,calibrationBrierScore:.31,calibrationReliabilityGap:.12,
  regime:'RANGING',volatilityRegime:'HIGH',structureState:'RANGE',structureBias:'MIXED',
  timeframeDirection:'MIXED',timeframeAgreement:.25,
  liquiditySpreadBps:19,liquidityDepthConsensus:'ASK_HEAVY',
  fundingChangeBps:.7,openInterestNotionalUsd:2_120_000_000,
  newsState:'pending',
  tradeStatus:'NO_TRADE',lifecycle:'NO_TRADE',selectedRr:null,selectedRrFeasibility:null,selectedTarget:null,stopPrice:null,expiryAt:null,
  changeReasons:{
    calibrationState:'Walk-forward calibration quality no longer clears the gate.',
    timeframeDirection:'Independent timeframes no longer align directionally.',
    structureState:'Observed structure returned to a range.',
    liquiditySpreadBps:'Current verified spread exceeds the bounded liquidity threshold.',
    selectedRrFeasibility:'No evidence-qualified setup remains.',
    trendState:'Observed trend classification changed.',
    volatilityRegime:'Derived volatility regime changed.',
    price:'Observed market price changed.',
    fundingChangeBps:'Derivatives context changed; it does not force direction.',
    newsState:'Contextual news availability changed; news has no independent Decision eligibility impact.'
  }
};

test('Wave AO Decision snapshot preserves explicit attribution inputs without inference',()=>{
  const graph={
    truthState:'LIVE',freshness:{state:'LIVE'},asset:'BTC',interval:'15m',observedAt:'2026-09-25T06:15:00.000Z',
    market:{lastPrice:83800,currentState:{trend:'range'}},
    qellyView:{action:'NO TRADE',confidence:.61,evidenceGate:{qualityScore:.59},label:'Mixed evidence.'},
    quant:{calibration:{state:'WEAK_CALIBRATION',eligible:false,brierScore:.31,reliabilityGap:.12},regime:'RANGING',volatility:{regime:'HIGH'},structure:{state:'RANGE',bias:'MIXED'}}
  };
  const snapshot=__decisionContextTest.snapshot(graph,{
    multiTimeframe:{agreement:{direction:'MIXED',aligned:1,total:4}},
    tradeResearch:{status:'NO_TRADE',lifecycle:{state:'NO_TRADE'}},
    evidence:{
      liquidity:{state:'live',spreadBps:19,depthConsensus:'ASK_HEAVY'},
      derivatives:{state:'live',fundingPct:.001,fundingChangeBps:.7,openInterestNotionalUsd:2_120_000_000,openInterestChangeState:'UNAVAILABLE'},
      news:{state:'pending'},macro:{},eventRisk:{}
    },
    contradiction:{state:'CONFLICT',score:.5}
  });
  assert.equal(snapshot.truthState,'LIVE');
  assert.equal(snapshot.freshnessState,'LIVE');
  assert.equal(snapshot.trendState,'range');
  assert.equal(snapshot.liquidityState,'live');
  assert.equal(snapshot.liquiditySpreadBps,19);
  assert.equal(snapshot.liquidityDepthConsensus,'ASK_HEAVY');
  assert.equal(snapshot.derivativesState,'live');
  assert.equal(snapshot.newsState,'pending');
  assert.match(snapshot.changeReasons.newsState,/no independent Decision eligibility impact/i);
});

test('Wave AO ranks changed contributors by deterministic gate relevance, not retrospective causality',()=>{
  const changed=compareDecisionSnapshots(previous,current);
  assert.equal(changed.comparable,true);
  assert.equal(changed.state,'CHANGED');
  assert.deepEqual(changed.contributors.slice(0,5).map(item=>item.id),['calibration','mtf','structure','liquidity','targetFeasibility']);
  assert.equal(changed.contributors.find(item=>item.id==='derivatives').role,'risk_context');
  assert.equal(changed.contributors.find(item=>item.id==='news').role,'context_only');
  assert.ok(changed.contributors.find(item=>item.id==='news').rank>changed.contributors.find(item=>item.id==='derivatives').rank);
  assert.match(changed.attributionBoundary,/not market causality/i);
  assert.match(changed.attributionBoundary,/not.*learned feature importance/i);
  assert.ok(changed.changes.some(item=>item.field==='newsState'));
});

test('Wave AO browser and backend Decision handoff both whitelist new attribution fields',()=>{
  const payload={previousSnapshot:{...previous,secret:'drop'}};
  const backend=normalizeDecisionChatContext(payload);
  const browser=__qellyChatTest.normalizeDecisionContext(payload);
  for(const key of ['truthState','freshnessState','trendState','liquidityState','liquiditySpreadBps','liquidityDepthConsensus','derivativesState','newsState']){
    assert.equal(backend.previousSnapshot[key],previous[key],key);
    assert.equal(browser.previousSnapshot[key],previous[key],key);
  }
  assert.equal(backend.previousSnapshot.secret,undefined);
  assert.equal(browser.previousSnapshot.secret,undefined);
});

test('Wave AO QELLY Chat explains ranked attribution with the non-causality boundary',async()=>{
  const whatChanged=compareDecisionSnapshots(previous,current);
  const receipt={
    id:'decision-intelligence',
    data:{
      asset:'BTC',interval:'15m',horizon:'4h',action:'NO TRADE',confidence:.61,
      tradeResearch:{status:'NO_TRADE',rrMatrix:[]},
      contradictionAnalysis:{state:'CONFLICT',support:[],contradictions:[],neutral:[]},
      calibration:{state:'WEAK_CALIBRATION',eligible:false},
      scenarios:{probabilities:{}},multiTimeframe:{agreement:{}},
      whatChanged
    }
  };
  const result=await runGroundedFinanceInference({},{
    message:'What changed and what contributed most?',
    history:[],mode:'decision',
    financeContext:{generatedAt:'2026-09-25T06:15:00.000Z',observations:{},citations:[],datasetSummary:{},policy:{},tools:[receipt]}
  });
  assert.match(result.answer,/Ranked attribution contributors/i);
  assert.match(result.answer,/#1 Calibration/i);
  assert.match(result.answer,/#2 Multi-timeframe agreement/i);
  assert.match(result.answer,/not market causality/i);
  assert.doesNotMatch(result.answer,/news.*caused|derivatives.*caused/i);
});

test('Wave AO UI renders the same ranked methodology and all required contributor categories',async()=>{
  const route=await read('apps/web/public/assets/routes/decision-proven-graph.mjs');
  for(const phrase of ['Calibration','Multi-timeframe agreement','Market structure','Liquidity','Target / R:R feasibility','Freshness','Trend / regime','Volatility','Price','Derivatives','News context']){
    assert.ok(route.includes(phrase),phrase);
  }
  assert.match(route,/Ranked attribution contributors/);
  assert.match(route,/not market causality/);
  assert.match(route,/\['Liquidity spread','liquiditySpreadBps'\]/);
  assert.match(route,/\['News context','newsState'\]/);
});

test('Wave AO methodology export keeps the fixed contributor order inspectable',()=>{
  assert.deepEqual(
    __qellyChatToolsTest.CHANGE_ATTRIBUTION_GROUPS.map(item=>item.id),
    ['calibration','mtf','structure','liquidity','targetFeasibility','freshness','trend','volatility','price','derivatives','news']
  );
  assert.match(__qellyChatToolsTest.CHANGE_ATTRIBUTION_BOUNDARY,/fixed methodology order/);
});
