import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {buildRuntimeDeadCodeAudit} from '../scripts/runtime-dead-code-audit.mjs';

const read=(path)=>readFile(new URL('../'+path,import.meta.url),'utf8');

test('Wave CK removes only proven-dead pre-reinvention Decision CSS',async()=>{
  const [css,route]=await Promise.all([
    read('apps/web/public/assets/qelly-decision-proven-graph.css'),
    read('apps/web/public/assets/routes/decision-proven-graph.mjs')
  ]);
  const retired=[
    'q-dpg-timeframe',
    'q-dpg-scenarios',
    'q-dpg-selection-actions',
    'q-dpg-status-icon'
  ];
  for(const token of retired){
    assert.equal(route.includes(token),false,token+' unexpectedly has a live Decision markup reference');
    assert.equal(css.includes(token),false,token+' legacy CSS should be removed');
  }
  for(const token of [
    'q-dpg-range-workbench',
    'data-dpg-asset-picker-toggle',
    'data-dpg-mode-panel'
  ])assert.ok(route.includes(token),token);
  assert.equal(route.includes('q-dpg-chat-dock'),false,'Decision-local chat dock must remain retired');
  assert.equal(css.includes('q-dpg-chat-dock'),false,'Decision-local chat dock CSS must remain retired');
});

test('Wave CK proves old chat and flat-picker presentation are retired while compatibility stays intentional',async()=>{
  const route=await read('apps/web/public/assets/routes/decision-proven-graph.mjs');
  assert.doesNotMatch(route,/q-dpg-hero__actions[^\n]*data-dpg-open-chat/);
  assert.doesNotMatch(route,/q-dpg-range-toolbar[^\n]*data-dpg-open-chat/);
  assert.doesNotMatch(route,/select\('asset'/);
  assert.doesNotMatch(route,/q-dpg-chat-dock|data-dpg-open-chat|data-dpg-chat-quick/);
  assert.match(route,/qelly:chat-context/);
  assert.match(route,/data-dpg-asset-picker-toggle/);
});

test('Wave CK retains the historical Decision route as a compatibility alias, not dead code',async()=>{
  const alias=await read('apps/web/public/assets/routes/decision-provenance.mjs');
  assert.match(alias,/import \{renderDecisionProvenGraph\} from '\.\/decision-proven-graph\.mjs'/);
  assert.match(alias,/Compatibility route: historical #\/decision-provenance links now resolve/);
  assert.match(alias,/return renderDecisionProvenGraph\(main,deps\)/);
});

test('Wave CK keeps proof-first dead-code classification discipline',async()=>{
  const report=await buildRuntimeDeadCodeAudit();
  assert.equal(report.schemaVersion,2);
  assert.match(report.deletionRule,/Only DEAD items with zero executable references are deletion candidates/);
  assert.deepEqual(report.taxonomy,['ACTIVE','COMPATIBILITY','GENERATED','TEST','DEPRECATED','DEAD']);
});
