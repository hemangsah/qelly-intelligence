import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=(path)=>readFile(new URL('../'+path,import.meta.url),'utf8');

test('Wave BV makes Simple the default and exposes three explicit research-depth modes',async()=>{
  const route=await read('apps/web/public/assets/routes/decision-proven-graph.mjs');
  assert.match(route,/uiMode:'simple'/);
  for(const phrase of ['Simple','Advanced','Research Lab','Answer · setup · chart','Evidence · structure · scenarios','Models · calibration · provenance'])assert.ok(route.includes(phrase),phrase);
  assert.match(route,/data-dpg-ui-mode/);
  assert.match(route,/role="tablist"/);
});

test('Wave BV keeps Simple Mode focused while preserving deeper modules in Advanced and Research Lab',async()=>{
  const route=await read('apps/web/public/assets/routes/decision-proven-graph.mjs');
  const content=route.slice(route.indexOf('const content=(data)'),route.indexOf('const draw=',route.indexOf('const content=(data)')));
  const simple=content.slice(0,content.indexOf("if(state.uiMode==='simple')"));
  const advanced=route.slice(route.indexOf('const advancedDecisionContent'),route.indexOf('const content=(data)'));
  const research=content.slice(content.indexOf("const research='"));
  for(const token of ['QELLY VIEW','q-dpg-stage','rangeEvidenceMarkup','Show Advanced Research'])assert.ok(simple.includes(token),token);
  for(const token of ['tradeResearchMarkup','marketStructureContext','liquidityContext','derivativesContext','macroContext','newsResearchContext','contradictionMarkup'])assert.ok(advanced.includes(token),token);
  for(const token of ['outcomeLedgerMarkup','decisionTraceMarkup','secondaryResearchDiagnosticsMarkup','sloDiagnosticsMarkup','Methodology and sources'])assert.ok(research.includes(token),token);
  assert.ok(!simple.includes('decisionTraceMarkup'));
  assert.ok(!simple.includes('outcomeLedgerMarkup'));
});

test('Wave BV hides scanner filter density in Simple Mode without weakening Find Trade Now',async()=>{
  const route=await read('apps/web/public/assets/routes/decision-proven-graph.mjs');
  assert.match(route,/state\.uiMode==='simple'\?'':scannerFiltersMarkup/);
  assert.match(route,/data-dpg-scan/);
});

test('Wave BV Browser E2E verifies default, advanced and research modes on desktop/mobile',async()=>{
  const e2e=await read('scripts/qelly-decision-range-selection-e2e.mjs');
  for(const token of ['decision-mode-default','decision-mode-advanced','decision-mode-research','data-dpg-ui-mode="simple"','data-dpg-ui-mode="advanced"','data-dpg-ui-mode="research"'])assert.ok(e2e.includes(token),token);
});

test('Wave BV mode controls are responsive and reduced-motion safe',async()=>{
  const css=await read('apps/web/public/assets/qelly-decision-proven-graph.css');
  for(const token of ['.q-dpg-mode-switcher','.q-dpg-ui-mode','.q-dpg-mode-panel__header','.q-dpg-simple-next','@media(max-width:760px)','@media(prefers-reduced-motion:reduce)'])assert.ok(css.includes(token),token);
});
