import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=(path)=>readFile(new URL(`../${path}`,import.meta.url),'utf8');

test('the public Market route uses the canonical V6/V7 embed renderer',async()=>{
  const app=await read('apps/web/public/assets/app.js');
  assert.match(app,/import \{ renderMarketV6 \} from '\.\/routes\/market-v6\.mjs';/);
  assert.match(app,/case 'market': await renderMarketV6\(main,\{api,pageHead,stateBanner,escapeHtml\}\); break;/);
});
