import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const route=fs.readFileSync('apps/web/public/assets/routes/decision-provenance.mjs','utf8');
const css=fs.readFileSync('apps/web/public/assets/qelly-v54-decision-provenance.css','utf8');

test('Decision Provenance mobile density preserves the complete evidence and decision contracts',()=>{
  assert.match(route,/function graphMarkup\(/);
  assert.match(route,/Governed relationships/);
  assert.match(route,/Accessible text alternative/);
  assert.match(route,/data-qelly-decision-form/);
  assert.match(route,/function analysisAuditMarkup\(/);
  assert.match(route,/Observed facts/);
  assert.match(route,/Source quality/);
  assert.match(route,/Methodology/);
  assert.match(route,/Execution disabled/);
  assert.match(route,/Human verification required/);
});

test('Decision Provenance uses mobile evidence rails instead of serial card walls',()=>{
  assert.match(css,/@media\(max-width:860px\)[\s\S]*?\.q-decision-provenance-page \.q-decision-evidence-grid\{/);
  assert.match(css,/\.q-decision-provenance-page \.q-decision-evidence-grid\{[\s\S]*?display:flex/);
  assert.match(css,/\.q-decision-provenance-page \.q-decision-evidence-grid\{[\s\S]*?overflow-x:auto/);
  assert.match(css,/\.q-decision-provenance-page \.q-decision-evidence-grid>article\{[\s\S]*?scroll-snap-align:start/);
});

test('Secondary audit panels are bounded mobile evidence sheets without global panel changes',()=>{
  assert.match(css,/\.q-decision-maker-panel~\.q-panel>\.q-panel-body\{[\s\S]*?max-height:min\(58dvh,500px\)/);
  assert.match(css,/\.q-decision-maker-panel~\.q-panel>\.q-panel-body\{[\s\S]*?overflow:auto/);
  assert.match(css,/\.q-decision-maker-panel~\.q-panel \.q-kpi-grid\{[\s\S]*?overflow-x:auto/);
  assert.match(css,/\.q-decision-maker-panel~\.q-panel \.q-kpi\{[\s\S]*?scroll-snap-align:start/);
  assert.doesNotMatch(css,/@media\(max-width:860px\)[\s\S]*?\.q-panel>\.q-panel-body\{[\s\S]{0,120}max-height:min\(58dvh,500px\)/);
});

test('Mobile density does not hide provenance evidence or weaken reduced-motion handling',()=>{
  assert.doesNotMatch(css,/\.q-decision-maker-panel~\.q-panel[^\{]*\{[^}]*display:none/);
  assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
});
