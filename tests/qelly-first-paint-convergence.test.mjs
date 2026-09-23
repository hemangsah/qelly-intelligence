import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {convergePublicRuntimeHtml,publicShellConvergenceInventory} from '../scripts/public-shell-convergence.mjs';

const read=(path)=>readFile(new URL('../'+path,import.meta.url),'utf8');

test('connected artifact contains one visible current shell and no legacy visible header generation',async()=>{
  const html=convergePublicRuntimeHtml(await read('apps/web/public/index.html'));
  const inventory=publicShellConvergenceInventory(html);
  assert.equal(inventory.currentShell,1);
  assert.equal(inventory.legacyCommandBars,0);
  assert.equal(inventory.legacyWorldclassScripts,0);
  assert.equal(inventory.legacyMotionScripts,0);
  assert.equal(inventory.v5RuntimeScripts,0);
  assert.equal(inventory.v53RuntimeScripts,1);
  assert.equal(inventory.productionShellScripts,1);
  assert.equal(inventory.staticCompatStyles,9);
  assert.match(html,/data-qelly-legacy-bindings="true" hidden aria-hidden="true"/);
  assert.match(html,/class="q-product-header" data-qelly-current-shell="true"/);
});

test('historical V5.3 compatibility styles are deterministic build-time resources rather than late stylesheet injection',async()=>{
  const html=convergePublicRuntimeHtml(await read('apps/web/public/index.html'));
  for(const file of [
    'qelly-v53-visible-refinement.css','qelly-post-v53-convergence.css','qelly-v53-active-shell-convergence.css',
    'qelly-v53-production-shell-convergence.css','qelly-v53-production-shell-status.css',
    'qelly-v53-market-command-workspace.css','qelly-v53-market-command-workspace-correction.css',
    'qelly-v53-research-evidence-workspace.css','qelly-v53-family-harmonization.css'
  ]) assert.match(html,new RegExp('<link rel="stylesheet" href="\\./assets/'+file.replaceAll('.','\\.')+'"'));
});

test('production shell does not mutate stylesheet order or observe document head',async()=>{
  const shell=await read('apps/web/public/assets/qelly-production-shell.mjs');
  assert.match(shell,/verifyCanonicalStylesheetContract/);
  assert.doesNotMatch(shell,/document\.head\.append/);
  assert.doesNotMatch(shell,/observe\(document\.head/);
  assert.doesNotMatch(shell,/requestAnimationFrame\(\(\)=>\{queued=false;refresh\(scope\)/);
  assert.match(shell,/queueMicrotask\(\(\)=>\{queued=false;refresh\(scope\)/);
});

test('protected-route convergence has no global guard reconciliation ladder',async()=>{
  const [index,app]=await Promise.all([
    read('apps/web/public/index.html'),
    read('apps/web/public/assets/app.js')
  ]);
  assert.doesNotMatch(index,/qelly-product-route-guard\.mjs/);
  assert.doesNotMatch(index,/qelly-external-market-surfaces\.mjs/);
  assert.match(app,/main\.innerHTML=protectedRouteGate\(definition\)/);
  await assert.rejects(read('apps/web/public/assets/qelly-product-route-guard.mjs'),{code:'ENOENT'});
});

test('normal routes are not globally restyled by the idle theme visual enhancer',async()=>{
  const visual=await read('apps/web/public/assets/theme-intelligence-visual-correction.mjs');
  assert.match(visual,/syncVisualDatasets\(\{releaseTokens:Boolean\(page\)\}\)/);
  assert.match(visual,/if\(releaseTokens\)releaseVisualStyleTokens\(root\)/);
});

test('current product header is visible before route readiness while main content remains gated',async()=>{
  const html=convergePublicRuntimeHtml(await read('apps/web/public/index.html'));
  assert.match(html,/data-app-ready="false"\] \.q-app\{visibility:visible/);
  assert.match(html,/data-app-ready="false"\] #main\{visibility:hidden/);
  assert.doesNotMatch(html,/data-app-ready="false"\] \.q-app\{visibility:hidden/);
});

test('browser stability evidence measures repeated route switching after forced GC',async()=>{
  const probe=await read('scripts/qelly-first-paint-stability.mjs');
  assert.match(probe,/runRouteCycleStabilityProbe/);
  assert.match(probe,/for\(let cycle=1;cycle<=6;cycle\+=1\)/);
  assert.match(probe,/HeapProfiler\.collectGarbage/);
  assert.match(probe,/Performance\.getMetrics/);
  assert.match(probe,/jsHeapUsedBytes/);
  assert.match(probe,/eventListeners/);
  assert.match(probe,/domNodes/);
  assert.match(probe,/materialContinuousGrowth/);
  assert.match(probe,/metricSource:'chromium-cdp-after-forced-gc'/);
});
