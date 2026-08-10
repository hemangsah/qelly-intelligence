import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const route=fs.readFileSync('apps/web/public/assets/routes/formula-library.mjs','utf8');
const css=fs.readFileSync('apps/web/public/assets/qelly-v54-formula-progressive-density.css','utf8');

test('Formula library preserves the complete method universe behind explicit progressive disclosure',()=>{
  assert.match(route,/id="formula-complete-library"/);
  assert.match(route,/Browse all \$\{formulas\.length\} quantitative methods/);
  assert.match(route,/let catalogMaterialized=false/);
  assert.match(route,/if\(!catalogMaterialized&&!disclosure\.open\)return/);
  assert.match(route,/disclosure\.addEventListener\('toggle'/);
  assert.doesNotMatch(route,/\n\s*render\(\);\s*\n}\s*$/);
});

test('Formula density layer is route-scoped, mobile task-oriented and reduced-motion safe',()=>{
  assert.match(css,/data-v53-route="formula-library"/);
  assert.match(css,/scroll-snap-type:x proximity/);
  assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
  assert.match(css,/\.q-formula-library-disclosure/);
});

test('Formula route loads the progressive-density stylesheet exactly once',()=>{
  assert.match(route,/qelly-v54-formula-progressive-density\.css/);
  assert.match(route,/data-qelly-v54-formula-density="active"/);
  assert.match(route,/activateFormulaDensity\(\)/);
});
