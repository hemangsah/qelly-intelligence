import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {buildDecisionContextBundle} from '../functions/_lib/decision-context.js';

const graph={
  graphId:'dpg-btc-15m-test',
  generatedAt:'2026-09-23T08:00:00.000Z',
  observedAt:'2026-09-23T07:45:00.000Z',
  truthState:'LIVE',
  asset:'BTC',
  interval:'15m',
  horizonBars:16,
  execution:false,
  market:{lastPrice:100,currentState:{label:'uptrend · positive momentum'},points:240},
  metrics:{rsi14:58,returnZScore:.4},
  quant:{
    regime:'TRENDING',
    trend:{regime:'TREND_UP',roc14Pct:2.1},
    volatility:{regime:'NORMAL',expectedMovePct:2.4},
    structure:{state:'HH_HL',support:97,resistance:104},
    calibration:{state:'CALIBRATED',eligible:true,sampleSize:60,brierScore:.22,reliabilityGap:.08,lastResolvedAt:'2026-09-23T06:00:00.000Z',method:'walk-forward',reason:'gate passed'}
  },
  forecast:{probabilities:{bull:.58,base:.24,bear:.18},terminal:{p05:96,p50:101,p95:106}},
  qellyView:{
    action:'BUY',
    confidence:.78,
    evidenceGate:{qualityScore:.82},
    label:'Research signal only.',
    why:['Trend and momentum support upside.','Multi-timeframe evidence aligns.'],
    contradictions:['Current funding is elevated.'],
    changesIf:'Structure fails or multi-timeframe agreement breaks.'
  },
  selection:{
    start:'2026-09-23T04:00:00.000Z',
    end:'2026-09-23T05:00:00.000Z',
    candles:5,
    changePct:1.2,
    rangePct:1.8,
    volumeRatio:1.4,
    volatilityPct:.6,
    priorVolatilityPct:.4,
    evidence:[{type:'price',title:'Price advanced 1.2%',strength:.7}]
  },
  historicalAnalogs:{
    state:'AVAILABLE',
    sampledWindows:20,
    summary:{count:5,medianForwardReturnPct:.4,positiveShare:.6,negativeShare:.4,medianSimilarity:.8},
    eligibilityImpact:'none',
    method:'pre-anchor features only'
  },
  provenance:{provider:'Hyperliquid'}
};

const multiTimeframe={
  state:'live',
  agreement:{direction:'BUY',aligned:3,directional:3,total:4},
  views:[]
};

const tradeResearch={
  status:'VALID',
  lifecycle:{state:'TRIGGERED'},
  selected:{label:'1:2',ratio:2,target:104,feasibility:'HIGH'},
  entry:{preferred:100,method:'NOW'},
  stop:{price:98},
  expiryAt:'2026-09-23T12:00:00.000Z',
  matrix:[
    {label:'1:1',ratio:1,target:102,feasibility:'HIGH',structuralBarrier:null,feasibilityReason:'inside range'},
    {label:'1:2',ratio:2,target:104,feasibility:'HIGH',structuralBarrier:null,feasibilityReason:'inside range'}
  ]
};

const evidence={
  liquidity:{state:'live',provider:'Hyperliquid',observedAt:'2026-09-23T07:45:00.000Z'},
  derivatives:{state:'live',provider:'Hyperliquid',observedAt:'2026-09-23T07:45:00.000Z'},
  crossAsset:{state:'available',provider:'Hyperliquid candles',benchmark:'ETH',correlation:.8,method:'bounded returns'},
  news:{state:'live',provider:'GDELT',articles:[]},
  macro:{state:'unavailable'},
  eventRisk:{state:'unavailable'},
  liquidations:{state:'unavailable'},
  options:{state:'unavailable'},
  onChain:{state:'unavailable'}
};

test('Decision context bundle exposes structured Past Present Future without altering eligibility',()=>{
  const bundle=buildDecisionContextBundle(graph,{multiTimeframe,tradeResearch,evidence,horizon:'4h'});
  assert.equal(bundle.boundary.includes('Existing evidence'),true);
  assert.equal(bundle.pastPresentFuture.present.qellyView.action,'BUY');
  assert.equal(bundle.pastPresentFuture.present.calibration.state,'CALIBRATED');
  assert.equal(bundle.pastPresentFuture.future.scenarios.bull,.58);
  assert.equal(bundle.pastPresentFuture.future.targetFeasibility[1].label,'1:2');
  assert.equal(bundle.pastPresentFuture.past.historicalAnalogs.eligibilityImpact,'none');
});

test('Decision Trace is provenance-rich and explicitly non-gating',()=>{
  const bundle=buildDecisionContextBundle(graph,{multiTimeframe,tradeResearch,evidence,horizon:'4h'});
  assert.equal(bundle.decisionTrace.eligibilityImpact,'none');
  const ids=bundle.decisionTrace.nodes.map(node=>node.id);
  for(const id of ['price','quant','mtf','calibration','liquidity','derivatives','cross-asset','news','analogs','scenario','view','setup'])assert.ok(ids.includes(id));
  assert.ok(bundle.decisionTrace.edges.some(edge=>edge.from==='calibration'&&edge.to==='view'));
  assert.ok(bundle.decisionTrace.textAlternative.length===bundle.decisionTrace.edges.length);
  assert.match(bundle.decisionTrace.boundary,/does not add a second hidden decision engine/i);
});

test('contradiction analysis separates support, contradiction and neutral unavailable evidence',()=>{
  const bundle=buildDecisionContextBundle(graph,{multiTimeframe,tradeResearch,evidence,horizon:'4h'});
  assert.equal(bundle.contradictionAnalysis.state,'CONFLICT');
  assert.equal(bundle.contradictionAnalysis.strongestContradiction,'Current funding is elevated.');
  assert.ok(bundle.contradictionAnalysis.support.length>=1);
  assert.ok(bundle.contradictionAnalysis.neutral.some(item=>/Macro unavailable/i.test(item)));
  assert.match(bundle.contradictionAnalysis.note,/does not independently create direction/i);
});

test('Decision snapshot is bounded for same-session What Changed comparisons',()=>{
  const bundle=buildDecisionContextBundle(graph,{multiTimeframe,tradeResearch,evidence,horizon:'4h'});
  assert.equal(bundle.decisionSnapshot.asset,'BTC');
  assert.equal(bundle.decisionSnapshot.interval,'15m');
  assert.equal(bundle.decisionSnapshot.action,'BUY');
  assert.equal(bundle.decisionSnapshot.timeframeAgreement,.75);
  assert.equal(bundle.decisionSnapshot.selectedRr,'1:2');
  assert.equal(bundle.decisionSnapshot.selectedRrFeasibility,'HIGH');
});

test('Decision UI renders Wave J context, trace and mobile-safe What Changed panels',async()=>{
  const [route,css,endpoint]=await Promise.all([
    readFile(new URL('../apps/web/public/assets/routes/decision-proven-graph.mjs',import.meta.url),'utf8'),
    readFile(new URL('../apps/web/public/assets/qelly-decision-proven-graph.css',import.meta.url),'utf8'),
    readFile(new URL('../functions/api/v1/decision-proven-graph.js',import.meta.url),'utf8')
  ]);
  for(const phrase of ['PAST','PRESENT','FUTURE','CONTRADICTION ENGINE','DECISION TRACE · EVIDENCE GRAPH','WHAT CHANGED?','NO SECOND DECISION ENGINE'])assert.match(route,new RegExp(phrase.replace(/[?]/g,'\\?')));
  assert.match(route,/pastPresentFutureMarkup\(data,escapeHtml\)/);
  assert.match(route,/whatChangedMarkup\(state\.previousSnapshot,data\.decisionSnapshot,escapeHtml\)/);
  assert.match(css,/\.q-dpg-ppf\{/);
  assert.match(css,/\.q-dpg-trace__nodes\{/);
  assert.match(css,/\.q-dpg-what-changed/);
  assert.match(css,/@media\(max-width:520px\)/);
  assert.match(endpoint,/buildDecisionContextBundle/);
  assert.match(endpoint,/\.\.\.context/);
});
