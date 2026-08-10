import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const css=fs.readFileSync('apps/web/public/assets/qelly-v54-decision-provenance.css','utf8');

test('Decision Provenance desktop audit panels use route-owned independent rows',()=>{
  const owner='html\\[data-v53-postmerge-convergence="wave1"\\]\\[data-v53-route="decision-provenance"\\] #main ';
  assert.match(css,new RegExp(`@media\\(min-width:861px\\)[\\s\\S]*${owner}\\.q-decision-provenance-page>\\.q-decision-maker-panel\\{grid-column:1\\/-1;align-self:start\\}`));
  assert.match(css,new RegExp(`${owner}\\.q-decision-provenance-page>\\.q-decision-maker-panel\\+\\.q-panel\\{grid-column:1\\/-1;align-self:start\\}`));
  assert.match(css,new RegExp(`${owner}\\.q-decision-provenance-page>\\.q-decision-maker-panel\\+\\.q-panel\\+\\.q-panel,[\\s\\S]*?grid-column:span 6;align-self:start`));
  assert.match(css,new RegExp(`${owner}\\.q-decision-provenance-page>\\.q-panel\\+\\.q-panel\\{margin-top:0\\}`));
});

test('Desktop density override does not create global panel or legacy activation rules',()=>{
  assert.doesNotMatch(css,/(?:^|\n)\s*\.q-panel\{[^}]*grid-column/);
  assert.doesNotMatch(css,/data-ui-lock-v5-3="active"/);
  assert.doesNotMatch(css,/data-ui-lock-v53="active"/);
});

test('Accepted mobile evidence topology remains owned below 860px',()=>{
  assert.match(css,/@media\(max-width:860px\)[\s\S]*?\.q-decision-provenance-page \.q-decision-evidence-grid\{[^}]*display:flex/);
  assert.match(css,/\.q-decision-provenance-page \.q-decision-maker-panel~\.q-panel>\.q-panel-body\{[^}]*max-height:min\(58dvh,500px\)/);
});
