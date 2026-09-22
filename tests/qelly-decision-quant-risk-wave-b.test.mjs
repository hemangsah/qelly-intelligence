import test from 'node:test';
import assert from 'node:assert/strict';
import {buildDecisionQuantRisk} from '../functions/_lib/decision-quant-risk.js';
import {buildDecisionProvenGraph} from '../functions/_lib/decision-proven-graph.js';
import {buildTradeResearch} from '../functions/_lib/decision-trade-research.js';

const candles=(count=220)=>{
  const start=1_760_000_000_000,rows=[];
  let close=100;
  for(let i=0;i<count;i++){
    const drift=.0008+Math.sin(i/9)*.0015;
    const open=close;
    close=open*Math.exp(drift);
    const high=Math.max(open,close)*(1.002+((i%5)*.0002));
    const low=Math.min(open,close)*(0.998-((i%3)*.00015));
    rows.push({time:start+i*900_000,open,high,low,close,volume:1000+i*3,trades:100+i});
  }
  return rows;
};

test('advanced Decision quant library returns bounded finite research metrics',()=>{
  const quant=buildDecisionQuantRisk(candles(),{intervalMs:900_000,horizonBars:16});
  assert.equal(quant.state,'DERIVED');
  assert.ok(quant.sampleSize>=200);
  for(const value of [
    quant.volatility.realizedPct,
    quant.volatility.downsideDeviationPct,
    quant.volatility.garmanKlassPct,
    quant.volatility.rogersSatchellPct,
    quant.volatility.expectedMovePct,
    quant.trend.adx14,
    quant.trend.efficiencyRatio,
    quant.structure.support,
    quant.structure.resistance
  ])assert.equal(Number.isFinite(value),true);
  assert.ok(['LOW','NORMAL','ELEVATED','HIGH'].includes(quant.volatility.regime));
  assert.ok(['TRENDING','RANGING','HIGH_VOLATILITY','TRANSITION'].includes(quant.regime));
  assert.equal(quant.calibration.state,'UNCALIBRATED');
  assert.equal(quant.calibration.brierScore,null);
  assert.equal(quant.calibration.sampleSize,0);
  assert.doesNotMatch(JSON.stringify(quant),/NaN|Infinity/);
});

test('Decision provenance graph exposes quant regime without changing execution boundary',()=>{
  const graph=buildDecisionProvenGraph(candles(),{asset:'BTC',interval:'15m',horizonBars:16,now:1_760_000_000_000+220*900_000});
  assert.equal(graph.execution,false);
  assert.equal(graph.quant.state,'DERIVED');
  assert.ok(graph.market.currentState.regime);
  assert.ok(graph.provenance.model.features.includes('Garman-Klass volatility'));
  assert.ok(graph.provenance.model.features.includes('market structure'));
});

test('R:R research rejects a structurally blocked target and preserves null target-touch probability',()=>{
  const graph={
    qellyView:{action:'BUY',confidence:.8,evidenceGate:{qualityScore:.85},levels:{entryZone:[100,100],invalidation:95},contradictions:[],changesIf:'Structure fails.'},
    market:{lastPrice:100},
    freshness:{intervalMs:900_000},
    observedAt:new Date(1_760_000_000_000).toISOString(),
    horizonBars:8,
    metrics:{atrPct:2},
    forecast:{fan:[{p05:80,p25:90,p75:105,p95:130}]},
    quant:{volatility:{regime:'NORMAL',expectedMovePct:12},structure:{support:92,resistance:106},calibration:{state:'CALIBRATED',sampleSize:300,brierScore:.18,reliabilityBins:[]}}
  };
  const result=buildTradeResearch(graph,{requestedRr:'1:2'});
  assert.equal(result.status,'NO_TRADE');
  assert.equal(result.selected.feasibility,'LOW');
  assert.equal(result.selected.structuralBarrier,106);
  assert.equal(result.selected.targetTouchProbability,null);
  assert.equal(result.selected.expectedValue,null);
  assert.equal(result.riskContext.volatilityRegime,'NORMAL');
});
