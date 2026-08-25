import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=(path)=>readFile(new URL(`../${path}`,import.meta.url),'utf8');

test('final product layer governs focus, target size and compact production controls',async()=>{
  const css=await read('apps/web/public/assets/qelly-product-experience.css');
  assert.match(css,/--q-target-min:40px/);
  assert.match(css,/--q-focus-ring:/);
  assert.match(css,/:focus-visible\{[\s\S]*outline:3px solid var\(--q-focus-ring\)!important/);
  assert.match(css,/button\[aria-label="Dismiss notification"\][\s\S]*min-width:var\(--q-target-min\)!important/);
  assert.match(css,/\.qelly-tradingview-attribution a,[\s\S]*\.q-v6-runtime-provider>a/);
  assert.match(css,/\.q-grid-resizer\{[\s\S]*width:24px!important/);
  assert.match(css,/@media\(max-width:760px\)\{[\s\S]*--q-target-min:44px/);
});

test('shared interaction runtime normalizes external and stateful controls',async()=>{
  const runtime=await read('apps/web/public/assets/qelly-product-experience.mjs');
  assert.match(runtime,/interactiveSelector=/);
  assert.match(runtime,/pointerdown/);
  assert.match(runtime,/keydown/);
  assert.match(runtime,/MutationObserver/);
  assert.match(runtime,/rel\.add\('noopener'\)/);
  assert.match(runtime,/rel\.add\('noreferrer'\)/);
  assert.match(runtime,/dataset\.interactionDiscipline='ready'/);
});

test('architecture standard rejects new prompt and wave naming',async()=>{
  const standard=await read('docs/architecture/PRODUCT_DISCIPLINE_STANDARD.md');
  assert.match(standard,/Do not create names containing prompt numbers/);
  assert.match(standard,/All exposed tables use RLS/);
  assert.match(standard,/exact-SHA Cloudflare convergence/);
});
