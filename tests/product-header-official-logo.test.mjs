import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=(path)=>readFile(new URL(`../${path}`,import.meta.url),'utf8');

test('production product header replaces the placeholder letter with the official Qelly symbol',async()=>{
  const [correction,controller,symbol]=await Promise.all([
    read('apps/web/public/assets/qelly-brand-visual-correction.mjs'),
    read('apps/web/public/assets/qelly-public-runtime.mjs'),
    read('apps/web/public/assets/brand/qelly-symbol.svg')
  ]);

  assert.match(controller,/q-product-brand__mark/);
  assert.match(correction,/correctProductHeaderBrand/);
  assert.match(correction,/\.\/brand\/qelly-symbol\.svg/);
  assert.match(correction,/mark\.replaceWith\(image\)/);
  assert.match(correction,/qellyOfficialMark/);
  assert.match(correction,/new MutationObserver\(refresh\)/);
  assert.match(symbol,/Burgundy Q ring crossed by a rising intelligence trajectory/);
  assert.doesNotMatch(correction,/innerHTML\s*=\s*[`'"]Q[`'"]/);
});
