import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=(path)=>readFile(new URL('../'+path,import.meta.url),'utf8');

test('Wave BP exact Browser E2E gate executes one mandatory Decision chaos probe',async()=>{
  const source=await read('scripts/qelly-first-paint-stability.mjs');
  const calls=source.match(/report\.decisionChaosStability=await runDecisionChaosStabilityProbe\(browser\)/g)||[];
  assert.equal(calls.length,1);
  assert.match(source,/if\(report\.decisionChaosStability\.status!=='passed'\)report\.status='failed'/);
});

test('Wave BP covers all requested R:R modes and repeated Decision/scanner activity',async()=>{
  const source=await read('scripts/qelly-first-paint-stability.mjs');
  assert.match(source,/const rrValues=\['1','2','3','4','custom','auto'\]/);
  assert.match(source,/for\(let cycle=1;cycle<=6;cycle\+=1\)/);
  assert.match(source,/requestCounts\.decision<18/);
  assert.match(source,/requestCounts\.scanner<6/);
  assert.match(source,/refreshes<3/);
  assert.match(source,/idleResumed/);
});

test('Wave BP measures heap DOM listeners timers iframes network and console',async()=>{
  const source=await read('scripts/qelly-first-paint-stability.mjs');
  for(const token of ['JSHeapUsedSize','JSEventListeners','__QELLY_CHAOS_TIMERS__','iframes','unexpectedNetwork',"page.on('pageerror'","message.type()!=='error'"])assert.ok(source.includes(token),token);
  for(const failure of ['js_heap','dom_nodes','event_listeners','documents','timers','iframes','duplicate_shell','unexpected_first_party_network'])assert.ok(source.includes(failure),failure);
});

test('Wave BP uses deterministic 503 dependency injection and never injects market evidence',async()=>{
  const source=await read('scripts/qelly-first-paint-stability.mjs');
  assert.match(source,/bp_injected_dependency_unavailable/);
  assert.match(source,/status:503/);
  assert.match(source,/without external-provider variance or fake market evidence/);
  assert.doesNotMatch(source,/status:200,contentType:'application\/json',body:injectedBody/);
});

test('Wave BP keeps the full Browser E2E and accessibility pipeline intact',async()=>{
  const workflow=await read('.github/workflows/browser-e2e.yml');
  assert.match(workflow,/Validate cold and warm first-paint stability/);
  assert.match(workflow,/node scripts\/qelly-first-paint-stability\.mjs/);
  assert.match(workflow,/Capture every registered route at desktop and mobile widths/);
  assert.match(workflow,/Validate accessibility and responsive interaction contracts/);
  assert.match(workflow,/Verify screenshot and archive contract/);
});
