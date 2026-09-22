import test from 'node:test';
import assert from 'node:assert/strict';
import {computeAdvancedDecisionMetrics,buildHistoricalDecisionAnalogs} from '../functions/_lib/decision-advanced-quant.js';

const interval=900_000;
const start=1_800_000_000_000;
const candles=Array.from({length:420},(_,index)=>{
  const base=100+index*.025+Math.sin(index/8)*2+Math.sin(index/27)*1.2;
  const open=base-Math.sin(index/5)*.2;
  const close=base+Math.cos(index/6)*.25;
  return {time:start+index*interval,open,high:Math.max(open,close)+.7,low:Math.min(open,close)-.65,close,volume:1000+Math.sin(index/11)*150+index*.8};
});

test('advanced decision metrics stay finite and expose independent volatility estimators',()=>{
  const metrics=computeAdvancedDecisionMetrics(candles,{intervalMs:interval});
  for(const key of ['garmanKlassVolatilityPct','rogersSatchellVolatilityPct','efficiencyRatio','roc14Pct','bollingerZ20','rangePosition20Pct','volatilityPercentile','downsideDeviationPct'])assert.ok(metrics[key]===null||Number.isFinite(metrics[key]),key);
  assert.ok(metrics.garmanKlassVolatilityPct>0);
  assert.ok(metrics.rogersSatchellVolatilityPct>0);
  assert.ok(metrics.efficiencyRatio>=0&&metrics.efficiencyRatio<=1);
  assert.ok(metrics.rangePosition20Pct>=0&&metrics.rangePosition20Pct<=100);
  assert.match(metrics.volatilityRegime,/low|normal|elevated|high/);
});

test('historical analog engine is deterministic, bounded and does not claim forecast probability',()=>{
  const first=buildHistoricalDecisionAnalogs(candles,{lookbackBars:20,horizonBars:16,maxAnalogs:12});
  const second=buildHistoricalDecisionAnalogs(candles,{lookbackBars:20,horizonBars:16,maxAnalogs:12});
  assert.deepEqual(first,second);
  assert.equal(first.state,'derived');
  assert.ok(first.count>=3&&first.count<=12);
  assert.equal(first.analogs.length,first.count);
  assert.ok(first.analogs.every(item=>Number.isFinite(item.distance)&&Number.isFinite(item.outcomePct)));
  assert.ok(first.summary.positiveRate>=0&&first.summary.positiveRate<=1);
  assert.ok(first.summary.negativeRate>=0&&first.summary.negativeRate<=1);
  assert.match(first.methodology,/descriptive historical analogs, not forecast probabilities/i);
});

test('historical analog engine fails closed when history is insufficient',()=>{
  const result=buildHistoricalDecisionAnalogs(candles.slice(0,40),{lookbackBars:20,horizonBars:16});
  assert.equal(result.state,'insufficient-history');
  assert.equal(result.count,0);
  assert.deepEqual(result.analogs,[]);
});
