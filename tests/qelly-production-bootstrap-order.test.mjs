import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {convergePublicRuntimeHtml,publicShellConvergenceInventory} from '../scripts/public-shell-convergence.mjs';

const read=(path)=>readFile(new URL('../'+path,import.meta.url),'utf8');

test('connected production artifact converges to the current shell before the app-ready gate',async()=>{
  const source=await read('apps/web/public/index.html');
  const html=convergePublicRuntimeHtml(source);
  const inventory=publicShellConvergenceInventory(html);
  assert.deepEqual(inventory,{
    currentShell:1,
    legacyCommandBars:0,
    legacyWorldclassScripts:0,
    legacyMotionScripts:0,
    v5RuntimeScripts:0,
    v53RuntimeScripts:1,
    productionShellScripts:1,
    staticCompatStyles:9
  });
  const current=html.indexOf('data-qelly-current-shell="true"');
  const v53=html.indexOf('src="./assets/qelly-ui-lock-v5-3.mjs"');
  const shell=html.indexOf('src="./assets/qelly-production-shell.mjs"');
  const ready=html.indexOf('src="./assets/qelly-app-ready.mjs"');
  assert.ok(current>=0&&v53>current&&shell>v53&&ready>shell,{current,v53,shell,ready});
});

test('production build applies public shell convergence only to connected runtime artifacts',async()=>{
  const build=await read('scripts/build-frontend.mjs');
  assert.match(build,/import \{convergePublicRuntimeHtml\} from '\.\/public-shell-convergence\.mjs'/);
  assert.match(build,/index=convergePublicRuntimeHtml\(index\)/);
  assert.match(build,/publicRuntimeEnabled/);
  const source=await read('apps/web/public/index.html');
  assert.match(source,/class="q-command-bar"/);
  assert.doesNotMatch(source,/data-qelly-current-shell="true"/);
});

test('current header can paint before route readiness while route content remains gated',async()=>{
  const source=await read('apps/web/public/index.html');
  const html=convergePublicRuntimeHtml(source);
  assert.match(html,/html\[data-app-ready="false"\] \.q-app\{visibility:visible/);
  assert.match(html,/html\[data-app-ready="false"\] #main\{visibility:hidden/);
  assert.doesNotMatch(html,/html\[data-app-ready="false"\] \.q-app\{visibility:hidden/);
});

test('production runtime binds an existing current header instead of replacing it',async()=>{
  const runtime=await read('apps/web/public/assets/qelly-public-runtime.mjs');
  assert.match(runtime,/q-product-header\[data-qelly-current-shell="true"\]/);
  assert.match(runtime,/if\(!header\.matches\('\.q-product-header\[data-qelly-current-shell="true"\]'\)\)/);
  assert.match(runtime,/bindProductHeader\(header\)/);
  assert.match(runtime,/syncProductHeaderState\(header\)/);
  assert.match(runtime,/if\(shellAlreadyParsed\)install\(\)/);
});
