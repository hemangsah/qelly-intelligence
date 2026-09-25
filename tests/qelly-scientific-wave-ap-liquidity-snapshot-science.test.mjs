import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {normalizeDecisionLiquidity,__decisionLiquidityTest} from '../functions/_lib/decision-liquidity.js';
import {compactDecisionToolReceipt} from '../functions/_lib/qelly-chat-tools.js';

const read=(path)=>readFile(new URL('../'+path,import.meta.url),'utf8');
const levels=(start,step,count,sizeBase=2)=>Array.from({length:count},(_,index)=>({
  px:String(start+step*index),
  sz:String(sizeBase+index*.25),
  n:1+index
}));

test('Wave AP derives visible depth bands, coverage and level-gap descriptors from one verified L2 snapshot',()=>{
  const bids=levels(100,-.04,20,3);
  const asks=levels(100.1,.05,20,2);
  // Create one visibly larger but still purely descriptive gap on each side.
  bids[8].px='99.50';
  asks[7].px='100.65';
  const result=normalizeDecisionLiquidity({time:Date.parse('2026-09-25T07:30:00.000Z'),levels:[bids,asks]},{asset:'BTC'});
  assert.equal(result.state,'live');
  assert.equal(result.visibleDepthBands.length,3);
  assert.deepEqual(result.visibleDepthBands.map(item=>item.bps),[5,10,25]);
  assert.ok(result.visibleBidCoverageBps>25);
  assert.ok(result.visibleAskCoverageBps>25);
  assert.equal(result.visibleDepthBands.find(item=>item.bps===10).coverage,'COMPLETE_VISIBLE_BAND');
  assert.ok(result.maxBidLevelGapBps>result.medianBidLevelGapBps);
  assert.ok(result.maxAskLevelGapBps>result.medianAskLevelGapBps);
  assert.ok(result.depthConcentrationTop5>result.depthConcentrationTop1);
  assert.equal(result.liquidityVacuumState,'UNAVAILABLE_FROM_SINGLE_SNAPSHOT');
});

test('Wave AP labels depth-band values as lower bounds when returned levels do not span the full band',()=>{
  const result=normalizeDecisionLiquidity({levels:[
    levels(100,-.005,3,1),
    levels(100.1,.005,3,1)
  ]},{asset:'BTC'});
  assert.equal(result.state,'live');
  assert.ok(result.visibleBidCoverageBps<25);
  assert.ok(result.visibleAskCoverageBps<25);
  assert.equal(result.visibleDepthBands.find(item=>item.bps===25).coverage,'LOWER_BOUND_VISIBLE_DEPTH');
});

test('Wave AP keeps historical-flow and persistent-vacuum claims unavailable',()=>{
  const result=normalizeDecisionLiquidity({levels:[levels(100,-.05,20),levels(100.1,.05,20)]},{asset:'BTC'});
  for(const label of ['CVD','historical book depth','spread percentile','top-of-book stability','order-book volatility','liquidation flow']){
    assert.ok(result.unavailableMetrics.includes(label),label);
  }
  assert.equal(result.liquidityVacuumState,'UNAVAILABLE_FROM_SINGLE_SNAPSHOT');
  assert.match(result.limitations.join(' '),/single snapshot cannot establish a persistent liquidity vacuum/i);
});

test('Wave AP helper calculations preserve nulls and deterministic visible-band coverage',()=>{
  const {distanceBps,levelGapStats,visibleDepthBand}=__decisionLiquidityTest;
  assert.equal(distanceBps(100,0),null);
  const rows=[{price:100,size:1},{price:99.9,size:2},{price:99.5,size:3}];
  const gaps=levelGapStats(rows,100);
  assert.ok(gaps.max>gaps.median);
  const band=visibleDepthBand([{price:99.99,size:1}],[{price:100.01,size:1}],100,5,1,1);
  assert.equal(band.coverage,'LOWER_BOUND_VISIBLE_DEPTH');
  assert.ok(Math.abs(band.imbalance)<0.001);
});

test('Wave AP does not promote new snapshot-only L2 descriptors into directional eligibility',async()=>{
  const source=await read('functions/api/v1/decision-proven-graph.js');
  for(const field of ['visibleDepthBands','visibleBidCoverageBps','maxBidLevelGapBps','liquidityVacuumState']){
    assert.doesNotMatch(source,new RegExp(field+'[^\\n]{0,160}directionalEligible|directionalEligible[^\\n]{0,160}'+field));
  }
  assert.match(source,/spreadBps>15/);
  assert.match(source,/top-five L2 depth is severely imbalanced/);
});

test('Wave AP Decision UI tells users visible-book science is snapshot-only and not a manipulation claim',async()=>{
  const route=await read('apps/web/public/assets/routes/decision-proven-graph.mjs');
  for(const phrase of ['Visible book coverage','Largest visible level gap','Visible 10 bps depth B / A','Liquidity vacuum','Persistent liquidity vacuum','NOT INFERRED']){
    assert.ok(route.includes(phrase),phrase);
  }
  assert.match(route,/not evidence of whales, institutions or smart money/i);
  assert.match(route,/lower bound when the returned book does not cover the full band/i);
});

test('Wave AP QELLY Chat receipt exposes real snapshot descriptors with their availability boundary',()=>{
  const liquidity=normalizeDecisionLiquidity({time:Date.parse('2026-09-25T07:30:00.000Z'),levels:[
    levels(100,-.05,20,3),levels(100.1,.05,20,2)
  ]},{asset:'BTC'});
  const receipt=compactDecisionToolReceipt({
    asset:'BTC',interval:'15m',horizon:'4h',truthState:'LIVE',observedAt:'2026-09-25T07:30:00.000Z',
    qellyView:{action:'WAIT',confidence:.6,evidenceGate:{}},quant:{calibration:{}},
    evidence:{liquidity,derivatives:{},news:{},macro:{},eventRisk:{},crossAsset:{}},
    tradeResearch:{status:'NO_TRADE',matrix:[],targets:[]},historicalAnalogs:{},contradictionAnalysis:{},
    pastPresentFuture:{},evidenceGraph:{nodes:[]}
  });
  assert.equal(receipt.data.liquidity.state,'live');
  assert.equal(receipt.data.liquidity.visibleDepthBands.length,3);
  assert.equal(receipt.data.liquidity.liquidityVacuumState,'UNAVAILABLE_FROM_SINGLE_SNAPSHOT');
  assert.ok(receipt.data.liquidity.unavailableMetrics.includes('CVD'));
});
