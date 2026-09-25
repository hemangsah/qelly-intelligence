import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=(path)=>readFile(new URL('../'+path,import.meta.url),'utf8');

test('Wave BP extends the exact-head Browser E2E stability script with Decision-specific chaos',async()=>{
  const source=await read('scripts/qelly-first-paint-stability.mjs');
  assert.match(source,/async function runDecisionChaosStabilityProbe\(browser\)/);
  assert.match(source,/report\.decisionChaosStability=await runDecisionChaosStabilityProbe\(browser\)/);
  assert.match(source,/if\(report\.decisionChaosStability\.status!=='passed'\)report\.status='failed'/);
  assert.match(source,/schemaVersion:3/);
});

test('Wave BP churns route, refresh/recompute, scanner and Decision controls without a production chaos switch',async()=>{
  const source=await read('scripts/qelly-first-paint-stability.mjs');
  for(const token of [
    "'#/market'","'#/decision-provenance'","page.reload",
    "'[data-dpg-horizon]'","'[data-dpg-rr]'","'[data-dpg-interval]'","'[data-dpg-asset]'",
    "'[data-dpg-refresh]'","'[data-dpg-scan]'",
    "'/api/v1/decision-scan?interval=15m&horizon=4h&rr=auto&universe=all&chaosCycle='",
    "window.dispatchEvent(new Event('pageshow'))"
  ])assert.ok(source.includes(token),token);
  const route=await read('apps/web/public/assets/routes/decision-proven-graph.mjs');
  assert.doesNotMatch(route,/chaosMode|failureInjection|simulateFailure|chaosCycle/i);
});

test('Wave BP instruments timers only inside the isolated browser context',async()=>{
  const source=await read('scripts/qelly-first-paint-stability.mjs');
  assert.match(source,/context\.addInitScript\(\(\)=>\{/);
  assert.match(source,/__QELLY_CHAOS_TIMER_TELEMETRY__/);
  assert.match(source,/activeTimeouts=new Set\(\),activeIntervals=new Set\(\)/);
  assert.match(source,/globalThis\.setTimeout=/);
  assert.match(source,/globalThis\.clearTimeout=/);
  assert.match(source,/globalThis\.setInterval=/);
  assert.match(source,/globalThis\.clearInterval=/);
  assert.match(source,/Chaos instrumentation exists only in the isolated Browser E2E context/);
});

test('Wave BP measures heap, DOM, listeners, documents, iframes, timers and first-party network pressure',async()=>{
  const source=await read('scripts/qelly-first-paint-stability.mjs');
  for(const token of [
    "'Performance.enable'","'HeapProfiler.enable'","'HeapProfiler.collectGarbage'",
    'JSHeapUsedSize','JSEventListeners','Documents',"page.locator('iframe').count()",
    'activeTimeouts','activeIntervals','firstPartyOutstanding','requestfailed'
  ])assert.ok(source.includes(token),token);
  assert.match(source,/metricSource:'chromium-cdp-after-forced-gc-plus-test-context-timer-instrumentation'/);
});

test('Wave BP uses sustained-growth checks rather than failing on one transient spike',async()=>{
  const source=await read('scripts/qelly-first-paint-stability.mjs');
  assert.match(source,/materialContinuousGrowth\(heap,\{ratio:1\.25,minDelta:8\*1024\*1024\}\)/);
  assert.match(source,/materialContinuousGrowth\(dom,\{ratio:1\.20,minDelta:800\}\)/);
  assert.match(source,/materialContinuousGrowth\(listeners,\{ratio:1\.50,minDelta:150\}\)/);
  assert.match(source,/materialContinuousGrowth\(documents,\{ratio:1\.50,minDelta:8\}\)/);
  assert.match(source,/materialContinuousGrowth\(iframes,\{ratio:1\.50,minDelta:3\}\)/);
  assert.match(source,/materialContinuousGrowth\(timeouts,\{ratio:2,minDelta:12\}\)/);
  assert.match(source,/materialContinuousGrowth\(intervals,\{ratio:2,minDelta:4\}\)/);
  assert.match(source,/materialContinuousGrowth\(outstanding,\{ratio:2,minDelta:4\}\)/);
});

test('Wave BP rejects duplicate shells, console/page errors and first-party request failures',async()=>{
  const source=await read('scripts/qelly-first-paint-stability.mjs');
  assert.match(source,/samples\.some\(item=>item\.currentShells!==1\)/);
  assert.match(source,/status:failures\.length\|\|errors\.length\|\|networkFailures\.length\?'failed':'passed'/);
  assert.match(source,/page\.on\('pageerror'/);
  assert.match(source,/page\.on\('console'/);
  assert.match(source,/page\.on\('requestfailed'/);
});

test('Wave BP Browser E2E workflow already executes the strengthened stability script on exact PR heads',async()=>{
  const workflow=await read('.github/workflows/browser-e2e.yml');
  assert.match(workflow,/Checkout exact evidence head/);
  assert.match(workflow,/Guard exact evidence head/);
  assert.match(workflow,/node scripts\/qelly-first-paint-stability\.mjs/);
  assert.match(workflow,/Capture every registered route at desktop and mobile widths/);
  assert.match(workflow,/Validate accessibility and responsive interaction contracts/);
});
