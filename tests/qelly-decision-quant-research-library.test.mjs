import test from 'node:test';
import assert from 'node:assert/strict';
import {buildDecisionQuantResearch,QUANT_RESEARCH_FORMULAS,__decisionQuantResearchTest} from '../functions/_lib/decision-quant-research.js';
import {buildDecisionProvenGraph} from '../functions/_lib/decision-proven-graph.js';

const candles=(count=260,{phase=0,drift=.00055,amplitude=.0014}={})=>{
  const start=1_760_000_000_000,rows=[];
  let close=100;
  for(let i=0;i<count;i++){
    const shock=drift+Math.sin((i+phase)/8)*amplitude+Math.cos((i+phase)/19)*.0006;
    const open=close;
    close=open*Math.exp(shock);
    const span=.0018+((i%7)*.00008);
    const high=Math.max(open,close)*(1+span);
    const low=Math.min(open,close)*(1-span*.92);
    rows.push({time:start+i*900_000,open,high,low,close,volume:1000+((i%17)*37)+i*2});
  }
  return rows;
};

const meanReverting=(count=260)=>{
  const start=1_760_000_000_000,rows=[];
  let dev=.03,prev=100*Math.exp(dev);
  for(let i=0;i<count;i++){
    dev=.78*dev+Math.sin(i*.9)*.0035;
    const close=100*Math.exp(dev),open=prev,span=.0015+Math.abs(Math.sin(i/5))*.0008;
    rows.push({time:start+i*900_000,open,high:Math.max(open,close)*(1+span),low:Math.min(open,close)*(1-span),close,volume:1200+((i%11)*29)});
    prev=close;
  }
  return rows;
};

test('quant research catalog defines role and formula semantics without duplicate ids',()=>{
  assert.ok(QUANT_RESEARCH_FORMULAS.length>=60);
  const ids=new Set();
  for(const item of QUANT_RESEARCH_FORMULAS){
    assert.ok(item.id);
    assert.ok(item.family);
    assert.ok(item.role);
    assert.ok(item.definition.length>12);
    assert.equal(ids.has(item.id),false,item.id);
    ids.add(item.id);
  }
  for(const required of [
    'arithmetic-return','log-return','ewma-volatility','parkinson-volatility','garman-klass-volatility','rogers-satchell-volatility',
    'historical-var','expected-shortfall','max-drawdown','robust-slope','efficiency-ratio','adx','macd','bollinger-z',
    'vwap-deviation','mean-reversion-half-life','rolling-correlation','spread-z-score','lead-lag','cointegration','block-bootstrap'
  ])assert.equal(ids.has(required),true,required);
});

test('quant research library returns finite bounded research metrics across requested families',()=>{
  const result=buildDecisionQuantResearch(candles(),{intervalMs:900_000});
  assert.equal(result.state,'DERIVED');
  assert.equal(result.sampleSize,260);
  assert.match(result.boundary,/not independent votes/i);
  for(const value of [
    result.returns.arithmeticLatestPct,result.returns.cumulativePct,result.returns.rolling20Pct,
    result.volatility.realizedPct,result.volatility.ewmaPct,result.volatility.parkinsonPct,result.volatility.garmanKlassPct,result.volatility.rogersSatchellPct,
    result.distribution.meanPct,result.distribution.skew,result.distribution.excessKurtosis,result.distribution.zScore,result.distribution.robustZScore,
    result.risk.historicalVaR95Pct,result.risk.expectedShortfall95Pct,result.risk.maxDrawdownPct,result.risk.tailRatio,
    result.trend.olsSlopePctPerBar,result.trend.robustSlopePctPerBar,result.trend.efficiencyRatio,result.trend.adx14,
    result.momentum.roc14Pct,result.momentum.rsi14,result.momentum.macd.linePct,result.momentum.stochasticK14,
    result.meanReversion.bollingerZ,result.meanReversion.rollingDeviationPct,result.meanReversion.rangePosition,result.meanReversion.vwapDeviationPct
  ])assert.equal(Number.isFinite(value),true,String(value));
  assert.ok(['LOW','NORMAL','ELEVATED','HIGH'].includes(result.volatility.regime));
  assert.ok(['BULLISH','BEARISH','MIXED'].includes(result.trend.sma.state));
  assert.ok(['BULLISH','BEARISH','MIXED'].includes(result.trend.ema.state));
  assert.equal(result.dependence.state,'UNAVAILABLE');
  assert.equal(result.forecasting.blockBootstrap.state,'IMPLEMENTED_IN_DECISION_SCENARIO_ENGINE');
  assert.equal(result.forecasting.monteCarlo.state,'NOT_USED');
  assert.equal(result.forecasting.stateSpace.state,'NOT_USED');
  assert.doesNotMatch(JSON.stringify(result),/NaN|Infinity/);
});

test('mean-reversion half-life is only published when the bounded AR fit is coherent',()=>{
  const result=buildDecisionQuantResearch(meanReverting(),{intervalMs:900_000});
  assert.equal(result.meanReversion.halfLife.state,'AVAILABLE');
  assert.ok(result.meanReversion.halfLife.halfLifeBars>0);
  assert.ok(result.meanReversion.halfLife.phi>0&&result.meanReversion.halfLife.phi<.999);
  assert.ok(result.meanReversion.halfLife.r2>=.1);
  assert.match(result.meanReversion.halfLife.reason,/not proof of stationarity|descriptive/i);
});

test('optional benchmark dependence is descriptive and refuses to infer cointegration',()=>{
  const own=candles(260,{phase:0,drift:.00055,amplitude:.0014});
  const benchmark=candles(260,{phase:1,drift:.00045,amplitude:.00115});
  const result=buildDecisionQuantResearch(own,{intervalMs:900_000,benchmarkCandles:benchmark});
  assert.equal(result.dependence.state,'AVAILABLE');
  assert.ok(result.dependence.sampleSize>=250);
  for(const value of [result.dependence.correlation,result.dependence.beta,result.dependence.relativeStrengthPct,result.dependence.rollingRegression.beta,result.dependence.spreadZScore])assert.equal(Number.isFinite(value),true);
  assert.ok(Array.isArray(result.dependence.leadLag.rows));
  assert.equal(result.dependence.leadLag.rows.length,7);
  assert.equal(result.dependence.cointegration.state,'NOT_EVALUATED');
  assert.match(result.dependence.cointegration.reason,/not inferred/i);
  assert.match(result.dependence.boundary,/do(?:es)? not become an independent BUY\/SELL vote/i);
});

test('helper formulas stay numerically safe on flat or insufficient inputs',()=>{
  const flat=candles(100,{drift:0,amplitude:0}).map((item,index)=>({...item,open:100,high:100.1,low:99.9,close:100,volume:1000+index}));
  const result=buildDecisionQuantResearch(flat,{intervalMs:900_000});
  assert.equal(result.state,'DERIVED');
  assert.doesNotMatch(JSON.stringify(result),/NaN|Infinity/);
  const short=buildDecisionQuantResearch(flat.slice(0,40),{intervalMs:900_000});
  assert.equal(short.state,'INSUFFICIENT_DATA');
  assert.match(short.boundary,/At least 80/);
  assert.equal(__decisionQuantResearchTest.rsi(flat.map(item=>item.close),14),50);
});

test('Decision graph exposes the research library without changing execution or directional boundaries',()=>{
  const rows=candles();
  const graph=buildDecisionProvenGraph(rows,{asset:'BTC',interval:'15m',horizonBars:16,now:rows.at(-1).time});
  assert.equal(graph.execution,false);
  assert.equal(graph.quant.researchLibrary.state,'DERIVED');
  assert.match(graph.quant.researchLibrary.boundary,/does not change Decision eligibility|not independent votes/i);
  assert.ok(graph.quant.researchLibrary.formulaCatalog.length>=60);
  assert.ok(graph.provenance.model.features.includes('governed quant research library'));
  assert.match(graph.provenance.model.limitations.join(' '),/does not become an independent directional vote/i);
});
