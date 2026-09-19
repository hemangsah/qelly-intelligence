import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=(path)=>readFile(new URL(`../${path}`,import.meta.url),'utf8');

test('connected production runtime is injected before the app-ready reveal gate',async()=>{
  const build=await read('scripts/build-frontend.mjs');
  assert.match(build,/const appReadyScript='  <script type="module" src="\.\/assets\/qelly-app-ready\.mjs"><\/script>'/);
  assert.match(build,/const runtimeScript='  <script type="module" src="\.\/assets\/qelly-public-runtime\.mjs"><\/script>'/);
  assert.match(build,/index=index\.replace\(appReadyScript,\`\$\{runtimeScript\}\\n\$\{appReadyScript\}\`\)/);
  assert.doesNotMatch(build,/qelly-public-runtime\.mjs[^\n]+replace\('<\/body>'/);
});

test('static source keeps production runtime build-gated',async()=>{
  const index=await read('apps/web/public/index.html');
  assert.match(index,/qelly-app-ready\.mjs/);
  assert.doesNotMatch(index,/src="\.\/assets\/qelly-public-runtime\.mjs"/);
});
