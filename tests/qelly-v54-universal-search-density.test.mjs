import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const css=fs.readFileSync('apps/web/public/assets/qelly-post-v53-convergence.css','utf8');
const app=fs.readFileSync('apps/web/public/assets/app.js','utf8');

const owner='html[data-v53-postmerge-convergence="wave1"][data-v53-route="search"] #main';

test('Universal Search keeps the full deterministic result corpus in the rendered surface',()=>{
  assert.match(app,/\/api\/v1\/search\?q=.*&limit=50/);
  assert.match(app,/results\.innerHTML=data\.items\.length\?data\.items\.map\(/);
  assert.doesNotMatch(app,/data\.items\.slice\(/);
});

test('Universal Search desktop results are bounded by the executable route owner',()=>{
  assert.ok(css.includes(`${owner} .q-search-layout{grid-template-columns:minmax(0,1fr) minmax(260px,320px);gap:8px;align-items:start}`));
  assert.ok(css.includes(`${owner} .q-search-results{max-height:min(68dvh,720px);overflow:auto;overscroll-behavior:contain;scrollbar-gutter:stable`));
  assert.ok(css.includes(`${owner} .q-search-result{grid-template-columns:36px minmax(0,1fr) auto;gap:9px;padding:8px;border-radius:8px}`));
});

test('Universal Search mobile remains complete but bounded as an internal result sheet',()=>{
  assert.match(css,/@media\(max-width:768px\)[\s\S]*?data-v53-route="search"[^\n]*\.q-search-results\{max-height:min\(58dvh,520px\);overflow:auto;overscroll-behavior:contain;scrollbar-gutter:stable\}/);
  assert.doesNotMatch(css,/data-v53-route="search"[^\n]*\.q-search-results\{[^}]*display:none/);
  assert.doesNotMatch(css,/data-v53-route="search"[^\n]*\.q-search-result\{[^}]*display:none/);
});

test('Search density does not activate dormant V5.3 selectors',()=>{
  assert.doesNotMatch(css,/data-ui-lock-v5-3="active"/);
  assert.doesNotMatch(css,/data-ui-lock-v53="active"/);
});
