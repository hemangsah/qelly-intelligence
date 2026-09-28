import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=(path)=>readFile(new URL('../'+path,import.meta.url),'utf8');

test('Wave CF Simple Mode exposes setup summary, lifecycle, watch-next, scenario map and R:R ladder',async()=>{
  const route=await read('apps/web/public/assets/routes/decision-proven-graph.mjs');
  for(const token of ['data-dpg-cf-setup','data-dpg-cf-watch','data-dpg-cf-scenarios','data-dpg-cf-rr-ladder','CURRENT SETUP · ONE CLEAN SUMMARY','WHAT SHOULD I WATCH?','SCENARIO MAP · WHAT MUST HAPPEN','R:R VISUAL LADDER','T1 / T2 / T3 / T4'])assert.ok(route.includes(token),token);
  assert.match(route,/buildDecisionScenarioUx/);
  assert.doesNotMatch(route,/\[\['Bull',data\.forecast\.probabilities\.bull\],\['Base',data\.forecast\.probabilities\.base\],\['Bear',data\.forecast\.probabilities\.bear\]\]/);
});

test('Wave CF R:R ladder is interactive through existing Decision reload path',async()=>{
  const route=await read('apps/web/public/assets/routes/decision-proven-graph.mjs');
  for(const value of ['auto','1','2','3','4','custom'])assert.ok(route.includes("data-dpg-cf-rr=\"'+escapeHtml(item.id)+'\"")||route.includes('data-dpg-cf-rr'));
  assert.match(route,/main\.querySelectorAll\('\[data-dpg-cf-rr\]'\)/);
  assert.match(route,/data-dpg-cf-custom-rr/);
  assert.match(route,/state\.rr=value;state\.scan=null;state\.scanError=null;scheduleLoad\(\)/);
});

test('Wave CF styles preserve text-plus-icon lifecycle and responsive scenario hierarchy',async()=>{
  const css=await read('apps/web/public/assets/qelly-decision-proven-graph.css');
  for(const token of ['q-dpg-cf-lifecycle','q-dpg-cf-scenario','q-dpg-cf-watch','q-dpg-cf-rr-card','is-current'])assert.ok(css.includes(token),token);
  assert.match(css,/@media\(max-width:480px\)/);
});
