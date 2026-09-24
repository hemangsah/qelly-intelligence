import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {compactDecisionToolReceipt,compareDecisionSnapshots} from '../functions/_lib/qelly-chat-tools.js';
import {runGroundedFinanceInference,__financeIntelligenceTest} from '../functions/_lib/finance-intelligence.js';
import {handleIntelligenceChat,normalizeDecisionChatContext} from '../functions/api/v1/intelligence/chat.js';
import {__qellyChatTest} from '../apps/web/public/assets/ai/qelly-chat.mjs';

const SITE='https://terminal.qellyintelligence.com';
const read=(path)=>readFile(new URL(`../${path}`,import.meta.url),'utf8');

function decisionFixture(){
  return {
    asset:'BTC',interval:'15m',horizon:'4h',truthState:'LIVE',observedAt:'2026-09-24T19:15:00.000Z',
    freshness:{state:'LIVE'},
    market:{lastPrice:84559,currentState:{label:'range · neutral momentum',regime:'HIGH_VOLATILITY'}},
    qellyView:{
      action:'NO TRADE',confidence:.63,label:'Evidence is mixed.',changesIf:'A clearer directional edge appears with fresh evidence.',
      contradictions:['Calibration remains weak.'],
      evidenceGate:{directionalEligible:false,qualityScore:.664}
    },
    confidence:{calibration:'Evidence confidence is not a success probability.'},
    quant:{calibration:{state:'WEAK_CALIBRATION',eligible:false,sampleSize:58,brierScore:.2491,reliabilityGap:.091,skillScore:-.03,reason:'Reliability gate not passed.',method:'Walk-forward',leakageGuard:'Past-only cuts.'}},
    forecast:{probabilities:{bull:.3555,base:.1875,bear:.457},terminal:{p05:83298.94,p50:84470.5,p95:85568.64}},
    multiTimeframe:{
      agreement:{direction:'MIXED',aligned:1,total:4},
      views:[
        {interval:'5m',qellyView:{action:'BUY',confidence:.58}},
        {interval:'15m',qellyView:{action:'NO TRADE',confidence:.63}},
        {interval:'1h',qellyView:{action:'SELL',confidence:.61}}
      ]
    },
    tradeResearch:{
      status:'NO_TRADE',lifecycle:{state:'NO_TRADE'},entry:null,stop:null,invalidation:null,requestedRr:'2',selected:null,targets:[],
      matrix:[
        {label:'1:1',ratio:1,target:85000,feasibility:'FEASIBLE',feasibilityReason:'Inside current scenario range.',structuralBarrier:null},
        {label:'1:2',ratio:2,target:85800,feasibility:'OUTSIDE_FORECAST_RANGE',feasibilityReason:'Target exceeds the evidence-supported scenario range.',structuralBarrier:85500}
      ],
      expiryAt:null,reason:'The current evidence gate does not support a directional setup.'
    },
    evidence:{
      news:{state:'no-matches',provider:'GDELT',articles:[]},
      liquidity:{state:'live'},
      derivatives:{state:'live',fundingPct:.0011,fundingChangeBps:.2,openInterestNotionalUsd:2_000_000_000,openInterestChangeState:'UNAVAILABLE',markOracleBasisChangeState:'UNAVAILABLE',liquidationsState:'UNAVAILABLE'},
      crossAsset:{state:'available',benchmark:'ETH',correlation:.92,beta:.77,relativeStrengthPct:.31,divergenceState:'ALIGNED',eligibilityImpact:'none'},
      macro:{state:'available',level:'DAILY_REFERENCE',provider:'ecb-reference-rates',observedAt:'2026-09-24T16:00:00.000Z',freshness:'daily-working-day-reference',fxReference:{usdInr:95.959796},intradayFeedConnected:false,reason:'Official ECB daily FX reference only.'},
      eventRisk:{state:'unavailable',level:'UNAVAILABLE',scheduledFeedConnected:false,eventCount:0,reason:'No verified machine-readable scheduled feed.',calendarBoundary:'TradingView embed is display-only.',newsBoundary:'News is not converted to scheduled event risk.',gatingBoundary:'No verified schedule, so no event gating.'},
      liquidations:{state:'unavailable'},
      options:{state:'unavailable'},
      onChain:{state:'unavailable'}
    },
    selection:{
      start:1790244000000,end:1790251200000,candles:9,startPrice:84000,endPrice:84559,changePct:.665,rangePct:1.4,volumeRatio:1.3,volatilityPct:.42,
      support:83800,resistance:85000,regime:'RANGE',structure:{state:'RANGE',bias:'MIXED'},
      evidence:[{type:'price',title:'Price advanced 0.67%',detail:'Observed move.',direction:'supports upside'}]
    },
    historicalAnalogs:{
      state:'AVAILABLE',eligibilityImpact:'none',leakageGuard:'No forward outcome is used for matching.',outcomeBoundary:'Descriptive only.',
      summary:{count:5,medianForwardReturnPct:.8,q25ForwardReturnPct:-.4,q75ForwardReturnPct:1.6,medianMfePct:1.9,medianMaePct:-1.2,medianTimeToResolutionMs:7200000},
      analogs:[{rank:1,observedAt:'2026-09-10T00:00:00Z',similarity:.86,regime:'RANGE',volatilityRegime:'HIGH',forwardReturnPct:.5,maxFavorablePct:1.2,maxAdversePct:-.8,timeToResolutionMs:7200000}]
    },
    contradictionAnalysis:{
      state:'CONFLICT',score:.5,strongestSupport:'Trend slope is non-negative.',strongestContradiction:'Calibration remains weak.',
      support:['Trend slope is non-negative.'],contradictions:['Calibration remains weak.'],neutral:['Scheduled event risk unavailable; no directional inference was added.'],unresolved:true
    },
    pastPresentFuture:{
      past:{moveDirection:'UPSIDE',strongestSupport:{title:'Price advanced 0.67%'},strongestContradiction:null,historicalDerivatives:{state:'available'},crossAsset:{state:'available'}},
      present:{freshness:'LIVE',regime:'HIGH_VOLATILITY',qellyView:{action:'NO TRADE'},currentSetup:{status:'NO_TRADE'}},
      future:{
        scenarios:{bull:.3555,base:.1875,bear:.457},
        scenarioDetails:{
          bull:{probability:.3555,trigger:'Break resistance.',invalidation:'Lose support.',whatChanges:'Stronger upside evidence.'},
          base:{probability:.1875,trigger:'Stay in range.',invalidation:'Directional break.',whatChanges:'More mixed evidence.'},
          bear:{probability:.457,trigger:'Break support.',invalidation:'Recover resistance.',whatChanges:'Stronger downside evidence.'}
        },
        expectedRange:{p05:83298.94,p50:84470.5,p95:85568.64},
        probabilityCalibration:{state:'WEAK_CALIBRATION',eligible:false,sampleSize:58,brierScore:.2491,reliabilityGap:.091,boundary:'Not a guarantee.'},
        boundary:'Scenario probabilities are model outputs with separate calibration state; they are not guaranteed outcomes.'
      }
    },
    evidenceGraph:{
      schemaVersion:'qelly.evidence-graph/2.0.0',eligibilityImpact:'none',boundary:'Explanatory only.',
      pipeline:[
        {order:1,id:'raw',label:'Raw provider observation',stage:'RAW_OBSERVATION',freshness:'LIVE',supportState:'OBSERVATION'},
        {order:10,id:'outcome',label:'Observed setup outcome',stage:'OUTCOME',freshness:'UNAVAILABLE',supportState:'PENDING'}
      ],
      nodes:[
        {id:'raw',kind:'raw-observation',label:'Raw provider observation',stage:'RAW_OBSERVATION',freshness:'LIVE',importance:'CRITICAL',supportState:'OBSERVATION',confidence:null,role:'observation',reliability:'VENUE_OBSERVED',source:'Hyperliquid',limitations:[]},
        {id:'calibration',kind:'calibration',label:'Walk-forward probability calibration',freshness:'DELAYED',importance:'CRITICAL',supportState:'CONTRADICTION',confidence:null,role:'eligibility_gate',reliability:'GATE_NOT_PASSED',source:'QELLY derived research',limitations:['Weak calibration.']}
      ]
    },
    decisionSnapshot:{
      schemaVersion:'qelly.decision-snapshot/2.0.0',observedAt:'2026-09-24T19:15:00.000Z',asset:'BTC',interval:'15m',price:84559,action:'NO TRADE',confidence:.63,evidenceQuality:.664,
      calibrationState:'WEAK_CALIBRATION',calibrationEligible:false,calibrationBrierScore:.2491,calibrationReliabilityGap:.091,regime:'HIGH_VOLATILITY',volatilityRegime:'HIGH',
      structureState:'RANGE',structureBias:'MIXED',timeframeDirection:'MIXED',timeframeAgreement:.25,fundingPct:.0011,fundingChangeBps:.2,openInterestNotionalUsd:2_000_000_000,
      openInterestChangeState:'UNAVAILABLE',macroState:'available',macroLevel:'DAILY_REFERENCE',macroUsdInr:95.959796,eventRiskState:'unavailable',eventRiskLevel:'UNAVAILABLE',
      contradictionState:'CONFLICT',contradictionScore:.5,tradeStatus:'NO_TRADE',lifecycle:'NO_TRADE',entryMethod:null,entryPreferred:null,selectedRr:null,selectedRrFeasibility:null,
      selectedTarget:null,invalidationPrice:null,stopPrice:null,expiryAt:null,
      changeReasons:{action:'Evidence gate changed.',calibrationState:'Walk-forward calibration evidence changed.'}
    },
    provenance:{provider:'Hyperliquid',documentation:'https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/info-endpoint',model:{limitations:['Research only.']}}
  };
}

const priorSnapshot={
  observedAt:'2026-09-24T19:00:00.000Z',asset:'BTC',interval:'15m',price:84620,action:'WAIT',confidence:.66,evidenceQuality:.69,
  calibrationState:'CALIBRATED',calibrationEligible:true,calibrationBrierScore:.21,calibrationReliabilityGap:.05,regime:'HIGH_VOLATILITY',volatilityRegime:'HIGH',
  structureState:'RANGE',structureBias:'MIXED',timeframeDirection:'BUY',timeframeAgreement:.5,tradeStatus:'NO_TRADE',lifecycle:'NO_TRADE'
};

const baseFinanceContext={
  generatedAt:'2026-09-24T19:15:10.000Z',
  observations:{hyperliquid:[],crypto:null,worldBank:{observations:[]},ecb:{rates:null}},
  citations:[],
  datasetSummary:{connected:4,catalogued:24},
  policy:{fabricatedFallback:false},
  tools:[]
};

test('Wave Y normalizes Decision handoff and discards untrusted extra fields',()=>{
  const normalized=normalizeDecisionChatContext({
    horizon:'4h',rr:'custom',customRr:2.5,
    selection:{start:1000,end:2000,extra:'drop'},
    previousSnapshot:{asset:'BTC',interval:'15m',action:'WAIT',confidence:.5,secret:{nested:true}},
    arbitrary:'drop'
  });
  assert.deepEqual(normalized.selection,{start:1000,end:2000});
  assert.equal(normalized.horizon,'4h');
  assert.equal(normalized.rr,'custom');
  assert.equal(normalized.customRr,2.5);
  assert.equal(normalized.previousSnapshot.asset,'BTC');
  assert.equal(normalized.previousSnapshot.secret,undefined);

  assert.deepEqual(normalizeDecisionChatContext({horizon:'99d',rr:'custom',customRr:99,selection:{start:5,end:1}}),{
    horizon:null,rr:'auto',customRr:null,selection:null,previousSnapshot:null
  });
});

test('Wave Y browser-side Decision context normalization mirrors backend safety bounds',()=>{
  const normalized=__qellyChatTest.normalizeDecisionContext({
    horizon:'1d',rr:'3',selection:{start:10,end:20},
    previousSnapshot:{asset:'ETH',interval:'1h',confidence:.7,ignored:['x']}
  });
  assert.equal(normalized.horizon,'1d');
  assert.equal(normalized.rr,'3');
  assert.deepEqual(normalized.selection,{start:10,end:20});
  assert.equal(normalized.previousSnapshot.asset,'ETH');
  assert.equal(normalized.previousSnapshot.ignored,undefined);
});

test('Wave Y authoritative Decision receipt carries PPF, R:R, calibration, evidence graph and What Changed without a second engine',()=>{
  const result=decisionFixture();
  const receipt=compactDecisionToolReceipt(result,{requestContext:{horizon:'4h',rr:'2',customRr:null,selection:{start:result.selection.start,end:result.selection.end},previousSnapshot:priorSnapshot}});
  assert.equal(receipt.id,'decision-intelligence');
  assert.equal(receipt.data.schemaVersion,'qelly.decision-copilot-context/2.0.0');
  assert.equal(receipt.data.requestContext.requestedRr,'2');
  assert.equal(receipt.data.tradeResearch.rrMatrix.length,2);
  assert.equal(receipt.data.tradeResearch.rrMatrix[1].feasibility,'OUTSIDE_FORECAST_RANGE');
  assert.equal(receipt.data.scenarios.probabilities.bear,.457);
  assert.equal(receipt.data.calibration.state,'WEAK_CALIBRATION');
  assert.equal(receipt.data.eventRisk.scheduledFeedConnected,false);
  assert.equal(receipt.data.derivatives.openInterestChangeState,'UNAVAILABLE');
  assert.equal(receipt.data.historicalAnalogs.eligibilityImpact,'none');
  assert.equal(receipt.data.evidenceGraph.schemaVersion,'qelly.evidence-graph/2.0.0');
  assert.ok(receipt.data.sourceLedger.some(item=>item.id==='raw'));
  assert.equal(receipt.data.whatChanged.comparable,true);
  assert.ok(receipt.data.whatChanged.changes.some(item=>item.field==='action'&&item.reason==='Evidence gate changed.'));
  assert.match(receipt.limitations.join(' '),/does not create a second Decision engine/i);
});

test('Wave Y snapshot comparison is same-asset/timeframe only and carries evidence-backed change reasons',()=>{
  const current=decisionFixture().decisionSnapshot;
  const changed=compareDecisionSnapshots(priorSnapshot,current);
  assert.equal(changed.state,'CHANGED');
  assert.equal(changed.comparable,true);
  assert.ok(changed.changes.some(item=>item.field==='calibrationState'&&item.reason==='Walk-forward calibration evidence changed.'));
  const incomparable=compareDecisionSnapshots({...priorSnapshot,asset:'ETH'},current);
  assert.equal(incomparable.state,'INCOMPARABLE');
  assert.equal(incomparable.comparable,false);
});

test('Wave Y deterministic Decision Copilot answers no-trade, R:R, selected range, calibration and unavailable-data questions',async()=>{
  const receipt=compactDecisionToolReceipt(decisionFixture(),{requestContext:{horizon:'4h',rr:'2',selection:{start:1790244000000,end:1790251200000},previousSnapshot:priorSnapshot}});
  const context={...baseFinanceContext,tools:[receipt]};
  const cases=[
    ['Why no trade?',[/Setup state: NO TRADE/i,/current evidence gate does not support/i,/Strongest contradiction: Calibration remains weak/i]],
    ['Why is 1:2 R:R not feasible?',[/1:2 — OUTSIDE FORECAST RANGE/i,/exceeds the evidence-supported scenario range/i]],
    ['Explain the selected candle range',[/Selected range:/i,/Observed move:/i,/Move evidence:/i]],
    ['Explain calibration and scenario probabilities',[/Scenario distribution:/i,/Calibration: WEAK CALIBRATION/i,/not guaranteed outcomes/i]],
    ['What data is unavailable in this Decision?',[/Unavailable evidence:/i,/liquidations/i,/Historical open-interest change is unavailable/i,/scheduled-event feed/i]],
    ['What changed?',[/Tracked changes:/i,/action: WAIT → NO TRADE/i,/Evidence gate changed/i]]
  ];
  for(const [question,patterns] of cases){
    const result=await runGroundedFinanceInference({}, {message:question,history:[],financeContext:context,mode:'decision'});
    assert.equal(result.provider,'qelly-dataset-engine');
    assert.equal(result.state,'grounded_fallback');
    for(const pattern of patterns)assert.match(result.answer,pattern,question+' '+pattern);
    assert.doesNotMatch(result.answer,/buy now|sell now|guaranteed profit/i);
  }
});

test('Wave Y Decision-mode data-limit questions do not fall through to the global dataset registry',async()=>{
  const receipt=compactDecisionToolReceipt(decisionFixture(),{requestContext:{horizon:'4h',rr:'auto',previousSnapshot:priorSnapshot}});
  const result=await runGroundedFinanceInference({}, {message:'What data is unavailable in this Decision?',history:[],financeContext:{...baseFinanceContext,tools:[receipt]},mode:'decision'});
  assert.notEqual(result.state,'grounded_registry_answer');
  assert.match(result.answer,/Unavailable evidence:/);
  assert.doesNotMatch(result.answer,/governed dataset entries/i);
});

test('Wave Y endpoint calls the authoritative Decision builder once with exact sanitized handoff and returns one Decision receipt',async()=>{
  const result=decisionFixture();
  let decisionCalls=0,decisionOptions=null,financeCalls=0;
  const env={
    async __buildFinanceContext(){financeCalls+=1;return baseFinanceContext;},
    async __buildDecisionIntelligence(_env,options){decisionCalls+=1;decisionOptions=options;return result;}
  };
  const body={
    message:'Why no trade?',
    mode:'decision',asset:'BTC',timeframe:'15m',
    decisionContext:{
      horizon:'4h',rr:'custom',customRr:2.5,
      selection:{start:1790244000000,end:1790251200000,ignored:true},
      previousSnapshot:{...priorSnapshot,secret:{drop:true}},
      ignored:'drop'
    }
  };
  const response=await handleIntelligenceChat({request:new Request(SITE+'/api/v1/intelligence/chat',{method:'POST',headers:{Origin:SITE,'Content-Type':'application/json'},body:JSON.stringify(body)}),env});
  assert.equal(response.status,200);
  const payload=await response.json();
  assert.equal(financeCalls,1);
  assert.equal(decisionCalls,1);
  assert.deepEqual(decisionOptions,{
    asset:'BTC',interval:'15m',horizon:'4h',
    selection:{start:1790244000000,end:1790251200000},
    requestedRr:'custom',customRr:2.5
  });
  assert.equal(payload.tools.filter(item=>item.id==='decision-intelligence').length,1);
  assert.equal(payload.tools.find(item=>item.id==='decision-intelligence').data.whatChanged.comparable,true);
  assert.match(payload.content,/Setup state: NO TRADE/i);
});

test('Wave Y frontend hands Decision horizon R:R selection and prior snapshot to the existing global chat path',async()=>{
  const [decisionRoute,chat,endpoint,tools,finance]=await Promise.all([
    read('apps/web/public/assets/routes/decision-proven-graph.mjs'),
    read('apps/web/public/assets/ai/qelly-chat.mjs'),
    read('functions/api/v1/intelligence/chat.js'),
    read('functions/_lib/qelly-chat-tools.js'),
    read('functions/_lib/finance-intelligence.js')
  ]);
  for(const phrase of [
    'decisionContext:{',
    'horizon:state.horizon',
    'rr:state.rr',
    'selection:state.selection||state.draft||null',
    'previousSnapshot:state.previousSnapshot||null'
  ])assert.ok(decisionRoute.includes(phrase),phrase);
  assert.match(chat,/decisionContext:mode==='decision'\?decisionContext:null/);
  assert.match(chat,/normalizeDecisionContext/);
  assert.match(endpoint,/normalizeDecisionChatContext\(body\.decisionContext\)/);
  assert.match(endpoint,/requestedRr:decisionContext\.rr/);
  assert.equal((endpoint.match(/buildDecisionIntelligence/g)||[]).length,2); // import + one authoritative runtime call
  assert.match(tools,/qelly\.decision-copilot-context\/2\.0\.0/);
  assert.match(finance,/does not create a second Decision engine/i);
  assert.match(__financeIntelligenceTest.systemPrompt,/authoritative current Decision context/i);
});
