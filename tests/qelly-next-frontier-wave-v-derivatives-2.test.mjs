import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {buildFundingHistoryContext,__decisionDerivativesTest} from '../functions/_lib/decision-derivatives.js';

const read=(path)=>readFile(new URL(`../${path}`,import.meta.url),'utf8');
const base=Date.parse('2026-09-21T00:00:00.000Z');

test('Wave V computes settled funding and premium change/percentile from same-provider history',()=>{
  const raw=[
    {coin:'BTC',time:base,fundingRate:'0.0001',premium:'0.0002'},
    {coin:'BTC',time:base+8*3_600_000,fundingRate:'0.0002',premium:'0.0003'},
    {coin:'BTC',time:base+16*3_600_000,fundingRate:'-0.0001',premium:'0.0001'}
  ];
  const result=buildFundingHistoryContext(raw,{currentFundingRate:0.0003,currentPremium:0.0005});
  assert.equal(result.state,'available');
  assert.equal(result.sampleSize,3);
  assert.equal(result.premiumSampleSize,3);
  assert.equal(result.fundingChangeBps,4);
  assert.equal(result.fundingPercentile,1);
  assert.equal(result.fundingState,'POSITIVE_CARRY');
  assert.equal(result.fundingShiftState,'RISING');
  assert.equal(result.premiumChangeBps,4);
  assert.equal(result.premiumPercentile,1);
  assert.equal(result.premiumState,'POSITIVE_PREMIUM');
  assert.equal(result.premiumShiftState,'RISING');
  assert.equal(result.previousPremiumPct,0.01);
  assert.match(result.method,/same provider/i);
  assert.match(result.limitations.join(' '),/does not provide historical open interest/i);
  assert.match(result.limitations.join(' '),/basis change is not inferred/i);
});

test('Wave V preserves null truth instead of coercing missing current derivatives to zero',()=>{
  const raw=[{coin:'BTC',time:base,fundingRate:'0.0001',premium:null}];
  const result=buildFundingHistoryContext(raw,{currentFundingRate:null,currentPremium:null});
  assert.equal(result.fundingChangeBps,null);
  assert.equal(result.fundingPercentile,null);
  assert.equal(result.fundingState,'UNAVAILABLE');
  assert.equal(result.fundingShiftState,'UNAVAILABLE');
  assert.equal(result.previousPremium,null);
  assert.equal(result.premiumChangeBps,null);
  assert.equal(result.premiumPercentile,null);
  assert.equal(result.premiumState,'UNAVAILABLE');
  assert.equal(result.premiumShiftState,'UNAVAILABLE');
});

test('Wave V helper states are deterministic and bounded to descriptive categories',()=>{
  const {signedState,shiftState}=__decisionDerivativesTest;
  assert.equal(signedState(0.0001,{epsilon:.000005,positive:'POS',negative:'NEG',flat:'FLAT'}),'POS');
  assert.equal(signedState(-0.0001,{epsilon:.000005,positive:'POS',negative:'NEG',flat:'FLAT'}),'NEG');
  assert.equal(signedState(0,{epsilon:.000005,positive:'POS',negative:'NEG',flat:'FLAT'}),'FLAT');
  assert.equal(signedState(null),'UNAVAILABLE');
  assert.equal(shiftState(.1),'RISING');
  assert.equal(shiftState(-.1),'FALLING');
  assert.equal(shiftState(0),'FLAT');
  assert.equal(shiftState(null),'UNAVAILABLE');
});

test('Wave V adds no derivatives provider fan-out beyond current context plus settled funding history',async()=>{
  const api=await read('functions/api/v1/decision-proven-graph.js');
  assert.equal((api.match(/type:'metaAndAssetCtxs'/g)||[]).length,1);
  assert.equal((api.match(/type:'fundingHistory'/g)||[]).length,1);
  assert.doesNotMatch(api,/openInterestHistory/);
  assert.doesNotMatch(api,/liquidationHistory|liquidationsSnapshot|recentLiquidations/);
  assert.match(api,/historicalPremiumAttached/);
  assert.match(api,/openInterestTurnover24h/);
  assert.match(api,/markOracleBasisChangeState:'UNAVAILABLE'/);
  assert.match(api,/priceOpenInterestQuadrant:'UNAVAILABLE'/);
  assert.match(api,/liquidationsState:'UNAVAILABLE'/);
  assert.match(api,/premium history is not substituted for basis history/i);
});

test('Wave V preserves current derivatives separately from historical selected-move evidence',async()=>{
  const api=await read('functions/api/v1/decision-proven-graph.js');
  assert.match(api,/currentOnly:true/);
  assert.match(api,/not backfilled into a selected historical move or treated as causal evidence/i);
  assert.match(api,/Historical mark\/oracle observations are not connected/);
  assert.match(api,/Price\/OI quadrant interpretation requires a verified open-interest change series/);
});

test('Wave V extends the existing responsive derivatives panel without replacing its legacy contract',async()=>{
  const [route,css]=await Promise.all([
    read('apps/web/public/assets/routes/decision-proven-graph.mjs'),
    read('apps/web/public/assets/qelly-decision-proven-graph.css')
  ]);
  assert.equal((route.match(/const derivativesContext=/g)||[]).length,1);
  for(const phrase of [
    'DERIVATIVES CONTEXT · CURRENT + SETTLED HISTORY',
    'Current funding',
    'Funding change',
    'Funding percentile',
    'Current premium',
    'Premium change',
    'Premium percentile',
    'Open interest',
    'OI notional',
    'OI change',
    '24h perp volume',
    'OI turnover',
    'Mark / oracle basis',
    'Basis change',
    'Price / OI quadrant',
    'Liquidations',
    'Premium history is not substituted for mark/oracle basis history'
  ])assert.ok(route.includes(phrase),phrase);
  assert.match(route,/const price=\(value\)=>value!=null&&value!==''/);
  assert.match(css,/\.q-dpg-derivatives__grid/);
  assert.match(css,/@media\(max-width:620px\).*q-dpg-derivatives__grid/s);
});

test('Decision Trace states the same derivatives evidence and unavailable boundaries',async()=>{
  const context=await read('functions/_lib/decision-context.js');
  assert.match(context,/Current funding, open interest, mark\/oracle basis, premium and 24h perpetual volume/);
  assert.match(context,/Historical mark\/oracle basis change is not inferred from premium history/);
  assert.match(context,/Liquidation flow and the price\/OI quadrant remain unavailable/);
});
