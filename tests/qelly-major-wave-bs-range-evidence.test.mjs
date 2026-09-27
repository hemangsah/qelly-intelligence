import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {buildDecisionRangeEvidence,buildRangeWindows,windowStats} from '../functions/_lib/decision-range-evidence.js';

const read=(path)=>readFile(new URL('../'+path,import.meta.url),'utf8');
const base=1_800_000_000_000;
const candles=Array.from({length:24},(_,index)=>({time:base+index*300_000,open:100+index,high:103+index,low:98+index,close:101+index,volume:1000+index*10}));
const graph={
  asset:'BTC',interval:'5m',
  market:{candles},
  provenance:{provider:'Hyperliquid',dataFingerprint:'abc123'},
  selection:{
    start:new Date(candles[8].time).toISOString(),end:new Date(candles[13].time).toISOString(),candles:6,startPrice:candles[8].open,endPrice:candles[13].close,
    changePct:5.5,rangePct:8.2,volatilityPct:.6,volumeRatio:1.4,averageVolume:1150,support:105,resistance:117,
    structure:{state:'DERIVED',bias:'UPSIDE'},regime:'TRENDING',technicalComparison:{rsi14:{before:48,during:61,change:13}},
    evidence:[{type:'price',title:'Price advanced 5.5%',direction:'supports upside',strength:.9}]
  }
};
const evidence={
  news:{state:'live',provider:'GDELT',articles:[{title:'Bitcoin regulatory update',source:'example.com',publishedAt:'2027-01-01T00:00:00Z',url:'https://example.com'}],clusters:[{topicHints:['REGULATION_POLICY']}]},
  historicalDerivatives:{state:'available',provider:'Hyperliquid settled funding history',fundingHistory:{state:'available',sampleSize:3},historicalOpenInterestState:'UNAVAILABLE',liquidationsState:'UNAVAILABLE',boundary:'Only settled funding overlaps.'},
  selectedCrossAsset:{state:'available',provider:'Hyperliquid candles',asset:'BTC',benchmark:'ETH',correlation:.7},
  liquidity:{state:'live',provider:'Hyperliquid'},derivatives:{state:'live',provider:'Hyperliquid'},macro:{state:'available',provider:'ECB'},
  options:{state:'unavailable',message:'Options unavailable.'},onChain:{state:'unavailable',message:'On-chain unavailable.'}
};

test('Wave BS builds equal-length before/during/after historical comparison windows',()=>{
  const windows=buildRangeWindows(candles,graph.selection);
  assert.equal(windows.during.state,'AVAILABLE');
  assert.equal(windows.during.samples,6);
  assert.equal(windows.before.samples,6);
  assert.equal(windows.after.samples,6);
  assert.ok(Number.isFinite(windows.during.returnPct));
  assert.ok(Number.isFinite(windowStats(candles.slice(0,4)).rangePct));
});

test('Wave BS emits the bounded request object and separates current context from historical evidence',()=>{
  const result=buildDecisionRangeEvidence({graph,evidence,assetClass:'crypto',venue:'Hyperliquid',timezone:'UTC'});
  assert.equal(result.state,'AVAILABLE');
  assert.equal(result.request.asset,'BTC');
  assert.equal(result.request.interval,'5m');
  assert.match(result.request.selectionId,/^range-[0-9a-f]{8}$/);
  assert.ok(result.request.preWindow?.start);
  assert.ok(result.request.postWindow?.end);
  const liquidity=result.evidenceFamilies.find(item=>item.id==='liquidity');
  const currentLiquidity=result.evidenceFamilies.find(item=>item.id==='liquidity-current');
  assert.equal(liquidity.temporalScope,'HISTORICAL_UNAVAILABLE');
  assert.equal(currentLiquidity.temporalScope,'CURRENT_CONTEXT');
  assert.match(result.currentContextBoundary,/must not be represented as historical evidence/i);
});

test('Wave BS preserves unsupported historical data as unavailable instead of synthesizing flow or actor identity',()=>{
  const result=buildDecisionRangeEvidence({graph,evidence});
  const flow=result.evidenceFamilies.find(item=>item.id==='flow-participation');
  assert.equal(flow.data.actorIdentity,'UNAVAILABLE');
  assert.equal(flow.data.historicalOpenInterestState,'UNAVAILABLE');
  assert.equal(flow.data.liquidationState,'UNAVAILABLE');
  assert.equal(flow.data.orderFlowState,'UNAVAILABLE');
  assert.match(flow.limitations.join(' '),/Named buyer\/seller identity is never inferred/i);
  assert.match(result.causalityBoundary,/Never assert causation solely from timing/i);
});

test('Wave BS endpoint enforces bounded exact history and performs exact time-bounded news retrieval',async()=>{
  const endpoint=await read('functions/api/v1/decision-range-evidence.js');
  for(const token of ['rangeStart','rangeEnd','MAX_RANGE_MS','future_range','unsupported_history','bucketMs:0','decision-range-evidence:'])assert.ok(endpoint.includes(token),token);
  assert.match(endpoint,/QELLY will not substitute a nearby range/);
  assert.match(endpoint,/current news outside this window is not injected/);
});

test('Wave BS is integrated into the existing Decision response and selected-move UI',async()=>{
  const [api,route,css]=await Promise.all([
    read('functions/api/v1/decision-proven-graph.js'),
    read('apps/web/public/assets/routes/decision-proven-graph.mjs'),
    read('apps/web/public/assets/qelly-decision-proven-graph.css')
  ]);
  assert.match(api,/buildDecisionRangeEvidence/);
  assert.match(api,/rangeEvidence/);
  for(const phrase of ['SELECTED MOVE INTELLIGENCE','Evidence coverage','CURRENT CONTEXT','Association, not proof of causation','Before','During','After'])assert.ok(route.includes(phrase),phrase);
  for(const selector of ['.q-dpg-range-intelligence','.q-dpg-range-coverage','.q-dpg-range-comparison'])assert.ok(css.includes(selector),selector);
});
