import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=path=>readFile(new URL(path,import.meta.url),'utf8');
const cleanup=()=>read('../apps/web/public/assets/qelly-v53-lock-route-cleanup.mjs');
const css=()=>read('../apps/web/public/assets/qelly-v53-real-analysis.css');
const advanced=()=>read('../apps/web/public/assets/routes/advanced-chart.mjs');
const screener=()=>read('../apps/web/public/assets/routes/screener-lab.mjs');

test('Advanced Chart and Screener Lab own real V5.3 DOM instead of synthetic lock surfaces',async()=>{
  const source=await cleanup();
  assert.match(source,/REAL_ANALYSIS_ROUTES=new Set\(\['advanced-chart','screener-lab'\]\)/);
  assert.match(source,/DEDICATED_REAL_ROUTES=new Set\(\['live-markets','market',\.\.\.REAL_ANALYSIS_ROUTES\]\)/);
  assert.match(source,/qelly-v53-real-analysis\.css/);
  assert.match(source,/root\.dataset\.v53RealAnalysis=route/);
  assert.match(source,/synthetic&&isDedicatedRealRoute\(\)/);
});

test('analytical-family CSS is route-scoped, dense and mobile-collapsible',async()=>{
  const source=await css();
  assert.match(source,/html\[data-v53-real-analysis\] #main > \.q-page/);
  assert.match(source,/grid-template-columns:minmax\(0,1fr\) 286px/);
  assert.match(source,/position:sticky/);
  assert.match(source,/@media\(max-width:900px\)/);
  assert.match(source,/scroll-snap-type:x mandatory/);
  assert.match(source,/grid-template-columns:1fr/);
  assert.doesNotMatch(source,/\.q-v53-lock-page/);
  assert.doesNotMatch(source,/display\s*:\s*none/);
});

test('Advanced Chart real renderer exposes V5.3 evidence without inventing confidence or live data',async()=>{
  const source=await advanced();
  assert.match(source,/q-v53-real-workspace/);
  assert.match(source,/q-v53-real-inspector/);
  assert.match(source,/TRUTH STATE/);
  assert.match(source,/Packaged OHLCV fixture/);
  assert.match(source,/CONFIDENCE','Not supplied/);
  assert.match(source,/OBSERVED AT','Not supplied by fixture contract/);
  assert.match(source,/Read-only analytical surface/);
  assert.doesNotMatch(source,/data-action="(?:execute|trade|order|wallet|withdraw)/i);
});

test('Screener Lab real renderer exposes source, coverage, method and read-only guardrails',async()=>{
  const source=await screener();
  assert.match(source,/q-v53-real-workspace/);
  assert.match(source,/q-v53-real-inspector/);
  assert.match(source,/Local governed screener catalog/);
  assert.match(source,/CONFIDENCE','Not supplied/);
  assert.match(source,/Missing values preserved/);
  assert.match(source,/Read-only decision support/);
  assert.doesNotMatch(source,/data-action="(?:execute|trade|order|wallet|withdraw)/i);
});
