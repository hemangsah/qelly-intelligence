import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {buildFundingHistoryContext} from '../functions/_lib/decision-derivatives.js';
import {buildDecisionCrossAsset} from '../functions/_lib/decision-cross-asset.js';
import {calibrateDecisionEvidence} from '../functions/api/v1/decision-proven-graph.js';

test('settled funding history derives bounded descriptive carry context',()=>{
  const rows=[
    {coin:'BTC',fundingRate:'0.00010',premium:'0.00020',time:1_790_000_000_000},
    {coin:'BTC',fundingRate:'0.00015',premium:'0.00025',time:1_790_003_600_000}
  ];
  const result=buildFundingHistoryContext(rows,{currentFundingRate:0.00020});
  assert.equal(result.state,'available');
  assert.equal(result.sampleSize,2);
  assert.equal(result.previousFundingRate,0.00015);
  assert.equal(result.fundingChangeBps,0.5);
  assert.equal(result.fundingPercentile,1);
  assert.equal(result.medianFundingPct,0.0125);
  assert.equal(result.minFundingPct,0.01);
  assert.equal(result.maxFundingPct,0.015);
  assert.match(result.method,/settled funding history/i);
  assert.match(result.limitations.join(' '),/not a win probability|not a trade signal/i);
});

test('funding history fails closed when observations are unusable',()=>{
  const result=buildFundingHistoryContext([{coin:'BTC',fundingRate:'bad',time:null}],{currentFundingRate:0.0002});
  assert.equal(result.state,'unavailable');
  assert.equal(result.sampleSize,0);
  assert.equal(result.fundingPercentile,null);
  assert.equal(result.fundingChangeBps,null);
});

function candleSeries({count=100,start=1_790_000_000_000,step=900_000,drift=.001,cycle=.002,scale=1}={}){
  const rows=[];
  let close=100*scale;
  for(let i=0;i<count;i++){
    const ret=drift+Math.sin(i/7)*cycle+Math.cos(i/17)*cycle*.45;
    close*=Math.exp(ret);
    rows.push({time:start+i*step,close});
  }
  return rows;
}

test('same-venue cross-asset engine calculates bounded dependence without eligibility impact',()=>{
  const asset=candleSeries({drift:.0012,cycle:.0022,scale:1});
  const benchmark=candleSeries({drift:.0008,cycle:.0018,scale:2});
  const result=buildDecisionCrossAsset(asset,benchmark,{asset:'SOL',benchmark:'BTC'});
  assert.equal(result.state,'available');
  assert.equal(result.asset,'SOL');
  assert.equal(result.benchmark,'BTC');
  assert.ok(result.sampleSize>=30);
  assert.ok(result.correlation>=-1&&result.correlation<=1);
  assert.equal(Number.isFinite(result.beta),true);
  assert.equal(Number.isFinite(result.relativeStrengthPct),true);
  assert.equal(result.eligibilityImpact,'none');
  assert.match(result.method,/same-venue, same-interval/i);
});

test('cross-asset engine fails closed on sparse or unaligned history',()=>{
  const asset=candleSeries({count:20});
  const benchmark=candleSeries({count:20,start:1_800_000_000_000});
  const result=buildDecisionCrossAsset(asset,benchmark,{asset:'ETH',benchmark:'BTC'});
  assert.equal(result.state,'unavailable');
  assert.equal(result.correlation,null);
  assert.equal(result.beta,null);
});

const eligibleGraph=()=>({
  truthState:'LIVE',
  market:{points:500},
  metrics:{atrPct:.7},
  quant:{
    state:'DERIVED',
    volatility:{regime:'NORMAL',expectedMovePct:1.8},
    structure:{state:'HH_HL',support:97,resistance:108},
    calibration:{state:'CALIBRATED',eligible:true,sampleSize:80,brierScore:.2,skillScore:.2,reliabilityGap:.05,reliabilityBins:[]}
  },
  forecast:{probabilities:{bull:.68,base:.15,bear:.17}},
  confidence:{score:.82,calibration:'base'},
  qellyView:{
    action:'BUY',
    confidence:.82,
    levels:{entryZone:[99,101],invalidation:97,targets:[103,106,108],riskReward:[1,2,3]},
    why:['Base directional evidence.'],
    label:'Research signal only.',
    changesIf:'Evidence changes.'
  },
  graph:{nodes:[{id:'decision',label:'QELLY VIEW BUY'}],edges:[]}
});

test('cross-asset dependence remains descriptive and cannot suppress an otherwise eligible view by itself',()=>{
  const result=calibrateDecisionEvidence(
    eligibleGraph(),
    {state:'live',agreement:{direction:'BUY',aligned:4,directional:4,total:4}},
    {state:'live'},
    {state:'live',spreadBps:2,spreadState:'TIGHT',top5Imbalance:.05,imbalanceState:'BALANCED'},
    {state:'available',benchmark:'BTC',correlation:-.9,correlationState:'STRONG_NEGATIVE',relativeState:'UNDERPERFORMING'}
  );
  assert.equal(result.qellyView.action,'BUY');
  assert.equal(result.qellyView.evidenceGate.crossAssetCoverage,'available');
  assert.equal(result.qellyView.evidenceGate.crossAssetBenchmark,'BTC');
  assert.equal(result.qellyView.evidenceGate.crossAssetCorrelation,-.9);
  assert.match(result.qellyView.why.join(' '),/no independent eligibility impact/i);
});

test('Decision endpoint connects funding history and keeps unsupported derivatives/macro domains explicit',async()=>{
  const endpoint=await readFile(new URL('../functions/api/v1/decision-proven-graph.js',import.meta.url),'utf8');
  for(const phrase of [
    "type:'fundingHistory'",
    "startTime:endTime-72*3_600_000",
    "openInterestChangeState:'UNAVAILABLE'",
    "intradayFeedConnected:false",
    'Slow or delayed macro references used elsewhere in QELLY are intentionally excluded from intraday trade eligibility.',
    "options:{state:'unavailable'",
    "onChain:{state:'unavailable'"
  ])assert.ok(endpoint.includes(phrase),phrase);
  assert.match(endpoint,/benchmarkAsset=resolvedAsset==='BTC'\?'ETH':'BTC'/);
  assert.match(endpoint,/buildDecisionCrossAsset\(payload,benchmarkPayload/);
});

test('Decision UI labels settled funding, cross-asset and macro boundaries with responsive styles',async()=>{
  const route=await readFile(new URL('../apps/web/public/assets/routes/decision-proven-graph.mjs',import.meta.url),'utf8');
  const css=await readFile(new URL('../apps/web/public/assets/qelly-decision-proven-graph.css',import.meta.url),'utf8');
  for(const phrase of [
    'DERIVATIVES CONTEXT · CURRENT + SETTLED HISTORY',
    'Funding change',
    'Funding percentile',
    'OI change',
    'CROSS-ASSET · DESCRIPTIVE ONLY',
    'NO ELIGIBILITY IMPACT',
    'MACRO CONTEXT',
    'Slow reference data is not substituted for current market evidence.'
  ])assert.ok(route.includes(phrase),phrase);
  assert.match(route,/crossAssetContext\(data,escapeHtml\)/);
  assert.match(route,/macroContext\(data,escapeHtml\)/);
  assert.match(css,/\.q-dpg-cross-asset/);
  assert.match(css,/\.q-dpg-macro/);
  assert.match(css,/@media\(max-width:480px\)\{\.q-dpg-cross-asset__grid\{grid-template-columns:1fr/);
});
