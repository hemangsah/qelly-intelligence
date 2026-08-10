import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const route=fs.readFileSync('apps/web/public/assets/routes/feature-universe.mjs','utf8');
const css=fs.readFileSync('apps/web/public/assets/feature-universe-density.css','utf8');
const postmerge=fs.readFileSync('apps/web/public/assets/qelly-post-v53-convergence.css','utf8');

test('Feature Universe count is derived from the mapped route corpus',()=>{
  assert.match(route,/const FEATURE_UNIVERSE_MODULE_COUNT=CLUSTERS\.reduce\(\(total,cluster\)=>total\+cluster\.routes\.length,0\)/);
  assert.match(route,/\$\{FEATURE_UNIVERSE_MODULE_COUNT\}<\/strong><small>mapped modules<\/small>/);
  assert.match(route,/\$\{cluster\.routes\.length\} modules/);
  assert.doesNotMatch(route,/<strong id="q-universe-title">47<\/strong>/);
  assert.doesNotMatch(route,/count:\d+/);
});

test('Feature Universe renderer explicitly loads and awaits its route-owned stylesheet',()=>{
  assert.match(route,/new URL\('\.\.\/feature-universe-density\.css',import\.meta\.url\)/);
  assert.match(route,/link\.dataset\.qellyFeatureUniverseDensity='active'/);
  assert.match(route,/export async function renderFeatureUniverse\(main,deps\)\{\s*await ensureFeatureUniverseStyles\(\)/);
  assert.match(route,/root\.dataset\.featureUniverseDensity=state/);
});

test('Feature Universe mobile module corpus uses route-owned horizontal rails',()=>{
  assert.match(css,/@media\(max-width:768px\)/);
  assert.match(css,/\.q-feature-universe \.q-universe-journey\{display:flex;gap:7px;overflow-x:auto;overscroll-behavior-inline:contain;scroll-snap-type:x proximity;scrollbar-width:none/);
  assert.match(css,/\.q-feature-universe \.q-universe-route-grid\{display:flex;gap:7px;overflow-x:auto;overscroll-behavior-inline:contain;scroll-snap-type:x proximity;scrollbar-width:none/);
  assert.match(css,/\.q-feature-universe \.q-universe-route-grid button\{flex:0 0 min\(72vw,240px\);min-height:72px/);
});

test('Feature Universe density retains every mapped destination and capability',()=>{
  assert.doesNotMatch(route,/\.slice\(/);
  assert.doesNotMatch(route,/\.filter\(/);
  assert.match(route,/cluster\.routes\.map\(/);
  assert.doesNotMatch(css,/display:none|visibility:hidden|content-visibility:hidden|opacity:0/);
});

test('Feature Universe route CSS stays isolated from dormant V5.3 activation and removes dead postmerge rules',()=>{
  assert.doesNotMatch(css,/data-ui-lock-v5-3|data-ui-lock-v53|data-v53-route/);
  assert.doesNotMatch(postmerge,/\.q-feature-universe/);
});
