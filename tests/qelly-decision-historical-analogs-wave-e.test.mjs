import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {buildDecisionHistoricalAnalogs,__decisionHistoricalAnalogsTest} from '../functions/_lib/decision-historical-analogs.js';

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

test('historical analog engine is deterministic and bounded',()=>{
  const input=candles();
  const a=buildDecisionHistoricalAnalogs(input,{interval:'15m',horizonBars:16,windowBars:100,limit:5});
  const b=buildDecisionHistoricalAnalogs(input,{interval:'15m',horizonBars:16,windowBars:100,limit:5});
  assert.deepEqual(a,b);
  assert.equal(a.state,'AVAILABLE');
  assert.ok(a.analogs.length>=1&&a.analogs.length<=5);
  assert.equal(a.eligibilityImpact,'none');
  assert.match(a.leakageGuard,/No forward return/i);
  assert.match(a.outcomeBoundary,/descriptive historical context/i);
  for(let i=1;i<a.analogs.length;i++)assert.ok(a.analogs[i-1].similarity>=a.analogs[i].similarity);
  for(const analog of a.analogs){
    assert.ok(Date.parse(analog.resolvedAt)>Date.parse(analog.observedAt));
    assert.ok(analog.similarity>=0&&analog.similarity<=1);
    assert.equal(Number.isFinite(analog.forwardReturnPct),true);
    assert.equal(Number.isFinite(analog.maxFavorablePct),true);
    assert.equal(Number.isFinite(analog.maxAdversePct),true);
  }
  assert.equal(Number.isFinite(a.summary.medianForwardReturnPct),true);
  assert.equal(Number.isFinite(a.summary.positiveShare),true);
  assert.equal(Number.isFinite(a.summary.negativeShare),true);
});

test('analog similarity distance has no forward-outcome input',()=>{
  const current={regime:'TRENDING',volatilityRegime:'NORMAL',volatilityPercentile:.5,adx14:25,efficiencyRatio:.4,roc14Pct:2,structureState:'HH_HL',rangePct:4};
  const candidate={...current,roc14Pct:1.5};
  const distance=__decisionHistoricalAnalogsTest.distance(current,candidate);
  assert.equal(Number.isFinite(distance),true);
  assert.ok(distance>=0);
  assert.equal(__decisionHistoricalAnalogsTest.distance(current,{...candidate,outcome:{forwardReturnPct:99}}),distance);
});

test('analog engine fails closed on insufficient history',()=>{
  const result=buildDecisionHistoricalAnalogs(candles(100),{interval:'15m',horizonBars:16});
  assert.equal(result.state,'UNAVAILABLE');
  assert.deepEqual(result.analogs,[]);
});

test('Decision UI labels analogs descriptive-only and preserves mobile containment',async()=>{
  const route=await readFile(new URL('../apps/web/public/assets/routes/decision-proven-graph.mjs',import.meta.url),'utf8');
  const css=await readFile(new URL('../apps/web/public/assets/qelly-decision-proven-graph.css',import.meta.url),'utf8');
  for(const phrase of ['HISTORICAL ANALOGS · DESCRIPTIVE ONLY','Nearest prior market states','NO ELIGIBILITY IMPACT','Leakage guard','Median forward return'])assert.match(route,new RegExp(phrase));
  assert.match(route,/historicalAnalogsMarkup\(data,escapeHtml\)/);
  assert.match(css,/\.q-dpg-analogs\{/);
  assert.match(css,/@media\(max-width:520px\)\{\.q-dpg-analog-summary,\.q-dpg-analog-list\{grid-template-columns:1fr/);
});
