import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const runtimePath=new URL('../apps/web/public/assets/qelly-ui-lock-v5-3.mjs',import.meta.url);
const productRuntimePath=new URL('../apps/web/public/assets/qelly-public-runtime.mjs',import.meta.url);
const cssPath=new URL('../apps/web/public/assets/qelly-v53-production-shell-convergence.css',import.meta.url);
const statusCssPath=new URL('../apps/web/public/assets/qelly-v53-production-shell-status.css',import.meta.url);
const read=(url)=>readFile(url,'utf8');
const executableCss=(source)=>source.replace(/\/\*[\s\S]*?\*\//g,'');

test('V5.3 production shell uses the accepted compact terminal stack',async()=>{
  const [runtime,product,css,statusCss]=await Promise.all([read(runtimePath),read(productRuntimePath),read(cssPath),read(statusCssPath)]);
  assert.match(product,/legacy\.className='q-product-header'/);
  assert.match(runtime,/qelly-v53-production-shell-convergence\.css/);
  assert.match(runtime,/qelly-v53-production-shell-status\.css/);
  assert.match(css,/--q-v53-system-h:24px/);
  assert.match(css,/--q-v53-command-h:40px/);
  assert.match(css,/--q-v53-context-h:30px/);
  assert.match(css,/--q-v53-top:94px/);
  assert.match(css,/--q-v53-rail:64px/);
  assert.match(css,/\.q-product-header[\s\S]*height:64px/);
  assert.match(css,/\.q-worldclass-context[\s\S]*height:30px/);
  assert.match(statusCss,/\.q-v53-product-status/);
});

test('production system strip states the operating boundary without fabricated provider counts',async()=>{
  const [runtime,css]=await Promise.all([read(runtimePath),read(cssPath)]);
  assert.match(runtime,/className='q-v53-product-status'/);
  assert.match(runtime,/READ ONLY · NO EXECUTION/);
  assert.match(runtime,/Provider truth · route-governed/);
  assert.doesNotMatch(runtime,/Providers\s*·\s*\d+|Providers:\s*\d+/);
  assert.match(css,/\.q-v53-product-status/);
});

test('accepted shell keeps command search, account actions and the semantic rail reachable',async()=>{
  const css=executableCss(await read(cssPath));
  assert.match(css,/\.q-product-search/);
  assert.match(css,/\.q-product-actions/);
  assert.match(css,/\.q-product-account/);
  assert.match(css,/\.q-edge-dock/);
  assert.match(css,/width:64px!important/);
  assert.match(css,/#main[\s\S]*margin-left:64px/);
});

test('Market Command uses dense analytical workspace proportions',async()=>{
  const css=executableCss(await read(cssPath));
  assert.match(css,/data-v53-route="live-markets"/);
  assert.match(css,/\.q-live-layout[\s\S]*grid-template-columns:minmax\(0,1fr\) minmax\(390px,31vw\)/);
  assert.match(css,/\.q-live-chart-shell[\s\S]*min-height:500px/);
  assert.match(css,/\.q-live-side-stack/);
  assert.match(css,/\.q-v5-evidence-ribbon/);
});

test('production shell is task-first on smaller viewports and retains evidence selectors',async()=>{
  const css=executableCss(await read(cssPath));
  assert.match(css,/@media\(max-width:1024px\)/);
  assert.match(css,/@media\(max-width:600px\)/);
  assert.match(css,/\.q-worldclass-context/);
  assert.match(css,/\.q-worldclass-truth/);
  assert.match(css,/\.q-v5-evidence-ribbon/);
  assert.doesNotMatch(css,/visibility\s*:\s*hidden/);
});
