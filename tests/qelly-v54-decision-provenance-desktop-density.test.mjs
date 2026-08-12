import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const css=fs.readFileSync('apps/web/public/assets/qelly-v54-decision-provenance.css','utf8');
const owner='html\\[data-v53-postmerge-convergence="wave1"\\]\\[data-v53-route="decision-provenance"\\] #main ';

test('Decision Provenance Wave 4 desktop uses a compact 7/5 workstation for secondary evidence',()=>{
  assert.match(css,new RegExp(`@media\\(min-width:1181px\\)[\\s\\S]*${owner}\\.q-decision-provenance-page>\\.q-decision-maker-panel\\{grid-column:1\\/span 7;align-self:start\\}`));
  assert.match(css,new RegExp(`${owner}\\.q-decision-provenance-page>\\.q-decision-maker-panel\\+\\.q-panel\\{grid-column:8\\/-1;align-self:start\\}`));
  assert.match(css,new RegExp(`${owner}\\.q-decision-provenance-page>\\.q-decision-maker-panel\\+\\.q-panel\\+\\.q-panel\\{grid-column:1\\/span 7;align-self:start\\}`));
  assert.match(css,new RegExp(`${owner}\\.q-decision-provenance-page>\\.q-decision-maker-panel\\+\\.q-panel\\+\\.q-panel\\+\\.q-panel\\{grid-column:8\\/-1;align-self:start\\}`));
  assert.match(css,new RegExp(`${owner}\\.q-decision-provenance-page>\\.q-panel\\+\\.q-panel\\{margin-top:0\\}`));
});

test('Decision Provenance Wave 4 bounds desktop secondary audits without hiding evidence',()=>{
  assert.match(css,new RegExp(`${owner}\\.q-decision-graph-stack>\\.q-panel:not\\(\\.q-provenance-explorer\\)>\\.q-panel-body\\{max-height:min\\(34vh,320px\\);overflow:auto`));
  assert.match(css,new RegExp(`${owner}\\.q-decision-provenance-page>\\.q-decision-maker-panel>\\.q-panel-body,[\\s\\S]*?max-height:min\\(72vh,760px\\);overflow:auto`));
  assert.match(css,new RegExp(`${owner}\\.q-decision-provenance-page>\\.q-decision-maker-panel\\+\\.q-panel\\+\\.q-panel>\\.q-panel-body,[\\s\\S]*?max-height:min\\(48vh,520px\\);overflow:auto`));
  assert.doesNotMatch(css,/\.q-decision-provenance-page[^\{]*\{[^}]*display:none/);
  assert.doesNotMatch(css,/\.q-decision-maker-panel[^\{]*\{[^}]*display:none/);
});

test('Decision Provenance mid-width layout preserves full decision and analysis rows',()=>{
  assert.match(css,new RegExp(`@media\\(min-width:861px\\) and \\(max-width:1180px\\)[\\s\\S]*${owner}\\.q-decision-provenance-page>\\.q-decision-maker-panel,[\\s\\S]*?grid-column:1\\/-1`));
  assert.match(css,new RegExp(`${owner}\\.q-decision-provenance-page>\\.q-decision-maker-panel\\+\\.q-panel\\+\\.q-panel,[\\s\\S]*?grid-column:span 6`));
});

test('Desktop workstation override remains route-owned and does not activate dormant legacy V5.3 layers',()=>{
  assert.doesNotMatch(css,/(?:^|\n)\s*\.q-panel\{[^}]*grid-column/);
  assert.doesNotMatch(css,/data-ui-lock-v5-3="active"/);
  assert.doesNotMatch(css,/data-ui-lock-v53="active"/);
});

test('Accepted mobile evidence topology remains owned below 860px',()=>{
  assert.match(css,/@media\(max-width:860px\)[\s\S]*?\.q-decision-provenance-page \.q-decision-evidence-grid\{[^}]*display:flex/);
  assert.match(css,/\.q-decision-provenance-page \.q-decision-maker-panel~\.q-panel>\.q-panel-body\{[^}]*max-height:min\(58dvh,500px\)/);
  assert.match(css,/\.q-provenance-context-ribbon\{[^}]*position:sticky/);
});
