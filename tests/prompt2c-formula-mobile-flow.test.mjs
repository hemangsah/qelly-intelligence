import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const source=await readFile(new URL('../apps/web/public/assets/qelly-shell-compat.js',import.meta.url),'utf8');

test('formula detail panels use an explicit responsive document flow',()=>{
  assert.match(source,/\.q-formula-detail-page \.q-calculator-layout\{display:flex!important;flex-direction:column!important;/);
  assert.match(source,/\.q-formula-detail-page \.q-calculator-layout>\.q-panel\{position:static!important;inset:auto!important;display:block!important;width:100%!important;/);
  assert.match(source,/visibility:visible!important;opacity:1!important;float:none!important/);
});

test('mobile formula input guide exposes all guidance without horizontal scrolling',()=>{
  assert.match(source,/\.q-formula-detail-page \.q-responsive-table\{overflow:visible;scrollbar-gutter:auto;border:0;background:transparent\}/);
  assert.match(source,/\.q-formula-detail-page \.q-responsive-table tbody tr\{display:grid;grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(source,/tbody td:nth-child\(4\)\{grid-column:1\/-1;/);
  assert.match(source,/tbody td:nth-child\(4\)::before\{content:"Guidance"\}/);
  assert.doesNotMatch(source,/@media\(max-width:560px\)[\s\S]*?\.q-formula-detail-page \.q-responsive-table table\{min-width:620px/);
});
