import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=(path)=>readFile(new URL('../'+path,import.meta.url),'utf8');

test('Wave BP Browser E2E owns repeated Decision control chaos coverage',async()=>{
  const source=await read('scripts/qelly-first-paint-stability.mjs');
  for(const contract of [
    'runDecisionChaosStabilityProbe',
    "page.selectOption('[data-dpg-asset]'",
    "page.selectOption('[data-dpg-interval]'",
    "page.selectOption('[data-dpg-rr]'",
    "[data-dpg-scan]",
    "page.reload({waitUntil:'domcontentloaded'",
    "await page.waitForTimeout(2200)",
    "decisionChaosStability"
  ])assert.ok(source.includes(contract),contract);
  assert.match(source,/for\(let cycle=1;cycle<=6;cycle\+=1\)/);
  assert.match(source,/requestCounts\.decision<18/);
  assert.match(source,/requestCounts\.scanner<6/);
  assert.match(source,/refreshes<3/);
});

test('Wave BP monitors forced-GC heap, DOM, listeners, timers, iframes, network and console',async()=>{
  const source=await read('scripts/qelly-first-paint-stability.mjs');
  for(const contract of [
    'HeapProfiler.collectGarbage',
    'JSHeapUsedSize',
    'JSEventListeners',
    "document.getElementsByTagName('*').length",
    "document.querySelectorAll('iframe').length",
    '__QELLY_CHAOS_TIMERS__',
    'unexpectedNetwork',
    "page.on('pageerror'",
    "message.type()!=='error'"
  ])assert.ok(source.includes(contract),contract);
  for(const failure of ['js_heap','dom_nodes','event_listeners','documents','timers','iframes','duplicate_shell','unexpected_first_party_network'])assert.ok(source.includes(failure),failure);
});

test('Wave BP chaos probe uses deterministic degraded API responses and never injects market evidence',async()=>{
  const source=await read('scripts/qelly-first-paint-stability.mjs');
  assert.match(source,/bp_injected_dependency_unavailable/);
  assert.match(source,/status:503/);
  assert.match(source,/without external-provider variance or fake market evidence/);
  assert.doesNotMatch(source,/status:200,contentType:'application\/json',body:injectedBody/);
});

test('Wave BP unavailable chaos instrumentation fails the Browser E2E release gate',async()=>{
  const source=await read('scripts/qelly-first-paint-stability.mjs');
  assert.match(source,/if\(report\.decisionChaosStability\.status!=='passed'\)report\.status='failed'/);
  assert.match(source,/status:'unavailable'/);
  assert.match(source,/failures:\['probe_unavailable'\]/);
});


test('Wave BP Decision controls defer redraw until the native change event settles',async()=>{
  const route=await read('apps/web/public/assets/routes/decision-proven-graph.mjs');
  assert.match(route,/const scheduleLoad=\(\)=>setTimeout\(\(\)=>load\(\),0\)/);
  assert.match(route,/state\.draft=null;state\.selection=null;scheduleLoad\(\)/);
  assert.match(route,/feature:'risk_reward',action:'select',state:rrTelemetryState\(state\.rr\)\}\);\s*scheduleLoad\(\)/);
  assert.match(route,/state\.customRr=event\.currentTarget\.value;state\.scan=null;state\.scanError=null;scheduleLoad\(\)/);
});
