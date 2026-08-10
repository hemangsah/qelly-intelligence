import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const route=fs.readFileSync('apps/web/public/assets/routes/feature-universe.mjs','utf8');
const postmerge=fs.readFileSync('apps/web/public/assets/qelly-post-v53-convergence.css','utf8');

test('Feature Universe count is derived from the mapped route corpus',()=>{
  assert.match(route,/const FEATURE_UNIVERSE_MODULE_COUNT=CLUSTERS\.reduce\(\(total,cluster\)=>total\+cluster\.routes\.length,0\)/);
  assert.match(route,/\$\{FEATURE_UNIVERSE_MODULE_COUNT\}<\/strong><small>mapped modules<\/small>/);
  assert.match(route,/\$\{cluster\.routes\.length\} modules/);
  assert.doesNotMatch(route,/<strong id="q-universe-title">47<\/strong>/);
  assert.doesNotMatch(route,/count:\d+/);
});

test('Feature Universe mobile density is owned by the route renderer and applies at the mobile breakpoint',()=>{
  assert.match(route,/matchMedia\('\(max-width: 768px\)'\)/);
  assert.match(route,/applyFeatureUniverseDensity\(main\)/);
  assert.match(route,/element\.style\.setProperty\(name,value,'important'\)/);
  assert.match(route,/page\.dataset\.mobileDensity=active\?'active':'desktop'/);
  assert.match(route,/document\.documentElement\.dataset\.featureUniverseDensity=active\?'active':'desktop'/);
});

test('Feature Universe renderer explicitly forces horizontal mobile task rails without hiding content',()=>{
  assert.match(route,/\['\.q-universe-journey',\{'display':'flex'/);
  assert.match(route,/\['\.q-universe-route-grid',\{'display':'flex'/);
  assert.match(route,/\['\.q-capability-ribbon \.q-panel-body',\{'display':'flex'/);
  assert.match(route,/'flex':'0 0 min\(72vw,240px\)'/);
  assert.doesNotMatch(route,/display':'none|visibility':'hidden|content-visibility':'hidden|opacity':'0/);
});

test('Feature Universe density retains every mapped destination and capability',()=>{
  assert.doesNotMatch(route,/\.slice\(/);
  assert.doesNotMatch(route,/\.filter\(/);
  assert.match(route,/cluster\.routes\.map\(/);
});

test('Feature Universe does not reactivate dormant V5.3 or retain dead postmerge rules',()=>{
  assert.doesNotMatch(route,/data-ui-lock-v5-3|data-ui-lock-v53/);
  assert.doesNotMatch(postmerge,/\.q-feature-universe/);
  assert.doesNotMatch(route,/feature-universe-density\.css/);
});
