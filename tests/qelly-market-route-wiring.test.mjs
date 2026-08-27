import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=(path)=>readFile(new URL(`../${path}`,import.meta.url),'utf8');

test('the public Market route uses the canonical V6/V7 embed renderer',async()=>{
  const app=await read('apps/web/public/assets/app.js');
  assert.match(app,/const renderMarketV6=lazyRoute\('\.\/routes\/market-v6\.mjs','renderMarketV6'\);/);
  assert.doesNotMatch(app,/^import .*\.\/routes\/market-v6\.mjs/m);
  assert.match(app,/case 'market': await renderMarketV6\(main,\{api,pageHead,stateBanner,escapeHtml\}\); break;/);
});
