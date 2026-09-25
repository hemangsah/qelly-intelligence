import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {buildDecisionHistoricalAnalogs,__decisionHistoricalAnalogsTest} from '../functions/_lib/decision-historical-analogs.js';
import {compactDecisionToolReceipt} from '../functions/_lib/qelly-chat-tools.js';

function candles(count=620){
  const rows=[];
  let close=100;
  const start=1_750_000_000_000;
  for(let i=0;i<count;i++){
    const slow=Math.sin(i/33)*.0015;
    const fast=Math.sin(i/8)*.0021;
    const regime=i%160<95?.0007:-.00055;
    const ret=regime+slow+fast+(((i*29)%13)-6)*.00018;
    const open=close;
    close=Math.max(1,open*Math.exp(ret));
    const spread=.0024+Math.abs(Math.sin(i/17))*.0021;
    rows.push({
      time:start+i*900_000,
      open,
      high:Math.max(open,close)*(1+spread),
      low:Math.min(open,close)*(1-spread*.9),
      close,
      volume:900+(i%31)*27,
      trades:100+i%70
    });
  }
  return rows;
}

const read=(path)=>readFile(new URL('../'+path,import.meta.url),'utf8');

test('Wave AV applies a fixed pre-outcome similarity gate and explicit accounting',()=>{
  const result=buildDecisionHistoricalAnalogs(candles(),{interval:'15m',horizonBars:16,windowBars:100,limit:5});
  assert.equal(__decisionHistoricalAnalogsTest.MIN_ANALOG_SIMILARITY,.65);
  assert.equal(result.minimumSimilarity,.65);
  assert.equal(result.eligibilityImpact,'none');
  assert.equal(result.similarityEligibleWindows+result.similarityRejectedWindows,result.sampledWindows);
  assert.ok(result.candidateStepBars>=16);
  assert.equal(result.minimumAnchorSeparationBars,16);
  assert.ok(result.analogs.length>=1&&result.analogs.length<=5);
  for(const analog of result.analogs)assert.ok(analog.similarity>=.65);
  assert.match(result.selectionPolicy.thresholdSelection,/not tuned from forward returns/i);
  assert.match(result.outcomeBoundary,/computed only after similarity and temporal-selection gates/i);
  assert.match(result.leakageGuard,/terminal price or time-to-resolution/i);
});

test('Wave AV selected analog outcome windows are separated by at least one forecast horizon',()=>{
  const horizonBars=16,intervalMs=900_000;
  const result=buildDecisionHistoricalAnalogs(candles(),{interval:'15m',horizonBars,windowBars:100,limit:8});
  const anchors=result.analogs.map(item=>Date.parse(item.observedAt)).sort((a,b)=>a-b);
  for(let i=1;i<anchors.length;i++)assert.ok(anchors[i]-anchors[i-1]>=horizonBars*intervalMs);
  assert.match(result.selectionPolicy.temporalSeparation,/do not overlap/i);
});

test('Wave AV positive-share interval is explicit descriptive uncertainty, not calibration',()=>{
  const result=buildDecisionHistoricalAnalogs(candles(),{interval:'15m',horizonBars:16,windowBars:100,limit:5});
  const interval=result.summary?.positiveShareInterval95;
  assert.ok(interval);
  assert.equal(interval.sampleSize,result.summary.count);
  assert.ok(interval.low>=0&&interval.low<=1);
  assert.ok(interval.high>=0&&interval.high<=1);
  assert.ok(interval.low<=result.summary.positiveShare&&interval.high>=result.summary.positiveShare);
  assert.ok(interval.high-interval.low>.2);
  assert.match(interval.method,/Wilson score interval/i);
  assert.match(interval.boundary,/not a win probability or calibration output/i);
  assert.match(result.uncertaintyBoundary,/do not assume independent identical draws/i);
});

test('Wave AV distance remains outcome-blind and threshold is not outcome-tunable',()=>{
  const current={regime:'TRENDING',volatilityRegime:'NORMAL',volatilityPercentile:.5,adx14:25,efficiencyRatio:.4,roc14Pct:2,structureState:'HH_HL',rangePct:4};
  const candidate={...current,roc14Pct:1.5};
  const baseline=__decisionHistoricalAnalogsTest.distance(current,candidate);
  assert.equal(__decisionHistoricalAnalogsTest.distance(current,{...candidate,forwardReturnPct:999,maxFavorablePct:999,maxAdversePct:-999}),baseline);
  assert.equal(__decisionHistoricalAnalogsTest.MIN_ANALOG_SIMILARITY,.65);
});

test('Wave AV source computes outcomes only after similarity and temporal selection',async()=>{
  const source=await read('functions/_lib/decision-historical-analogs.js');
  const gateIndex=source.indexOf('const similarityEligible=descriptors.filter');
  const temporalIndex=source.indexOf('const selectedDescriptors=[]');
  const outcomeIndex=source.indexOf('const resolved=selectedDescriptors.map(item=>attachResolvedOutcome');
  assert.ok(gateIndex>0&&temporalIndex>gateIndex&&outcomeIndex>temporalIndex);
  assert.doesNotMatch(source.slice(gateIndex,outcomeIndex),/forwardReturnPct|maxFavorablePct|maxAdversePct/);
});

test('Wave AV Decision UI exposes the gate, rejection count and descriptive interval',async()=>{
  const route=await read('apps/web/public/assets/routes/decision-proven-graph.mjs');
  for(const phrase of [
    'HISTORICAL ANALOGS · DESCRIPTIVE ONLY',
    'Similarity floor',
    'Rejected by similarity',
    '95% descriptive interval',
    'Anchor separation',
    'Selection, leakage and uncertainty boundaries',
    'NO ELIGIBILITY IMPACT'
  ])assert.ok(route.includes(phrase),phrase);
});

test('Wave AV Evidence Graph carries the small-sample uncertainty boundary',async()=>{
  const context=await read('functions/_lib/decision-context.js');
  assert.match(context,/Forward outcomes are attached only after pre-outcome similarity and temporal-selection gates/);
  assert.match(context,/Small selected analog samples are descriptive only and are not calibration evidence/);
});

test('Wave AV QELLY Chat receipt preserves analog governance metadata without a second scoring engine',()=>{
  const analogs=buildDecisionHistoricalAnalogs(candles(),{interval:'15m',horizonBars:16,windowBars:100,limit:5});
  const receipt=compactDecisionToolReceipt({
    asset:'BTC',interval:'15m',horizon:'4h',truthState:'LIVE',observedAt:'2026-09-25T08:35:00.000Z',
    qellyView:{action:'WAIT',confidence:.6,evidenceGate:{}},quant:{calibration:{}},
    evidence:{news:{},liquidity:{},derivatives:{},macro:{},eventRisk:{},crossAsset:{}},
    tradeResearch:{status:'NO_TRADE',matrix:[],targets:[]},
    historicalAnalogs:analogs,contradictionAnalysis:{},pastPresentFuture:{},evidenceGraph:{nodes:[]}
  });
  const value=receipt.data.historicalAnalogs;
  assert.equal(value.minimumSimilarity,.65);
  assert.equal(value.similarityEligibleWindows+value.similarityRejectedWindows,value.sampledWindows);
  assert.equal(value.selectionPolicy.similarityFloor,.65);
  assert.match(value.uncertaintyBoundary,/descriptive uncertainty only/i);
  assert.equal(value.eligibilityImpact,'none');
});
