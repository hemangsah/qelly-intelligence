import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=(path)=>readFile(new URL('../'+path,import.meta.url),'utf8');

test('Research Lab exposes the governed quant research library and its non-voting boundary',async()=>{
  const route=await read('apps/web/public/assets/routes/decision-proven-graph.mjs');
  assert.match(route,/const quantResearchMarkup=/);
  assert.match(route,/ADVANCED QUANT RESEARCH LIBRARY/);
  assert.match(route,/Formula breadth for research diagnostics/);
  assert.match(route,/not independent votes/);
  assert.match(route,/Block bootstrap:/);
  assert.match(route,/Monte Carlo:/);
  assert.match(route,/state-space\/Kalman:/);
  assert.match(route,/quantResearchMarkup\(data,escapeHtml\)\+outcomeLedgerMarkup/);
});

test('Research Lab surfaces requested formula families without creating primary-answer votes',async()=>{
  const route=await read('apps/web/public/assets/routes/decision-proven-graph.mjs');
  for(const label of [
    'Returns / volatility','Distribution / risk','Trend / momentum','Mean reversion / dependence',
    'Cumulative','Rolling 20','Realized vol','EWMA vol','Parkinson','Garman-Klass','Rogers-Satchell',
    'VaR 95','ES 95','Max drawdown','OLS slope','Robust slope','Efficiency','ADX','RSI','ROC 14',
    'MACD hist','Stochastic','Bollinger Z','VWAP deviation','Half-life','Benchmark corr','Beta','Spread Z'
  ])assert.ok(route.includes(label),label);
  const researchInsertion=route.indexOf('quantResearchMarkup(data,escapeHtml)+outcomeLedgerMarkup');
  const simplePanel=route.indexOf('qelly-decision-panel-simple');
  assert.ok(researchInsertion>simplePanel);
});

test('quant research CSS remains responsive and visually subordinate to the primary answer',async()=>{
  const css=await read('apps/web/public/assets/qelly-decision-proven-graph.css');
  assert.match(css,/\.q-dpg-quant-research/);
  assert.match(css,/\.q-dpg-quant-research__grid/);
  assert.match(css,/\.q-dpg-quant-research__inventory/);
  assert.match(css,/@media\(max-width:760px\)/);
});
