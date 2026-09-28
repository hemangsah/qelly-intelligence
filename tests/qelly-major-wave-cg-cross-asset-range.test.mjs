import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {buildSelectedRangeCrossAssetAnalysis} from '../functions/_lib/decision-selected-cross-asset.js';
import {buildDecisionRangeEvidence} from '../functions/_lib/decision-range-evidence.js';

const base=1_800_000_000_000,step=900_000;
const makePair=({asset='SOL',benchmark='BTC',diverge=false}={})=>{
  const benchmarkRows=[],assetRows=[];
  let b=100,a=50;
  for(let i=0;i<200;i++){
    const wave=Math.sin(i/5)*.0012,benchMove=.0012+wave;
    const inSelection=i>=70&&i<=129;
    const assetMove=diverge&&inSelection?-.0022:benchMove*1.03+Math.cos(i/7)*.00012;
    b*=1+benchMove;a*=1+assetMove;
    const t=base+i*step;
    benchmarkRows.push({t,c:b,o:b/(1+benchMove),h:b*1.001,l:b*.999});
    assetRows.push({t,c:a,o:a/(1+assetMove),h:a*1.001,l:a*.999});
  }
  return {assetRows,benchmarkRows,selection:{start:base+70*step,end:base+129*step},asset,benchmark};
};

test('Wave CG classifies strong bounded alt/BTC co-movement as BTC-led context without causality',()=>{
  const pair=makePair({});
  const result=buildSelectedRangeCrossAssetAnalysis(pair.assetRows,pair.benchmarkRows,{selection:pair.selection,asset:pair.asset,benchmark:pair.benchmark});
  assert.equal(result.state,'AVAILABLE');
  assert.equal(result.classification.id,'BTC_LED_CONTEXT');
  assert.equal(result.classification.causalClaim,false);
  assert.equal(result.classification.broadRiskClaim,false);
  assert.equal(result.eligibilityImpact,'none');
  assert.ok(result.windows.before.alignedPriceSamples>30);
  assert.ok(result.windows.during.alignedPriceSamples>30);
  assert.ok(result.windows.after.alignedPriceSamples>30);
  assert.ok(Number.isFinite(result.windows.during.correlation));
  assert.match(result.dataStory,/does not prove BTC caused/i);
});

test('Wave CG distinguishes selected-range asset-specific divergence from BTC context',()=>{
  const pair=makePair({diverge:true});
  const result=buildSelectedRangeCrossAssetAnalysis(pair.assetRows,pair.benchmarkRows,{selection:pair.selection,asset:pair.asset,benchmark:pair.benchmark});
  assert.equal(result.state,'AVAILABLE');
  assert.equal(result.classification.id,'ASSET_SPECIFIC_DIVERGENCE');
  assert.equal(result.windows.during.directionAgreement,'OPPOSITE_DIRECTION');
  assert.ok(Math.abs(result.windows.during.relativeStrengthPct)>2);
});

test('Wave CG keeps short-range returns visible while abstaining from correlation/beta',()=>{
  const pair=makePair({});
  const selection={start:base+90*step,end:base+96*step};
  const result=buildSelectedRangeCrossAssetAnalysis(pair.assetRows,pair.benchmarkRows,{selection,asset:'SOL',benchmark:'BTC'});
  assert.equal(result.state,'AVAILABLE');
  assert.equal(result.windows.during.dependenceState,'LIMITED_SAMPLE');
  assert.equal(result.windows.during.correlation,null);
  assert.equal(result.windows.during.beta,null);
  assert.equal(result.windows.during.evidenceStrength,'CONTEXT_ONLY');
  assert.ok(Number.isFinite(result.windows.during.relativeStrengthPct));
  assert.notEqual(result.classification.id,'BTC_LED_CONTEXT');
});

test('Wave CG enriches the historical cross-asset evidence family without changing eligibility',()=>{
  const pair=makePair({});
  const analysis=buildSelectedRangeCrossAssetAnalysis(pair.assetRows,pair.benchmarkRows,{selection:pair.selection,asset:'SOL',benchmark:'BTC'});
  const graph={asset:'SOL',interval:'15m',market:{candles:pair.assetRows},selection:{start:pair.selection.start,end:pair.selection.end,candles:60,startPrice:50,endPrice:55,changePct:10,rangePct:12,volatilityPct:1,volumeRatio:1.2,evidence:[]},provenance:{provider:'Hyperliquid',dataFingerprint:'cg'}};
  const result=buildDecisionRangeEvidence({graph,evidence:{selectedCrossAssetAnalysis:analysis}});
  const family=result.evidenceFamilies.find(item=>item.id==='cross-asset');
  assert.equal(family.state,'AVAILABLE');
  assert.equal(family.data.schemaVersion,'qelly.selected-range-cross-asset/1.0.0');
  assert.equal(family.data.eligibilityImpact,'none');
  assert.match(family.data.boundary,/Correlation is not causation/i);
});

test('Wave CG is wired through API, exact-range endpoint, UI and Browser E2E',async()=>{
  const [api,endpoint,route,css,e2e]=await Promise.all([
    readFile(new URL('../functions/api/v1/decision-proven-graph.js',import.meta.url),'utf8'),
    readFile(new URL('../functions/api/v1/decision-range-evidence.js',import.meta.url),'utf8'),
    readFile(new URL('../apps/web/public/assets/routes/decision-proven-graph.mjs',import.meta.url),'utf8'),
    readFile(new URL('../apps/web/public/assets/qelly-decision-proven-graph.css',import.meta.url),'utf8'),
    readFile(new URL('../scripts/qelly-decision-range-selection-e2e.mjs',import.meta.url),'utf8')
  ]);
  for(const token of ['buildSelectedRangeCrossAssetAnalysis','selectedCrossAssetAnalysis'])assert.ok(api.includes(token),token);
  assert.match(endpoint,/selectedRangeCrossAsset/);
  for(const token of ['data-dpg-range-cross-asset','CROSS-ASSET · SELECTED RANGE','Relative strength','Correlation','Beta','PAIRWISE · DESCRIPTIVE ONLY'])assert.ok(route.includes(token),token);
  assert.match(css,/q-dpg-range-cross-asset/);
  for(const token of ['range-cross-asset','rangeCrossAssetRequired','buildSelectedRangeCrossAssetAnalysis'])assert.ok(e2e.includes(token),token);
});
