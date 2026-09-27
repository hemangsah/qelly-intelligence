import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=(path)=>readFile(new URL('../'+path,import.meta.url),'utf8');

test('Wave CA renders projected next-candle range distinctly from observed candles',async()=>{
  const [route,css]=await Promise.all([read('apps/web/public/assets/routes/decision-proven-graph.mjs'),read('apps/web/public/assets/qelly-decision-proven-graph.css')]);
  for(const token of ['data-dpg-projected-range','data-projection-state="PROJECTED"','Projected next-candle range; not observed','FUTURE · PROJECTED SCENARIOS'])assert.ok(route.includes(token),token);
  assert.match(css,/q-dpg-projected-range__outer.*stroke-dasharray/);
  assert.match(css,/q-dpg-projected-range__inner.*rgba/);
  assert.doesNotMatch(route,/data-dpg-projected-range[^\n]*data-candle-index/);
});

test('Wave CA UI only publishes numeric probabilities from the governed published distribution',async()=>{
  const route=await read('apps/web/public/assets/routes/decision-proven-graph.mjs');
  for(const phrase of ['NEXT MOVE RESEARCH · PROJECTED','UNCALIBRATED','Numeric probabilities withheld.','Expected range · inner 50%','Likely high / low band','Expected volatility','Projection invalidation','Probability governance'])assert.ok(route.includes(phrase),phrase);
  assert.match(route,/const probabilities=item\.publishedProbabilities/);
  assert.doesNotMatch(route,/item\.modelProbabilities\[/);
});

test('Wave CA supports 1 3 5 and bounded custom horizon controls',async()=>{
  const route=await read('apps/web/public/assets/routes/decision-proven-graph.mjs');
  assert.ok(route.includes("['1','Next candle'],['3','3 candles'],['5','5 candles'],['custom','Custom']"));
  assert.match(route,/Math\.max\(1,Math\.min\(12,Math\.round\(Number\(event\.currentTarget\.value\)\|\|8\)\)\)/);
  assert.match(route,/const nextBars=state\.nextMoveBars==='custom'/);
  assert.match(route,/data-dpg-next-custom/);
});
