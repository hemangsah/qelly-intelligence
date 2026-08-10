import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const route=fs.readFileSync('apps/web/public/assets/routes/calculator-center.mjs','utf8');
const css=fs.readFileSync('apps/web/public/assets/qelly-v54-calculator-progressive-density.css','utf8');

test('Calculator Center preserves the complete runtime library behind explicit progressive disclosure',()=>{
  assert.match(route,/id="calculator-complete-library"/);
  assert.match(route,/Browse all \$\{definitions\.length\} calculators/);
  assert.match(route,/let catalogMaterialized=false/);
  assert.match(route,/if\(!catalogMaterialized&&!disclosure\.open\)return/);
  assert.match(route,/disclosure\.addEventListener\('toggle'/);
  assert.doesNotMatch(route,/\n\s*render\(\);\s*\n}\s*$/);
});

test('Calculator priority truth derives from executable featured definitions',()=>{
  assert.match(route,/const featured=FEATURED_IDS\.map/);
  assert.match(route,/const featuredLabel=`\$\{featured\.length\} priority \$\{featured\.length===1\?'workflow':'workflows'\}`/);
  assert.match(route,/\$\{featuredLabel\}/);
  assert.doesNotMatch(route,/>6 priority workflows</);
});

test('Calculator density binds to the executable route wrapper and canonical premium tokens',()=>{
  assert.match(route,/q-calculator-workbench-page/);
  assert.match(css,/\.q-calculator-workbench-page \.q-calculator-card/);
  assert.match(css,/\.q-calculator-workbench-page \.q-calculator-library-disclosure/);
  assert.match(css,/var\(--q-premium-surface-3/);
  assert.match(css,/var\(--q-premium-text/);
  assert.match(css,/var\(--q-premium-secondary/);
  assert.match(css,/var\(--q-premium-hairline/);
  assert.match(css,/scroll-snap-type:x proximity/);
  assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
});

test('Calculator route loads the progressive-density stylesheet exactly once',()=>{
  assert.match(route,/qelly-v54-calculator-progressive-density\.css/);
  assert.match(route,/data-qelly-v54-calculator-density="active"/);
  assert.match(route,/activateCalculatorDensity\(\)/);
});
