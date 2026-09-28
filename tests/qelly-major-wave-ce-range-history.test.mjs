import test from 'node:test';
import assert from 'node:assert/strict';
import {buildDecisionRangeReplay,buildSelectedRangeSimilarMoves} from '../functions/_lib/decision-range-history.js';

const T0=1_700_000_000_000,STEP=60_000;
const candles=Array.from({length:90},(_,i)=>{
  const cycle=(i%12)-6,base=100+i*.08+cycle*.12,open=base,close=base+(i%3===0?.42:i%3===1?-.18:.12);
  return {t:T0+i*STEP,o:open,h:Math.max(open,close)+.35,l:Math.min(open,close)-.3,c:close,v:1000+(i%9)*80};
});
const selection={start:T0+70*STEP,end:T0+77*STEP};

test('Wave CE replay exposes evidence only when its timestamp has arrived',()=>{
  const news=[
    {title:'early',source:'fixture',publishedAt:new Date(T0+71*STEP).toISOString()},
    {title:'late',source:'fixture',publishedAt:new Date(T0+76*STEP).toISOString()}
  ];
  const funding=[
    {time:T0+72*STEP,fundingRate:.0001,premium:.0002},
    {time:T0+77*STEP,fundingRate:.0003,premium:.0004}
  ];
  const benchmark=candles.map((item,i)=>({...item,c:item.c*(1+i*.0002),o:item.o*(1+i*.0002),h:item.h*(1+i*.0002),l:item.l*(1+i*.0002)}));
  const replay=buildDecisionRangeReplay({candles,selection,interval:'1m',newsArticles:news,fundingRows:funding,benchmarkCandles:benchmark,benchmark:'ETH'});
  assert.equal(replay.state,'AVAILABLE');
  assert.equal(replay.totalFrames,8);
  assert.equal(replay.frames[0].evidenceAvailableAsOf.news.count,0);
  assert.equal(replay.frames[0].evidenceAvailableAsOf.settledFunding.count,0);
  assert.equal(replay.frames[1].evidenceAvailableAsOf.news.count,1);
  assert.equal(replay.frames.at(-2).evidenceAvailableAsOf.news.count,2);
  assert.equal(replay.frames.at(-2).evidenceAvailableAsOf.settledFunding.count,1);
  assert.equal(replay.frames.at(-1).evidenceAvailableAsOf.settledFunding.count,2);
  assert.equal(replay.frames[0].futureEvidenceHidden,true);
  assert.equal(replay.frames.at(-1).futureEvidenceHidden,false);
  assert.match(replay.hindsightGuard,/not copied backward/i);
});

test('Wave CE early replay frames do not receive full-range future high low or ending return',()=>{
  const replay=buildDecisionRangeReplay({candles,selection,interval:'1m'});
  const selected=candles.filter(item=>item.t>=selection.start&&item.t<=selection.end);
  const first=replay.frames[0],last=replay.frames.at(-1);
  assert.equal(first.knownRange.high,Number(selected[0].h.toFixed(8)));
  assert.equal(first.knownRange.low,Number(selected[0].l.toFixed(8)));
  assert.notEqual(first.knownRange.returnPct,last.knownRange.returnPct);
  assert.ok(last.knownRange.high>=first.knownRange.high);
  assert.ok(last.knownRange.low<=first.knownRange.low);
});

test('Wave CE selected-range analog outcomes are resolved entirely before the selected target begins',()=>{
  const result=buildSelectedRangeSimilarMoves(candles,{selection,interval:'1m',limit:6});
  assert.ok(['AVAILABLE','UNAVAILABLE'].includes(result.state));
  for(const analog of result.analogs){
    assert.ok(Date.parse(analog.rangeEnd)<selection.start);
    assert.ok(Date.parse(analog.outcome.resolvedAt)<selection.start);
    assert.ok(Number.isFinite(analog.outcome.maxFavorablePct));
    assert.ok(Number.isFinite(analog.outcome.maxAdversePct));
    assert.ok(analog.outcome.timeToResolutionMs>0);
  }
  assert.equal(result.eligibilityImpact,'none');
  assert.match(result.leakageGuard,/after candidate selection/i);
  assert.match(result.outcomeBoundary,/not calibrated probabilities/i);
});

test('Wave CE similarity ranking cannot see post-range outcome mutations',()=>{
  const baseline=buildSelectedRangeSimilarMoves(candles,{selection,interval:'1m',limit:6});
  const mutated=candles.map((item,i)=>i>=54&&i<70?{...item,h:item.h*1.8,l:item.l*.45,c:item.c*1.35}:item);
  const changed=buildSelectedRangeSimilarMoves(mutated,{selection,interval:'1m',limit:6});
  const baseRanks=baseline.analogs.map(item=>[item.rangeStart,item.similarity]);
  const changedRanks=changed.analogs.map(item=>[item.rangeStart,item.similarity]);
  assert.deepEqual(changedRanks,baseRanks);
});

test('Wave CE fails closed when replay or similarity range is not in returned provider history',()=>{
  const outside={start:T0-100*STEP,end:T0-90*STEP};
  assert.equal(buildDecisionRangeReplay({candles,selection:outside,interval:'1m'}).state,'UNAVAILABLE');
  assert.equal(buildSelectedRangeSimilarMoves(candles,{selection:outside,interval:'1m'}).state,'UNAVAILABLE');
});


test('Wave CE accepts the real Decision graph ISO selected-range timestamp shape',()=>{
  const isoSelection={
    start:new Date(selection.start).toISOString(),
    end:new Date(selection.end+STEP-1).toISOString()
  };
  const replay=buildDecisionRangeReplay({candles,selection:isoSelection,interval:'1m'});
  const similar=buildSelectedRangeSimilarMoves(candles,{selection:isoSelection,interval:'1m',limit:6});
  assert.equal(replay.state,'AVAILABLE');
  assert.equal(replay.totalFrames,8);
  assert.equal(replay.rangeStart,new Date(selection.start).toISOString());
  assert.ok(['AVAILABLE','UNAVAILABLE'].includes(similar.state));
  assert.equal(similar.target?.rangeStart,new Date(selection.start).toISOString());
  assert.equal(similar.target?.windowBars,8);
});
