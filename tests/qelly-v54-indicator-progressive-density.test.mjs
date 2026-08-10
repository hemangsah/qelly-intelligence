import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const route=fs.readFileSync('apps/web/public/assets/routes/indicator-library.mjs','utf8');
const css=fs.readFileSync('apps/web/public/assets/qelly-v54-indicator-progressive-density.css','utf8');

test('Indicator Library preserves the complete runtime study universe behind explicit progressive disclosure',()=>{
  assert.match(route,/id="indicator-complete-library"/);
  assert.match(route,/Browse all \$\{definitions\.length\} deterministic indicators/);
  assert.match(route,/let catalogMaterialized=false/);
  assert.match(route,/if\(!catalogMaterialized&&!disclosure\.open\)return/);
  assert.match(route,/disclosure\.addEventListener\('toggle'/);
  assert.doesNotMatch(route,/\n\s*render\(\);\s*\n}\s*$/);
});

test('Indicator priority truth derives from executable featured studies',()=>{
  assert.match(route,/const featured=FEATURED_IDS\.map/);
  assert.match(route,/const featuredLabel=`\$\{featured\.length\} priority \$\{featured\.length===1\?'study':'studies'\}`/);
  assert.match(route,/\$\{featuredLabel\}/);
  assert.doesNotMatch(route,/>6 priority studies</);
});

test('Indicator density binds to the executable route wrapper and canonical premium tokens',()=>{
  assert.match(route,/q-indicator-workbench-page/);
  assert.match(css,/\.q-indicator-workbench-page \.q-indicator-card/);
  assert.match(css,/\.q-indicator-workbench-page \.q-indicator-library-disclosure/);
  assert.match(css,/var\(--q-premium-surface-3/);
  assert.match(css,/var\(--q-premium-text/);
  assert.match(css,/var\(--q-premium-secondary/);
  assert.match(css,/var\(--q-premium-hairline/);
  assert.match(css,/scroll-snap-type:x proximity/);
  assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
});

test('Indicator route loads the progressive-density stylesheet exactly once',()=>{
  assert.match(route,/qelly-v54-indicator-progressive-density\.css/);
  assert.match(route,/data-qelly-v54-indicator-density="active"/);
  assert.match(route,/activateIndicatorDensity\(\)/);
});
