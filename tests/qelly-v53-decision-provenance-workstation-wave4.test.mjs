import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const route=fs.readFileSync('apps/web/public/assets/routes/decision-provenance.mjs','utf8');
const css=fs.readFileSync('apps/web/public/assets/qelly-v54-decision-provenance.css','utf8');

test('Decision Provenance Wave 4 preserves governed traversal and decision semantics',()=>{
  for(const contract of [
    'role="tab"',
    'data-provenance-node',
    'data-provenance-related-node',
    'aria-controls="q-provenance-focus"',
    'Governed relationships',
    'Accessible text alternative',
    'data-qelly-decision-form',
    'Execution disabled',
    'Human verification required',
    'considered-not-executed'
  ]) assert.ok(route.includes(contract),`missing provenance contract: ${contract}`);
});

test('Decision Provenance Wave 4 is presentation-only and keeps all secondary evidence reachable',()=>{
  assert.match(css,/\.q-decision-graph-stack>\.q-panel:not\(\.q-provenance-explorer\)>\.q-panel-body\{[^}]*overflow:auto/);
  assert.match(css,/\.q-decision-provenance-page>\.q-decision-maker-panel>\.q-panel-body,[\s\S]*?overflow:auto/);
  assert.match(css,/\.q-decision-provenance-page>\.q-decision-maker-panel\+\.q-panel\+\.q-panel>\.q-panel-body,[\s\S]*?overflow:auto/);
  assert.doesNotMatch(css,/\.q-decision-provenance-page[^\{]*\{[^}]*display:none/);
  assert.doesNotMatch(css,/\.q-decision-graph-stack[^\{]*\{[^}]*display:none/);
});

test('Decision Provenance Wave 4 preserves mobile traversal rails and selected context',()=>{
  assert.match(css,/@media\(max-width:860px\)[\s\S]*?\.q-provenance-node-list\{[^}]*overflow-x:auto/);
  assert.match(css,/\.q-provenance-node\{[^}]*scroll-snap-align:start/);
  assert.match(css,/\.q-provenance-context-ribbon\{[^}]*position:sticky/);
  assert.match(css,/\.q-provenance-relation-list\{grid-template-columns:1fr\}/);
  assert.match(css,/\.q-decision-evidence-grid>article\{[^}]*scroll-snap-align:start/);
});

test('Decision Provenance Wave 4 does not globally activate dormant V5.3 CSS',()=>{
  assert.doesNotMatch(css,/data-ui-lock-v5-3="active"/);
  assert.doesNotMatch(route,/data-ui-lock-v5-3/);
});
