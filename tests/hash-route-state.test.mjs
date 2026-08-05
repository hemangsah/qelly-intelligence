import test from 'node:test';
import assert from 'node:assert/strict';
import {parseHashRoute,buildHashRoute} from '../apps/web/public/assets/hash-route-state.mjs';

test('detail hash parser separates route asset and share query',()=>{
  const parsed=parseHashRoute('#/calculator-detail/fresh-present-value?state=abc_123');
  assert.equal(parsed.route,'calculator-detail');
  assert.equal(parsed.asset,'fresh-present-value');
  assert.equal(parsed.query.get('state'),'abc_123');
});

test('saved detail hash parser preserves encoded identifiers and query',()=>{
  const hash=buildHashRoute('saved-calculation-detail','saved/id',{state:'encoded-value'});
  const parsed=parseHashRoute(hash);
  assert.equal(parsed.route,'saved-calculation-detail');
  assert.equal(parsed.asset,'saved/id');
  assert.equal(parsed.query.get('state'),'encoded-value');
});

test('hash parser uses deterministic fallback without contaminating asset',()=>{
  const parsed=parseHashRoute('',{fallback:'market'});
  assert.deepEqual({route:parsed.route,asset:parsed.asset,query:parsed.query.toString()},{route:'market',asset:null,query:''});
});
