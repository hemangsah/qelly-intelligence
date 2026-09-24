import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {buildDecisionContextBundle} from '../functions/_lib/decision-context.js';
import {buildDecisionHistoricalAnalogs} from '../functions/_lib/decision-historical-analogs.js';
import {buildDecisionProvenGraph} from '../functions/_lib/decision-proven-graph.js';

const read=(path)=>readFile(new URL(`../${path}`,import.meta.url),'utf8');

function candles(count=520,{start=1_790_000_000_000,step=900_000}={}){
  const rows=[];
  let close=100;
  for(let i=0;i<count;i++){
    const drift=i<170?.0012:i<340?-.00065:.00085;
    const cyc=Math.sin(i/7)*.0024+Math.cos(i/19)*.0011;
    const open=close;
    close=Math.max(1,open*Math.exp(drift+cyc));
    const width=.0025+Math.abs(Math.sin(i/11))*.0015;
    rows.push({
      t:start+i*step,
      o:open,
      h:Math.max(open,close)*(1+width),
      l:Math.min(open,close)*(1-width*.9),
      c:close,
      v:900+(i%29)*31,
      n:120+(i%41)
    });
  }
  return rows;
}

test('Wave X selected move exposes structure support resistance volume and technical context without a second fetch',()=>{
  const rows=candles(260);
  const start=rows[120].t,end=rows[190].t;
  const graph=buildDecisionProvenGraph(rows,{
    asset:'BTC',
    interval:'15m',
    horizonBars:16,
    now:rows.at(-1).t,
    selection:{start,end},
    scenarioPaths:64
  });
  const move=graph.selection;
  assert.ok(move);
  assert.ok(move.candles>=60);
  assert.ok(Number.isFinite(move.startPrice));
  assert.ok(Number.isFinite(move.endPrice));
  assert.ok(Number.isFinite(move.support));
  assert.ok(Number.isFinite(move.resistance));
  assert.ok(move.structure&&typeof move.structure==='object');
  assert.ok(typeof move.regime==='string');
  assert.ok(Number.isFinite(move.averageVolume));
  assert.ok(Array.isArray(move.evidence));
});

test('Wave X historical analogs add dispersion MFE MAE and time-to-resolution while preserving leakage guard',()=>{
  const result=buildDecisionHistoricalAnalogs(candles(),{interval:'15m',horizonBars:16,windowBars:100,limit:5});
  assert.equal(result.state,'AVAILABLE');
  assert.ok(result.analogs.length>0);
  assert.ok(Number.isFinite(result.summary.q25ForwardReturnPct));
  assert.ok(Number.isFinite(result.summary.q75ForwardReturnPct));
  assert.ok(Number.isFinite(result.summary.medianMfePct));
  assert.ok(Number.isFinite(result.summary.medianMaePct));
  assert.ok(Number.isFinite(result.summary.medianTimeToResolutionMs));
  assert.ok(result.analogs.every(item=>Number.isFinite(item.timeToResolutionMs)&&item.timeToResolutionMs>0));
  assert.match(result.leakageGuard,/No forward return, favorable excursion or adverse excursion is used/i);
  assert.match(result.outcomeBoundary,/descriptive historical context, not probability calibration or a trade signal/i);
});

function contextFixture(){
  const observedAt='2026-09-24T18:00:00.000Z';
  const graph={
    graphId:'dpg-wave-x',
    generatedAt:'2026-09-24T18:00:10.000Z',
    observedAt,
    truthState:'LIVE',
    asset:'BTC',
    interval:'15m',
    horizonBars:16,
    freshness:{ageMs:10_000,intervalMs:900_000,state:'LIVE'},
    market:{lastPrice:100,currentState:{label:'uptrend · positive momentum'}},
    selection:{
      start:'2026-09-24T10:00:00.000Z',end:'2026-09-24T12:00:00.000Z',candles:9,startPrice:96,endPrice:99,
      changePct:3.125,rangePct:4.2,volumeRatio:1.4,averageVolume:1200,volatilityPct:.5,priorVolatilityPct:.3,
      support:95,resistance:100,structure:{state:'HH_HL',bias:'UPSIDE'},regime:'TRENDING',
      trend:{regime:'UPTREND'},technicalComparison:{rsi14:{before:48,during:61,change:13}},
      evidence:[
        {type:'price',title:'Price advanced 3.13%',detail:'Observed move.',direction:'supports upside',strength:.8},
        {type:'volume',title:'Volume ran 1.4× prior',detail:'Participation context.',direction:'confirms participation',strength:.4}
      ]
    },
    metrics:{rsi14:61,returnZScore:.8},
    quant:{
      state:'DERIVED',
      regime:'TRENDING',
      structure:{state:'HH_HL',bias:'UPSIDE',support:95,resistance:105},
      trend:{regime:'UPTREND',roc14Pct:2.1},
      volatility:{regime:'NORMAL',expectedMovePct:2},
      calibration:{state:'CALIBRATED',eligible:true,sampleSize:80,brierScore:.21,skillScore:.12,reliabilityGap:.06,lastResolvedAt:'2026-09-24T17:00:00.000Z'}
    },
    forecast:{
      probabilities:{bull:.62,base:.20,bear:.18},
      terminal:{p05:94,p50:103,p95:109},
      fan:[{p05:94,p25:99,p50:103,p75:106,p95:109}]
    },
    historicalAnalogs:{
      state:'AVAILABLE',sampledWindows:28,
      summary:{count:5,medianForwardReturnPct:1.2,q25ForwardReturnPct:-.3,q75ForwardReturnPct:2.4,medianMfePct:2.8,medianMaePct:-1.1,medianTimeToResolutionMs:14_400_000},
      leakageGuard:'No forward return is used in similarity.',outcomeBoundary:'Descriptive only.',eligibilityImpact:'none',
      analogs:[]
    },
    provenance:{provider:'Hyperliquid'},
    confidence:{score:.72},
    qellyView:{
      action:'BUY',confidence:.72,label:'Research signal only.',changesIf:'Support fails or evidence weakens.',
      why:['Trend supports upside.'],contradictions:[],
      evidenceGate:{qualityScore:.78}
    }
  };
  const tradeResearch={
    status:'VALID',confidence:.72,
    lifecycle:{state:'TRIGGERED',historyAvailable:false,reason:'Current trigger only.'},
    entry:{method:'NOW',preferred:100,zone:[99,101]},
    stop:{price:95},
    invalidation:{price:{state:'ACTIVE',price:95},structure:{state:'ACTIVE',price:95}},
    selected:{label:'1:2',ratio:2,target:110,feasibility:'FEASIBLE',feasibilityReason:'Inside scenario range.'},
    matrix:[
      {label:'1:1',ratio:1,target:105,feasibility:'FEASIBLE',structuralBarrier:null,feasibilityReason:'Supported.'},
      {label:'1:2',ratio:2,target:110,feasibility:'FEASIBLE',structuralBarrier:null,feasibilityReason:'Inside scenario range.'},
      {label:'1:4',ratio:4,target:120,feasibility:'OUTSIDE_FORECAST_RANGE',structuralBarrier:105,feasibilityReason:'Target exceeds current scenario/structure support.'}
    ],
    targets:[{rank:1,label:'1:1',price:105},{rank:2,label:'1:2',price:110}],
    expiryAt:'2026-09-24T20:00:00.000Z'
  };
  const evidence={
    news:{state:'live',provider:'GDELT',articles:[{title:'Bitcoin market update',source:'example.com',publishedAt:'2026-09-24T11:00:00.000Z',url:'https://example.com/a'}]},
    liquidity:{state:'live',provider:'Hyperliquid',observedAt,spreadBps:1},
    derivatives:{state:'live',provider:'Hyperliquid',observedAt,fundingPct:.001,fundingChangeBps:.2,openInterestNotionalUsd:2_000_000_000,openInterestChangeState:'UNAVAILABLE'},
    crossAsset:{state:'available',provider:'Hyperliquid candles',observedAt,benchmark:'ETH'},
    selectedCrossAsset:{state:'available',asset:'BTC',benchmark:'ETH',correlation:.8},
    macro:{state:'available',level:'DAILY_REFERENCE',provider:'ecb-reference-rates',observedAt:'2026-09-24T16:00:00.000Z',fxReference:{usdInr:90}},
    eventRisk:{state:'unavailable',level:'UNAVAILABLE',events:[],gatingBoundary:'No verified schedule.',calendarBoundary:'Embed not read.',newsBoundary:'News is not schedule.'},
    historicalDerivatives:{state:'available',provider:'Hyperliquid settled funding history',boundary:'Only settled funding in range.'},
    options:{state:'unavailable',message:'Options unavailable.'},
    onChain:{state:'unavailable',message:'On-chain unavailable.'},
    liquidations:{state:'unavailable',message:'Liquidations unavailable.'}
  };
  const multiTimeframe={state:'live',agreement:{direction:'BUY',aligned:3,directional:3,total:4},views:[]};
  return {graph,tradeResearch,evidence,multiTimeframe};
}

test('Wave X PPF 2.0 carries move evidence, current setup and scenario-specific future conditions',()=>{
  const f=contextFixture();
  const bundle=buildDecisionContextBundle(f.graph,{multiTimeframe:f.multiTimeframe,tradeResearch:f.tradeResearch,evidence:f.evidence,horizon:'4h'});
  const ppf=bundle.pastPresentFuture;
  assert.equal(ppf.schemaVersion,'qelly.past-present-future/2.0.0');
  assert.equal(ppf.past.selectedRange.returnPct,3.125);
  assert.equal(ppf.past.selectedRange.support,95);
  assert.equal(ppf.past.historicalDerivatives.state,'available');
  assert.equal(ppf.past.crossAsset.state,'available');
  assert.equal(ppf.past.newsTimeline.items.length,1);
  assert.ok(ppf.past.supportingEvidence.length>=1);
  assert.equal(ppf.present.qellyView.action,'BUY');
  assert.equal(ppf.present.currentSetup.status,'VALID');
  assert.equal(ppf.present.currentSetup.entry.method,'NOW');
  assert.equal(ppf.present.currentSetup.stop.price,95);
  assert.equal(ppf.future.horizon,'4h');
  for(const side of ['bull','base','bear']){
    assert.ok(Number.isFinite(ppf.future.scenarioDetails[side].probability));
    assert.ok(ppf.future.scenarioDetails[side].trigger);
    assert.ok(ppf.future.scenarioDetails[side].invalidation);
    assert.ok(ppf.future.scenarioDetails[side].whatChanges);
  }
  assert.ok(ppf.future.tail);
  assert.equal(ppf.future.probabilityCalibration.state,'CALIBRATION_GATE_PASSED');
  assert.match(ppf.future.probabilityCalibration.boundary,/does not guarantee/i);
});

test('Wave X Evidence Graph 2.0 exposes the required ten-stage trace and explicit node truth metadata',()=>{
  const f=contextFixture();
  const bundle=buildDecisionContextBundle(f.graph,{multiTimeframe:f.multiTimeframe,tradeResearch:f.tradeResearch,evidence:f.evidence,horizon:'4h'});
  const graph=bundle.evidenceGraph;
  assert.equal(graph.schemaVersion,'qelly.evidence-graph/2.0.0');
  assert.equal(graph.compatibilitySchema,'qelly.decision-trace/1.0.0');
  assert.deepEqual(graph.pipeline.map(item=>item.stage),[
    'RAW_OBSERVATION','NORMALIZED_DATA','QUANT_SIGNAL','EVIDENCE','REGIME','SCENARIO','QELLY_VIEW','SETUP','TARGET_INVALIDATION','OUTCOME'
  ]);
  const required=['raw','normalized','quant','evidence','regime','scenario','view','setup','target-invalidation','outcome'];
  for(const id of required){
    const node=graph.nodes.find(item=>item.id===id);
    assert.ok(node,id);
    assert.ok(Object.hasOwn(node,'source'),id+' source');
    assert.ok(Object.hasOwn(node,'timestamp'),id+' timestamp');
    assert.ok(Object.hasOwn(node,'freshness'),id+' freshness');
    assert.ok(Object.hasOwn(node,'method'),id+' method');
    assert.ok(Object.hasOwn(node,'importance'),id+' importance');
    assert.ok(Object.hasOwn(node,'supportState'),id+' supportState');
    assert.ok(Object.hasOwn(node,'confidence'),id+' confidence');
    assert.ok(Array.isArray(node.limitations),id+' limitations');
  }
  assert.equal(graph.nodes.find(item=>item.id==='outcome').supportState,'PENDING');
  assert.match(graph.boundary,/not causality/i);
  assert.equal(bundle.decisionTrace,graph);
});

test('Wave X snapshot tracks the expanded What Changed dimensions without inventing unavailable OI history',()=>{
  const f=contextFixture();
  const bundle=buildDecisionContextBundle(f.graph,{multiTimeframe:f.multiTimeframe,tradeResearch:f.tradeResearch,evidence:f.evidence,horizon:'4h'});
  const s=bundle.decisionSnapshot;
  assert.equal(s.schemaVersion,'qelly.decision-snapshot/2.0.0');
  assert.equal(s.price,100);
  assert.equal(s.calibrationState,'CALIBRATED');
  assert.equal(s.structureState,'HH_HL');
  assert.equal(s.fundingChangeBps,.2);
  assert.equal(s.openInterestChangeState,'UNAVAILABLE');
  assert.equal(s.macroLevel,'DAILY_REFERENCE');
  assert.equal(s.macroUsdInr,90);
  assert.equal(s.eventRiskLevel,'UNAVAILABLE');
  assert.equal(s.tradeStatus,'VALID');
  assert.equal(s.entryMethod,'NOW');
  assert.equal(s.selectedRr,'1:2');
  assert.equal(s.selectedTarget,110);
  assert.equal(s.stopPrice,95);
});

test('Wave X selected-range history reuses existing provider payloads and adds no provider fan-out',async()=>{
  const api=await read('functions/api/v1/decision-proven-graph.js');
  assert.equal((api.match(/fetchOptionalCandles\(fetchImpl,benchmarkAsset,resolvedInterval,endTime,240\)/g)||[]).length,1);
  assert.equal((api.match(/fetchFundingHistory\(fetchImpl,resolvedAsset,endTime\)/g)||[]).length,1);
  assert.match(api,/selectedCrossAsset/);
  assert.match(api,/historicalDerivatives/);
  assert.match(api,/selectedFundingRows/);
  assert.match(api,/selectedBenchmarkRows/);
  assert.doesNotMatch(api,/fetchSelectedCrossAsset|fetchHistoricalDerivatives/);
});

test('Wave X UI renders PPF 2.0, Evidence Graph 2.0 and expanded What Changed responsively',async()=>{
  const [route,css]=await Promise.all([
    read('apps/web/public/assets/routes/decision-proven-graph.mjs'),
    read('apps/web/public/assets/qelly-decision-proven-graph.css')
  ]);
  assert.equal((route.match(/const pastPresentFutureMarkup=/g)||[]).length,1);
  assert.equal((route.match(/const contradictionMarkup=/g)||[]).length,1);
  assert.equal((route.match(/const decisionTraceMarkup=/g)||[]).length,1);
  assert.equal((route.match(/const whatChangedMarkup=/g)||[]).length,1);
  for(const phrase of [
    'PAST · WHY DID IT HAPPEN?',
    'PRESENT · WHAT IS HAPPENING NOW?',
    'FUTURE · PROBABLE SCENARIOS',
    'Move evidence and timeline',
    'Tail bounds',
    'DECISION TRACE · EVIDENCE GRAPH 2.0',
    'Raw observation → normalized data → evidence → setup → outcome',
    'Evidence node inventory',
    'Calibration Brier',
    'Funding change',
    'Open interest',
    'Contradiction score',
    'Selected target'
  ])assert.ok(route.includes(phrase),phrase);
  for(const selector of [
    '.q-dpg-ppf__facts',
    '.q-dpg-ppf__evidence',
    '.q-dpg-ppf__scenarios',
    '.q-dpg-trace__pipeline',
    '.q-dpg-trace__inventory',
    '.q-dpg-what-changed__reason'
  ])assert.ok(css.includes(selector),selector);
  assert.match(css,/@media\(max-width:520px\).*q-dpg-trace__pipeline/s);
  assert.match(css,/@media\(max-width:520px\).*q-dpg-ppf__facts/s);
});
