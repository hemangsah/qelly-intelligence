import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=(path)=>readFile(new URL(`../${path}`,import.meta.url),'utf8');

test('formula library is a human-facing methodology catalog',async()=>{
  const source=await read('apps/web/public/assets/routes/formula-library.mjs');
  assert.match(source,/Search formulas/);
  assert.match(source,/Understand the method before calculating/);
  assert.match(source,/formula-detail/);
  assert.match(source,/Open calculators/);
  assert.doesNotMatch(source,/stable IDs/i);
  assert.doesNotMatch(source,/Formula registry/);
  assert.doesNotMatch(source,/<table/);
  assert.doesNotMatch(source,/provenanceStatus/);
});

test('formula detail keeps methodology and worked example primary',async()=>{
  const source=await read('apps/web/public/assets/routes/formula-detail.mjs');
  assert.match(source,/Assumptions/);
  assert.match(source,/Input guide/);
  assert.match(source,/Worked calculation/);
  assert.match(source,/Technical reference/);
  assert.match(source,/calculator-detail/);
  assert.doesNotMatch(source,/Input JSON/);
});

test('all product catalogs deep-link to their governed detail routes',async()=>{
  const [formulas,indicators,calculators]=await Promise.all([
    read('apps/web/public/assets/routes/formula-library.mjs'),
    read('apps/web/public/assets/routes/indicator-library.mjs'),
    read('apps/web/public/assets/routes/calculator-center.mjs')
  ]);
  assert.match(formulas,/#\/formula-detail\//);
  assert.match(indicators,/#\/indicator-detail\//);
  assert.match(calculators,/#\/calculator-detail\//);
  for(const source of [formulas,indicators,calculators]){
    assert.match(source,/type="search"/);
    assert.doesNotMatch(source,/<textarea/);
  }
});
