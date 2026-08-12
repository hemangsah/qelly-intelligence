import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const runtimePath=new URL('../apps/web/public/assets/qelly-ui-lock-v5-3.mjs',import.meta.url);
const productRuntimePath=new URL('../apps/web/public/assets/prompt2c-public-beta.mjs',import.meta.url);
const cssPath=new URL('../apps/web/public/assets/qelly-v53-production-shell-convergence.css',import.meta.url);
const statusCssPath=new URL('../apps/web/public/assets/qelly-v53-production-shell-status.css',import.meta.url);
const read=(url)=>readFile(url,'utf8');
const executableCss=(source)=>source.replace(/\/\*[\s\S]*?\*\//g,'');
const escaped=(value)=>value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const directSelectorHides=(css,selector)=>new RegExp(`${escaped(selector)}\\s*\\{[^}]*display\\s*:\\s*none`,'s').test(css);

test('V5.3 production shell follows the authoritative Prompt2C product header owner',async()=>{
  const [runtime,product,css,statusCss]=await Promise.all([read(runtimePath),read(productRuntimePath),read(cssPath),read(statusCssPath)]);
  assert.match(product,/legacy\.className='q-product-header'/);
  assert.match(runtime,/qelly-v53-production-shell-convergence\.css/);
  assert.match(runtime,/qelly-v53-production-shell-status\.css/);
  assert.match(runtime,/data-qelly-v53-production-shell="wave1"/);
  assert.match(runtime,/data-qelly-v53-production-status="wave1"/);
  assert.match(runtime,/\.q-command-bar,\.q-product-header/);
  assert.match(css,/\[data-product-surface="production"\] \.q-product-header/);
  assert.match(css,/--q-v53-product-shell-h:94px/);
  assert.match(statusCss,/grid-template-rows:24px 40px 30px/);
});

test('production system strip states the operating boundary without fabricated provider counts',async()=>{
  const [runtime,statusCss]=await Promise.all([read(runtimePath),read(statusCssPath)]);
  assert.match(runtime,/className='q-v53-product-status'/);
  assert.match(runtime,/READ ONLY · NO EXECUTION/);
  assert.match(runtime,/Provider truth · route-governed/);
  assert.doesNotMatch(runtime,/Providers\s*·\s*\d+|Providers:\s*\d+/);
  assert.match(statusCss,/\.q-v53-product-status/);
  assert.match(statusCss,/grid-area:status/);
});

test('authoritative product shell keeps search, navigation and account controls reachable',async()=>{
  const [baseCss,statusCss]=await Promise.all([read(cssPath),read(statusCssPath)]);
  const css=executableCss(`${baseCss}\n${statusCss}`);
  for(const selector of ['.q-product-brand','.q-product-search','.q-product-nav','.q-product-actions','.q-product-account']){
    assert.ok(css.includes(selector),`missing production shell owner ${selector}`);
    assert.equal(directSelectorHides(css,selector),false,`${selector} must not be display:none`);
  }
  assert.match(css,/grid-template-areas:[\s\S]*"status status status"[\s\S]*"brand search actions"[\s\S]*"brand nav actions"/);
  assert.match(css,/overflow-x:auto/);
});

test('mobile production navigation overrides the older menu-only concealment and remains horizontally reachable',async()=>{
  const css=executableCss(await read(statusCssPath));
  assert.match(css,/@media\(max-width:760px\)/);
  assert.match(css,/\.q-product-nav\s*\{[\s\S]*display:flex!important/);
  assert.match(css,/position:static!important/);
  assert.match(css,/overflow-x:auto!important/);
  assert.match(css,/clip:auto!important/);
  assert.match(css,/grid-template-rows:24px 40px 34px/);
});

test('production shell density is responsive without removing route evidence',async()=>{
  const css=executableCss(await read(cssPath));
  assert.match(css,/@media\(max-width:760px\)/);
  assert.match(css,/\.q-worldclass-context/);
  assert.match(css,/\.q-worldclass-purpose/);
  assert.match(css,/\.q-worldclass-truth-chip/);
  assert.doesNotMatch(css,/visibility\s*:\s*hidden/);
  assert.doesNotMatch(css,/nth-child\([^)]*n\s*\+/);
});
