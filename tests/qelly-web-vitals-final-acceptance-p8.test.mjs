import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=(path)=>readFile(new URL(`../${path}`,import.meta.url),'utf8');

test('first-paint acceptance measures FCP LCP CLS and INP alongside existing runtime signals',async()=>{
  const source=await read('scripts/qelly-first-paint-stability.mjs');
  for(const type of ['paint','largest-contentful-paint','layout-shift','event','longtask']){
    assert.match(source,new RegExp(`type:'${type}'`));
  }
  assert.match(source,/fcpMs/);
  assert.match(source,/lcpMs/);
  assert.match(source,/cls/);
  assert.match(source,/inpMs/);
  assert.match(source,/interactionCount/);
  assert.match(source,/representativeInteraction/);
  assert.match(source,/data-growth-open/);
});

test('Web Vitals acceptance uses bounded non-regression thresholds without modifying product logic',async()=>{
  const source=await read('scripts/qelly-first-paint-stability.mjs');
  assert.match(source,/fcpMs\)>3000/);
  assert.match(source,/lcpMs\)>4000/);
  assert.match(source,/cls\)>0\.25/);
  assert.match(source,/inpMs\)>500/);
  assert.match(source,/vitalsMeasured/);
  assert.match(source,/vitalRegressions/);
  assert.match(source,/vitalsMissing/);
});

test('route-cycle forced-GC memory DOM and listener convergence remains part of the same acceptance harness',async()=>{
  const source=await read('scripts/qelly-first-paint-stability.mjs');
  assert.match(source,/HeapProfiler\.collectGarbage/);
  assert.match(source,/JSHeapUsedSize/);
  assert.match(source,/JSEventListeners/);
  assert.match(source,/domNodes/);
  assert.match(source,/cycles:6/);
  assert.match(source,/materialContinuousGrowth/);
});

test('Browser E2E is triggered when the Web Vitals harness changes',async()=>{
  const workflow=await read('.github/workflows/browser-e2e.yml');
  assert.match(workflow,/scripts\/qelly-first-paint-stability\.mjs/);
  assert.match(workflow,/Validate cold and warm first-paint stability/);
});
