import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {collectFinalShell,collectSourceShell,serviceWorkerReleaseKey,stampServiceWorker} from '../scripts/finalize-release-cache.mjs';

const read=(path)=>readFile(new URL('../'+path,import.meta.url),'utf8');
const sha='0123456789abcdef0123456789abcdef01234567';

test('final shell collector uses final local HTML dependencies and excludes external providers',()=>{
  const html='<!doctype html><html><head><link rel="stylesheet" href="./assets/app.css?v=3"><link rel="manifest" href="/manifest.webmanifest"><script type="module" src="./assets/app.js"></script><script src="https://s3.tradingview.com/widget.js"></script></head><body><a href="#/market">Market</a><a href="./support.html">Support</a></body></html>';
  const shell=collectFinalShell(html);
  for(const asset of ['./','./index.html','./qelly-config.js','./qelly-release.json','./manifest.webmanifest','./favicon.svg','./assets/app.css','./assets/app.js','./support.html'])assert.ok(shell.includes(asset),asset);
  assert.ok(!shell.some(asset=>asset.includes('tradingview')));
  assert.equal(new Set(shell).size,shell.length);
});

test('governed source shell remains comprehensive before final build stamping',async()=>{
  const source=await read('apps/web/public/qelly-service-worker.js');
  const shell=collectSourceShell(source);
  for(const asset of ['./assets/qelly-verify-engine.mjs','./assets/qelly-modern-interaction-polish.css','./assets/routes/asset-rankings-v2.css','./assets/routes/event-calendar.mjs','./support.html'])assert.ok(shell.includes(asset),asset);
  assert.ok(shell.length>50);
});

test('service worker stamping binds one release cache and preserves release-local fallbacks only',async()=>{
  const source=await read('apps/web/public/qelly-service-worker.js');
  const stamped=stampServiceWorker(source,{releaseSha:sha,shell:['./','./index.html','./assets/app.js']});
  assert.match(stamped,new RegExp("const RELEASE_KEY='"+sha+"'"));
  assert.match(stamped,/const CACHE_NAME=\`\$\{CACHE_PREFIX\}\$\{RELEASE_KEY\}\`/);
  assert.match(stamped,/const SHELL=\["\.\/","\.\/index\.html","\.\/assets\/app\.js"\];/);
  assert.doesNotMatch(stamped,/__QELLY_RELEASE_KEY__/);
  assert.doesNotMatch(stamped,/caches\.match\(/);
  assert.doesNotMatch(stamped,/fetch\('\.\/qelly-release\.json'/);
  assert.match(stamped,/return cache\.match\(request\)/);
  assert.match(stamped,/fetch\(request,\{cache:'no-store'\}\)/);
});

test('production release keys require a full SHA while local builds receive a deterministic scoped key',()=>{
  assert.equal(serviceWorkerReleaseKey(sha,'2026-09-21T00:00:00Z',true),sha);
  assert.throws(()=>serviceWorkerReleaseKey('unresolved','2026-09-21T00:00:00Z',true),/full 40-character commit SHA/);
  const first=serviceWorkerReleaseKey('unresolved','2026-09-21T00:00:00Z',false);
  const second=serviceWorkerReleaseKey('unresolved','2026-09-21T00:00:00Z',false);
  assert.equal(first,second);
  assert.match(first,/^local-[0-9a-f]{24}$/);
});

test('release-cache finalizer runs after all frontend generators',async()=>{
  const pkg=JSON.parse(await read('package.json'));
  assert.match(pkg.scripts['build:frontend'],/generate-public-asset-research\.mjs && node scripts\/finalize-release-cache\.mjs$/);
});

test('HTML and service-worker identity are never served from a stale browser cache',async()=>{
  const headers=await read('apps/web/public/_headers');
  assert.ok(headers.includes('\n/\n  Cache-Control: no-store, no-cache, must-revalidate, no-transform\n'));
  assert.ok(headers.includes('\n/index.html\n  Cache-Control: no-store, no-cache, must-revalidate, no-transform\n'));
  assert.ok(headers.includes('\n/qelly-service-worker.js\n  Cache-Control: no-store, no-cache, must-revalidate, no-transform\n'));
  assert.match(headers,/\/qelly-config\.js\n  Cache-Control: no-store/);
  assert.match(headers,/\/qelly-release\.json\n  Cache-Control: no-store/);
});

test('service-worker registration exposes only coarse runtime state',async()=>{
  const runtime=await read('apps/web/public/assets/qelly-public-runtime.mjs');
  assert.match(runtime,/feature:'service_worker',action:'register',state:'ready',surface:'offline_shell'/);
  assert.match(runtime,/feature:'service_worker',action:'register',state:'failed',surface:'offline_shell'/);
  assert.doesNotMatch(runtime,/detail:\{feature:'service_worker'[^}]*error/);
});
