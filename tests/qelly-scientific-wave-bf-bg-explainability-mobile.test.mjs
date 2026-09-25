import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=(path)=>readFile(new URL('../'+path,import.meta.url),'utf8');

test('Waves BF/BG primary Decision summary surfaces the user-facing research essentials',async()=>{
  const route=await read('apps/web/public/assets/routes/decision-proven-graph.mjs');
  for(const phrase of [
    'Primary Decision research summary',
    'Strongest evidence',
    'Strongest contradiction',
    'Entry',
    'Invalidation',
    'Selected target / R:R',
    'Event risk',
    'What changes the view:'
  ])assert.ok(route.includes(phrase),phrase);
  const fnStart=route.indexOf('const primaryResearchSummary=');
  const fnEnd=route.indexOf('const secondaryResearchDiagnosticsMarkup=',fnStart);
  const block=route.slice(fnStart,fnEnd);
  assert.doesNotMatch(block,/QELLY VIEW/);
  assert.match(block,/contradictionAnalysis/);
  assert.match(block,/tradeResearch/);
});

test('Wave BF keeps confidence diagnostics and calibration/analogs/health secondary and collapsed by default',async()=>{
  const route=await read('apps/web/public/assets/routes/decision-proven-graph.mjs');
  assert.match(route,/<details class="q-dpg-confidence-audit"><summary>Evidence confidence diagnostics<\/summary>/);
  assert.match(route,/<details class="q-dpg-secondary-research"><summary>Calibration, analogs & model health<\/summary>/);
  assert.doesNotMatch(route,/<details class="q-dpg-confidence-audit"[^>]*\sopen/);
  assert.doesNotMatch(route,/<details class="q-dpg-secondary-research"[^>]*\sopen/);
  const secondaryStart=route.indexOf('const secondaryResearchDiagnosticsMarkup=');
  const secondaryEnd=route.indexOf('const historicalAnalogsMarkup=',secondaryStart);
  const secondary=route.slice(secondaryStart,secondaryEnd);
  assert.match(secondary,/probabilityCalibrationMarkup\(data,escapeHtml\)/);
  assert.match(secondary,/historicalAnalogsMarkup\(data,escapeHtml\)/);
  assert.match(secondary,/healthQualityMarkup\(data,escapeHtml\)/);
});

test('Wave BF orders primary research summary before detailed confidence diagnostics inside QELLY VIEW',async()=>{
  const route=await read('apps/web/public/assets/routes/decision-proven-graph.mjs');
  const contentStart=route.indexOf('const content=(data)=>');
  const contentEnd=route.indexOf('const draw=',contentStart);
  const content=route.slice(contentStart,contentEnd);
  const viewStart=content.indexOf('q-dpg-view q-dpg-view--');
  const summaryIndex=content.indexOf('primaryResearchSummary(data,escapeHtml)',viewStart);
  const auditIndex=content.indexOf('calibration(view,escapeHtml)',viewStart);
  assert.ok(viewStart>=0&&summaryIndex>viewStart&&auditIndex>summaryIndex);
});

test('Wave BF hero names evidence confidence honestly rather than implying empirical calibration',async()=>{
  const route=await read('apps/web/public/assets/routes/decision-proven-graph.mjs');
  assert.match(route,/<em>Evidence confidence<\/em>/);
  assert.doesNotMatch(route,/<em>Calibrated confidence<\/em>/);
  assert.match(route,/Evidence confidence diagnostics/);
});

test('Wave BG mobile hierarchy collapses primary cards to one column and prevents QELLY VIEW overflow',async()=>{
  const css=await read('apps/web/public/assets/qelly-decision-proven-graph.css');
  assert.match(css,/\.q-dpg-primary-summary\{[^}]*grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/s);
  assert.match(css,/@media\(max-width:760px\)\{[^}]*\.q-dpg-primary-summary\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/s);
  assert.match(css,/@media\(max-width:520px\)\{[^}]*\.q-dpg-primary-summary\{grid-template-columns:1fr\}/s);
  assert.match(css,/\.q-dpg-view\{min-width:0\}/);
  assert.match(css,/\.q-dpg-view>\*\{min-width:0\}/);
  assert.match(css,/overflow-wrap:anywhere/);
});

test('Waves BF/BG place deep research diagnostics near methodology rather than before the primary view',async()=>{
  const route=await read('apps/web/public/assets/routes/decision-proven-graph.mjs');
  const contentStart=route.indexOf('const content=(data)=>');
  const contentEnd=route.indexOf('const draw=',contentStart);
  const content=route.slice(contentStart,contentEnd);
  const qellyView=content.indexOf("'<section class=\"q-dpg-view");
  const secondary=content.indexOf('secondaryResearchDiagnosticsMarkup(data,escapeHtml)');
  const methodology=content.indexOf('qelly-decision-methodology');
  assert.ok(qellyView>=0&&secondary>qellyView&&methodology>secondary);
});

test('Wave BG preserves responsive scanner and research surfaces without desktop-table dependency',async()=>{
  const css=await read('apps/web/public/assets/qelly-decision-proven-graph.css');
  assert.match(css,/@media\(max-width:540px\).*q-dpg-scan-row/s);
  assert.match(css,/@media\(max-width:520px\).*q-dpg-primary-summary/s);
  assert.match(css,/@media\(max-width:520px\).*q-dpg-confidence-audit>.q-dpg-calibration\{grid-template-columns:1fr\}/s);
  assert.doesNotMatch(css,/\.q-dpg-primary-summary[^\n]*overflow-x:\s*auto/);
});
