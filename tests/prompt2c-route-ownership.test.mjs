import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const source=await readFile(new URL('../apps/web/public/assets/qelly-product-route-guard.mjs',import.meta.url),'utf8');

test('product route ownership retains the hidden world-class framing sentinel',()=>{
  assert.match(source,/framingSentinels/);
  assert.match(source,/\.q-worldclass-context/);
  assert.match(source,/main\.replaceChildren\(\.\.\.sentinels,node\)/);
  assert.doesNotMatch(source,/main\.replaceChildren\(node\)/);
});

test('market, status and access-gate ownership share the stable replacement path',()=>{
  assert.match(source,/replaceProductContent\(route,current\)/);
  assert.match(source,/replaceProductContent\(route,gate\)/);
  assert.match(source,/replaceProductContent\(route,preserved\)/);
  assert.equal((source.match(/new MutationObserver/g)||[]).length,1);
});
