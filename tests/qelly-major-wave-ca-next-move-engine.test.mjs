import test from 'node:test';
import assert from 'node:assert/strict';
import {buildDecisionScenarioDistribution,buildDecisionWalkForwardCalibration} from '../functions/_lib/decision-proven-graph.js';
import {buildDecisionNextMoveResearch,__decisionNextMoveTest} from '../functions/_lib/decision-next-move.js';

function candles(count=720){
  const rows=[];let close=100;const start=1_760_000_000_000;
  for(let i=0;i<count;i++){
    const regime=i%140<82?1:-1;
    const ret=regime*.00055+Math.sin(i/9)*.0018+Math.sin(i/31)*.0008+(((i*29)%19)-9)*.00016;
    const open=close;close=Math.max(1,open*Math.exp(ret));const width=.002+Math.abs(Math.sin(i/13))*.0018;
    rows.push({time:start+i*900_000,open,high:Math.max(open,close)*(1+width),low:Math.min(open,close)*(1-width*.9),close,volume:1000+(i%29)*27,trades:100+i%60});
  }
  return rows;
}

test('Wave CA scenario distribution is deterministic and supports a one-candle horizon',()=>{
  const input=candles();
  const a=buildDecisionScenarioDistribution(input,{interval:'15m',horizonBars:1,paths:192});
  const b=buildDecisionScenarioDistribution(input,{interval:'15m',horizonBars:1,paths:192});
  assert.deepEqual(a,b);
  assert.equal(a.horizonBars,1);
  assert.equal(a.fan.length,1);
  assert.ok(a.fan[0].p05<=a.fan[0].p25&&a.fan[0].p25<=a.fan[0].p50&&a.fan[0].p50<=a.fan[0].p75&&a.fan[0].p75<=a.fan[0].p95);
  assert.ok(Math.abs(Object.values(a.probabilities).reduce((sum,value)=>sum+value,0)-1)<.0001);
  assert.ok(a.expectedVolatilityPct>=0);
});

test('Wave CA next-candle calibration is separate, non-overlapping and carries confidence intervals',()=>{
  const calibration=buildDecisionWalkForwardCalibration(candles(),{interval:'15m',horizonBars:1,minSamples:36});
  assert.equal(calibration.horizonBars,1);
  assert.equal(calibration.resolutionWindowBars,1);
  assert.equal(calibration.outcomeWindowOverlap,false);
  assert.ok(calibration.stepBars>=1);
  assert.ok(calibration.sampleSize>=36);
  assert.ok(calibration.correctClassRateConfidenceInterval95);
  assert.ok(calibration.reliabilityBins.every(bin=>bin.confidenceInterval95&&bin.confidenceInterval95.low>=0&&bin.confidenceInterval95.high<=1));
});

test('Wave CA produces 1/3/5 plus bounded custom research and never marks projections observed',()=>{
  const research=buildDecisionNextMoveResearch(candles(),{asset:'BTC',interval:'15m',customBars:8,paths:192});
  assert.equal(research.schemaVersion,'qelly.decision-next-move/1.0.0');
  assert.deepEqual(research.horizons.map(item=>item.horizonBars),[1,3,5,8]);
  assert.equal(research.nextCandle.projection.observed,false);
  assert.equal(research.nextCandle.projection.state,'PROJECTED');
  for(const item of research.horizons){
    assert.equal(Object.values(item.modelProbabilities).reduce((sum,value)=>sum+value,0).toFixed(4),'1.0000');
    assert.ok(item.likelyBand.low<=item.expectedRange.p50&&item.expectedRange.p50<=item.likelyBand.high);
    assert.match(item.boundary,/not guarantees|withheld/i);
  }
});

test('Wave CA withholds uncalibrated and unsupported extreme probabilities',()=>{
  const probabilities={bullish:.91,neutral:.05,bearish:.04};
  const calibration={eligible:false,state:'UNCALIBRATED',sampleSize:10,reliabilityBins:[]};
  const gate=__decisionNextMoveTest.publicationGate(probabilities,calibration);
  assert.equal(gate.probabilityPublishable,false);
  assert.equal(gate.state,'UNCALIBRATED');

  const weakExtreme=__decisionNextMoveTest.publicationGate(probabilities,{
    eligible:true,state:'CALIBRATED',sampleSize:70,
    reliabilityBins:[{low:.9,high:1,sampleSize:12,hitRate:.75,confidenceInterval95:{low:.48,high:.91}}]
  });
  assert.equal(weakExtreme.probabilityPublishable,false);
  assert.equal(weakExtreme.state,'HIGH_PROBABILITY_WITHHELD');
});

test('Wave CA probability governance permits high probabilities only with stronger reliability evidence',()=>{
  const probabilities={bullish:.91,neutral:.05,bearish:.04};
  const stillInsufficient=__decisionNextMoveTest.publicationGate(probabilities,{
    eligible:true,state:'CALIBRATED',sampleSize:199,
    reliabilityBins:[{low:.9,high:1,sampleSize:199,hitRate:.9,confidenceInterval95:{low:.74,high:.97}}]
  });
  assert.equal(stillInsufficient.probabilityPublishable,false);
  assert.equal(stillInsufficient.state,'HIGH_PROBABILITY_WITHHELD');

  const strong=__decisionNextMoveTest.publicationGate(probabilities,{
    eligible:true,state:'CALIBRATED',sampleSize:240,
    reliabilityBins:[{low:.9,high:1,sampleSize:210,hitRate:.9,confidenceInterval95:{low:.74,high:.97}}]
  });
  assert.equal(strong.probabilityPublishable,true);
  assert.equal(strong.state,'PUBLISHABLE');
});
