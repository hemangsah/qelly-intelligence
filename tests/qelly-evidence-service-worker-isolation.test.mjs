import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');

test('all-screens evidence blocks service workers on the synthetic qelly.test origin',async()=>{
  const source=await read('scripts/release-a5-screen-batch.py');
  assert.match(source,/service_workers='block'/);
  assert.match(source,/Playwright page routing does not intercept Service Worker network requests/);
  assert.match(source,/prompt2c-sw\.js/);
  assert.match(source,/source\.replace\(context_marker, context_isolation, 2\)/);
});

test('accessibility evidence blocks the same service worker without weakening accessibility assertions',async()=>{
  const source=await read('scripts/release-a5-accessibility-evidence.py');
  assert.match(source,/service_workers='block'/);
  assert.match(source,/prompt2c-sw\.js/);
  assert.match(source,/source\.replace\(context_marker, context_isolation, 1\)/);
  assert.match(source,/release-a5-accessibility-check\.py/);
});

test('production service-worker registration remains present and is tested outside synthetic evidence origins',async()=>{
  const runtime=await read('apps/web/public/assets/prompt2c-public-beta.mjs');
  assert.match(runtime,/navigator\.serviceWorker\.register\('\.\/prompt2c-sw\.js'/);
  assert.doesNotMatch(runtime,/serviceWorkers\s*:\s*'block'/);
});
