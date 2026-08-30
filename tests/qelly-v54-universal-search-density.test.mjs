import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const css=fs.readFileSync('apps/web/public/assets/routes/universal-search-v2.css','utf8');
const app=fs.readFileSync('apps/web/public/assets/app.js','utf8');
const route=fs.readFileSync('apps/web/public/assets/routes/universal-search.mjs','utf8');

test('Universal Search keeps the full deterministic result corpus in the rendered surface',()=>{
  assert.match(app,/renderUniversalSearch/);
  assert.match(route,/\/api\/v1\/search\?q=/);
  assert.match(route,/items\.map\(\(item\)=>resultCard/);
  assert.doesNotMatch(route,/data\.items\.slice\(/);
});

test('Universal Search desktop results are bounded by the executable route owner',()=>{
  assert.match(css,/\.q-us-workbench\{display:grid;grid-template-columns:minmax\(0,1fr\) 320px/);
  assert.match(css,/\.q-us-results\{[^}]*max-height:min\(68dvh,760px\);overflow:auto;overscroll-behavior:contain;scrollbar-gutter:stable/);
  assert.match(css,/\.q-us-result>a\{display:grid;grid-template-columns:44px minmax\(0,1fr\) auto/);
});

test('Universal Search mobile remains complete but bounded as an internal result sheet',()=>{
  assert.match(css,/@container \(max-width:460px\)\{[\s\S]*?\.q-us-results\{max-height:min\(58dvh,540px\)/);
  assert.doesNotMatch(css,/\.q-us-results\{[^}]*display:none/);
  assert.doesNotMatch(css,/\.q-us-result\{[^}]*display:none/);
});

test('Search density does not activate dormant V5.3 selectors',()=>{
  assert.doesNotMatch(css,/data-ui-lock-v5-3="active"/);
  assert.doesNotMatch(css,/data-ui-lock-v53="active"/);
});
