import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const runtimePath=new URL('../apps/web/public/assets/qelly-ui-lock-v5-3.mjs',import.meta.url);
const productRuntimePath=new URL('../apps/web/public/assets/prompt2c-public-beta.mjs',import.meta.url);
const cssPath=new URL('../apps/web/public/assets/qelly-v53-production-shell-convergence.css',import.meta.url);
const read=(url)=>readFile(url,'utf8');
const executableCss=(source)=>source.replace(/\/\*[\s\S]*?\*\//g,'');

test('V5.3 production shell follows the authoritative Prompt2C product header owner',async()=>{
  const [runtime,product,css]=await Promise.all([read(runtimePath),read(productRuntimePath),read(cssPath)]);
  assert.match(product,/legacy\.className='q-product-header'/);
  assert.match(runtime,/qelly-v53-production-shell-convergence\.css/);
  assert.match(runtime,/data-qelly-v53-production-shell="wave1"/);
  assert.match(runtime,/\.q-command-bar,\.q-product-header/);
  assert.match(css,/\[data-product-surface="production"\] \.q-product-header/);
  assert.match(css,/--q-v53-product-shell-h:94px/);
});

test('authoritative product shell keeps search, navigation and account controls reachable',async()=>{
  const css=executableCss(await read(cssPath));
  for(const selector of ['.q-product-brand','.q-product-search','.q-product-nav','.q-product-actions','.q-product-account']){
    assert.ok(css.includes(selector),`missing production shell owner ${selector}`);
  }
  assert.match(css,/grid-template-areas:[\s\S]*"brand search actions"[\s\S]*"brand nav actions"/);
  assert.match(css,/overflow-x:auto/);
  assert.doesNotMatch(css,/display\s*:\s*none/);
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
