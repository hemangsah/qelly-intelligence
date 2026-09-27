import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=(path)=>readFile(new URL('../'+path,import.meta.url),'utf8');

test('range explanation uses one bounded evidence request and does not refetch the full Decision endpoint',async()=>{
  const route=await read('apps/web/public/assets/routes/decision-proven-graph.mjs');
  const start=route.indexOf('const commitRangeSelection=async');
  const end=route.indexOf("main.querySelectorAll('[data-dpg-asset]",start);
  const block=route.slice(start,end);
  assert.match(block,/loadExactRangeEvidence\(state\.selection\)/);
  assert.doesNotMatch(block,/await load\(\)/);
  assert.match(block,/if\(!state\.draft\|\|!state\.data\)return false/);
});

test('range evidence failure is rendered inline while preserving the current Decision snapshot',async()=>{
  const route=await read('apps/web/public/assets/routes/decision-proven-graph.mjs');
  assert.match(route,/data-dpg-range-evidence-error/);
  assert.match(route,/CURRENT DECISION PRESERVED/);
  assert.match(route,/QELLY did not discard or replace the current Decision snapshot/);
  const loaderStart=route.indexOf('async function loadExactRangeEvidence');
  const loaderEnd=route.indexOf('const wire=',loaderStart);
  const loader=route.slice(loaderStart,loaderEnd);
  assert.doesNotMatch(loader,/state\.data=null/);
  assert.match(loader,/state\.rangeEvidenceError/);
});

test('browser acceptance forbids selected Decision reload and injects a range endpoint failure',async()=>{
  const script=await read('scripts/qelly-decision-range-selection-e2e.mjs');
  assert.match(script,/selected_decision_reload_forbidden/);
  assert.match(script,/selectedDecisionReloads!==0/);
  assert.match(script,/exerciseRangeFailure/);
  assert.match(script,/data-dpg-range-evidence-error/);
  assert.match(script,/live research unavailable/);
  assert.match(script,/overlayPersistent/);
});
