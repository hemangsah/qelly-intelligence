import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {buildDerivativesPositioningState} from '../functions/_lib/decision-derivatives.js';
import {compactDecisionToolReceipt} from '../functions/_lib/qelly-chat-tools.js';

const read=(path)=>readFile(new URL('../'+path,import.meta.url),'utf8');

const classify=(price,oi)=>buildDerivativesPositioningState({
  priceChangePct:price,
  openInterestChangePct:oi,
  fundingState:'POSITIVE_CARRY',
  basisState:'MARK_PREMIUM'
});

test('Wave AQ defines all four price/open-interest descriptive quadrants explicitly',()=>{
  assert.equal(classify(2,3).state,'LONG_BUILD_UP');
  assert.equal(classify(-2,3).state,'SHORT_BUILD_UP');
  assert.equal(classify(2,-3).state,'SHORT_COVERING');
  assert.equal(classify(-2,-3).state,'LONG_UNWINDING');
  assert.equal(classify(.05,3).state,'NEUTRAL_MIXED');
  assert.equal(classify(2,.1).state,'NEUTRAL_MIXED');
  assert.match(classify(2,3).boundary,/descriptive price\/open-interest quadrant only/i);
  assert.match(classify(2,3).boundary,/does not identify individual trader positioning/i);
});

test('Wave AQ fails closed when verified OI change is absent and never substitutes funding/basis',()=>{
  const result=buildDerivativesPositioningState({
    priceChangePct:1.2,
    openInterestChangePct:null,
    fundingState:'POSITIVE_CARRY',
    basisState:'MARK_PREMIUM'
  });
  assert.equal(result.state,'UNAVAILABLE');
  assert.equal(result.available,false);
  assert.equal(result.priceChangePct,1.2);
  assert.equal(result.openInterestChangePct,null);
  assert.match(result.reason,/historical open-interest change is unavailable/i);
  assert.equal(result.annotations.fundingState,'POSITIVE_CARRY');
  assert.equal(result.annotations.basisState,'MARK_PREMIUM');
  assert.match(result.boundary,/never substituted for missing open-interest change/i);
});

test('Wave AQ preserves neutral thresholds as explicit methodology rather than forcing a quadrant',()=>{
  const result=buildDerivativesPositioningState({
    priceChangePct:.09,openInterestChangePct:.24,
    priceEpsilonPct:.1,openInterestEpsilonPct:.25
  });
  assert.equal(result.state,'NEUTRAL_MIXED');
  assert.equal(result.priceEpsilonPct,.1);
  assert.equal(result.openInterestEpsilonPct,.25);
});

test('Wave AQ primary provider path uses genuine prevDayPx but keeps production OI change unavailable',async()=>{
  const source=await read('functions/api/v1/decision-proven-graph.js');
  assert.match(source,/const prevDayPrice=finite\(context\.prevDayPx\)/);
  assert.match(source,/priceChange24hPct:markPrice===null\|\|prevDayPrice===null/);
  assert.match(source,/openInterestChangePct:null/);
  assert.match(source,/positioning=buildDerivativesPositioningState/);
  assert.match(source,/priceOpenInterestQuadrant:'UNAVAILABLE'/);
  assert.match(source,/openInterestChangeReason:'Hyperliquid current asset context does not provide historical open-interest change/);
  assert.doesNotMatch(source,/fundingChangeBps[^\n]{0,160}openInterestChangePct|premiumChangeBps[^\n]{0,160}openInterestChangePct/);
});

test('Wave AQ positioning state is risk context only and does not alter directional eligibility',async()=>{
  const source=await read('functions/api/v1/decision-proven-graph.js');
  for(const field of ['positioningState','positioningAvailable','priceChange24hPct']){
    assert.doesNotMatch(source,new RegExp(field+'[^\\n]{0,180}directionalEligible|directionalEligible[^\\n]{0,180}'+field));
  }
  assert.match(source,/calibrationEligible/);
  assert.match(source,/spreadBps>15/);
});

test('Wave AQ UI explains unavailable OI history instead of presenting a synthetic positioning label',async()=>{
  const route=await read('apps/web/public/assets/routes/decision-proven-graph.mjs');
  for(const phrase of ['24h price change','Positioning state','requires verified OI change history','LONG BUILD-UP / SHORT BUILD-UP / SHORT COVERING / LONG UNWINDING']){
    assert.ok(route.includes(phrase),phrase);
  }
  assert.match(route,/funding or premium never substitutes for OI change/i);
  assert.match(route,/Descriptive only/);
});

test('Wave AQ Evidence Graph states positioning is descriptive and fail-closed',async()=>{
  const context=await read('functions/_lib/decision-context.js');
  assert.match(context,/requires separately verified open-interest change/i);
  assert.match(context,/Funding, premium and basis never substitute/i);
  assert.match(context,/not ground-truth trader positioning/i);
});

test('Wave AQ QELLY Chat receipt exposes the state, inputs and availability boundary',()=>{
  const positioning=buildDerivativesPositioningState({priceChangePct:1.5,openInterestChangePct:null,fundingState:'POSITIVE_CARRY',basisState:'NEAR_ORACLE'});
  const derivatives={
    state:'live',prevDayPrice:82000,priceChange24hPct:1.5,openInterestChangePct:null,
    openInterestChangeState:'UNAVAILABLE',positioningState:positioning.state,positioningAvailable:positioning.available,positioning,
    priceOpenInterestQuadrant:'UNAVAILABLE'
  };
  const receipt=compactDecisionToolReceipt({
    asset:'BTC',interval:'15m',horizon:'4h',truthState:'LIVE',observedAt:'2026-09-25T08:00:00.000Z',
    qellyView:{action:'WAIT',confidence:.6,evidenceGate:{}},quant:{calibration:{}},
    evidence:{liquidity:{},derivatives,news:{},macro:{},eventRisk:{},crossAsset:{}},
    tradeResearch:{status:'NO_TRADE',matrix:[],targets:[]},historicalAnalogs:{},contradictionAnalysis:{},
    pastPresentFuture:{},evidenceGraph:{nodes:[]}
  });
  assert.equal(receipt.data.derivatives.positioningState,'UNAVAILABLE');
  assert.equal(receipt.data.derivatives.positioningAvailable,false);
  assert.equal(receipt.data.derivatives.priceChange24hPct,1.5);
  assert.equal(receipt.data.derivatives.openInterestChangePct,null);
  assert.match(receipt.data.derivatives.positioningReason,/open-interest change is unavailable/i);
  assert.match(receipt.data.derivatives.positioningBoundary,/never substituted|Funding, premium and basis/i);
});
