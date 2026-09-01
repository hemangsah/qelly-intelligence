import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=(path)=>readFile(new URL(`../${path}`,import.meta.url),'utf8');
const ROUTE='apps/web/public/assets/routes/fundamentals-estimates.mjs';
const CSS='apps/web/public/assets/routes/fundamentals-estimates-v2.css';
const RESPONSIVE='scripts/release-v53-responsive-evidence.py';

test('Fundamentals uses a public governed contract and never reaches protected fixture financial APIs',async()=>{
  const route=await read(ROUTE);
  assert.match(route,/\/api\/v1\/discovery\/fundamentals-estimates/);
  assert.doesNotMatch(route,/\/financials\?frequency=annual|\/earnings|\/estimates|\/corporate-actions/);
  assert.match(route,/Reported fact ≠ consensus ≠ user assumption/);
  assert.match(route,/No fixture financials/);
  assert.match(route,/data-fe-form/);
  assert.match(route,/data-fe-copy/);
  assert.match(route,/data-fe-route="decision-provenance"/);
});

test('Fundamentals responsive CSS reflows without hiding evidence or controls',async()=>{
  const css=await read(CSS);
  assert.match(css,/@media\(max-width:1100px\)/);
  assert.match(css,/@media\(max-width:720px\)/);
  assert.match(css,/@media\(max-width:430px\)/);
  assert.match(css,/\.q-fe-model form\{grid-template-columns:1fr/);
  assert.match(css,/\.q-fe-handoffs>div\{grid-template-columns:1fr/);
  assert.match(css,/\.q-fe-table-wrap\{overflow:auto/);
  assert.doesNotMatch(css,/display\s*:\s*none|visibility\s*:\s*hidden/);
});

test('Fundamentals stays in the governed responsive evidence matrix',async()=>{
  const responsive=await read(RESPONSIVE);
  assert.match(responsive,/'fundamentals-estimates'/);
  for(const width of [360,390,430,768,1024,1280,1440,1728,1920])assert.ok(responsive.includes(String(width)),`missing governed viewport ${width}`);
});
