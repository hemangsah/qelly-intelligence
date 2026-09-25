import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=(path)=>readFile(new URL('../'+path,import.meta.url),'utf8');

test('Wave BP adds Decision-specific route chaos to the exact Browser E2E stability gate',async()=>{
  const source=await read('scripts/qelly-first-paint-stability.mjs');
  assert.match(source,/runDecisionChaosStabilityProbe/);
  assert.match(source,/decisionChaosStability/);
  assert.match(source,/interactionCycles:4/);
  assert.match(source,/scannerAttempts:8/);
  assert.match(source,/refreshCycles:3/);
  assert.match(source,/Page\.setWebLifecycleState/);
});

test('Wave BP exercises rapid asset, timeframe and R:R churn plus repeated scanner and recompute paths',async()=>{
  const source=await read('scripts/qelly-first-paint-stability.mjs');
  assert.match(source,/const assets=\['BTC','ETH','SOL','BTC'\]/);
  assert.match(source,/const intervals=\['15m','1h','5m','15m'\]/);
  assert.match(source,/const rrs=\['1','2','4','auto'\]/);
  assert.match(source,/\[data-dpg-scan\]/);
  assert.match(source,/\[data-dpg-refresh\]/);
  assert.match(source,/interaction-cycle-/);
});

test('Wave BP measures heap, DOM, listeners, documents and iframe lifecycle after forced GC',async()=>{
  const source=await read('scripts/qelly-first-paint-stability.mjs');
  for(const metric of ['JSHeapUsedSize','Nodes','Documents','JSEventListeners','domNodes','iframes'])assert.ok(source.includes(metric),metric);
  assert.match(source,/HeapProfiler\.collectGarbage/);
  assert.match(source,/materialContinuousGrowth\(heap/);
  assert.match(source,/materialContinuousGrowth\(dom/);
  assert.match(source,/materialContinuousGrowth\(listeners/);
  assert.match(source,/materialContinuousGrowth\(documents/);
  assert.match(source,/materialContinuousGrowth\(iframes/);
});

test('Wave BP retains shell integrity, console and network failure gates',async()=>{
  const source=await read('scripts/qelly-first-paint-stability.mjs');
  assert.match(source,/currentShells!==1\|\|item\.visibleHeaders!==1/);
  assert.match(source,/console_or_page_errors/);
  assert.match(source,/unexpected_network_failures/);
  assert.match(source,/Qelly has not substituted or fabricated chart values|synthetic Decision evidence/);
});

test('Wave BP does not treat expected local Decision API unavailability as fabricated success',async()=>{
  const source=await read('scripts/qelly-first-paint-stability.mjs');
  assert.match(source,/expectedLocalDecisionBoundary/);
  assert.match(source,/\[401,404,503\]/);
  assert.match(source,/never converts a failed provider\/API call into synthetic Decision evidence/);
  assert.doesNotMatch(source,/status:'passed'.*catch/s);
});

test('Wave BP remains part of Browser E2E rather than a weaker optional workflow',async()=>{
  const workflow=await read('.github/workflows/browser-e2e.yml');
  assert.match(workflow,/Validate cold and warm first-paint stability/);
  assert.match(workflow,/node scripts\/qelly-first-paint-stability\.mjs/);
  assert.match(workflow,/Capture every registered route at desktop and mobile widths/);
  assert.match(workflow,/Validate accessibility and responsive interaction contracts/);
});
