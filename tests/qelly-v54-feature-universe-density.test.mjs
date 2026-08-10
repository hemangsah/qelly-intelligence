import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const route=fs.readFileSync('apps/web/public/assets/routes/feature-universe.mjs','utf8');
const css=fs.readFileSync('apps/web/public/assets/qelly-post-v53-convergence.css','utf8');
const owner='html[data-v53-postmerge-convergence="wave1"][data-v53-route="feature-universe"] #main';

test('Feature Universe count is derived from the mapped route corpus',()=>{
  assert.match(route,/const FEATURE_UNIVERSE_MODULE_COUNT=CLUSTERS\.reduce\(\(total,cluster\)=>total\+cluster\.routes\.length,0\)/);
  assert.match(route,/\$\{FEATURE_UNIVERSE_MODULE_COUNT\}<\/strong><small>mapped modules<\/small>/);
  assert.match(route,/\$\{cluster\.routes\.length\} modules/);
  assert.doesNotMatch(route,/<strong id="q-universe-title">47<\/strong>/);
  assert.doesNotMatch(route,/count:\d+/);
});

test('Feature Universe mobile module corpus uses route-owned horizontal rails',()=>{
  assert.ok(css.includes(`${owner} .q-universe-journey{display:flex;gap:7px;overflow-x:auto;overscroll-behavior-inline:contain;scroll-snap-type:x proximity;scrollbar-width:none`));
  assert.ok(css.includes(`${owner} .q-universe-route-grid{display:flex;gap:7px;overflow-x:auto;overscroll-behavior-inline:contain;scroll-snap-type:x proximity;scrollbar-width:none`));
  assert.ok(css.includes(`${owner} .q-universe-route-grid button{flex:0 0 min(72vw,240px);min-height:72px`));
});

test('Feature Universe density retains every mapped destination and capability',()=>{
  assert.doesNotMatch(route,/\.slice\(/);
  assert.doesNotMatch(route,/\.filter\(/);
  assert.match(route,/cluster\.routes\.map\(/);
  const featureRules=css.split('\n').filter(line=>line.includes('data-v53-route="feature-universe"')&&!line.includes('::before')&&!line.includes('::after')).join('\n');
  assert.doesNotMatch(featureRules,/display:none|visibility:hidden|content-visibility:hidden|opacity:0/);
});

test('Feature Universe density does not activate dormant V5.3 selectors',()=>{
  assert.doesNotMatch(css,/data-ui-lock-v5-3="active"/);
  assert.doesNotMatch(css,/data-ui-lock-v53="active"/);
});
