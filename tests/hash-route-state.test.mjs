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

test('hash parser uses deterministic production fallback without contaminating asset',()=>{
  const parsed=parseHashRoute('',{fallback:'market'});
  assert.deepEqual({route:parsed.route,asset:parsed.asset,query:parsed.query.toString()},{route:'market',asset:null,query:''});
});

test('market and live-markets remain distinct canonical routes',()=>{
  const market=parseHashRoute('#/market');
  const liveMarkets=parseHashRoute('#/live-markets');
  assert.equal(market.route,'market');
  assert.equal(liveMarkets.route,'live-markets');
  assert.equal(buildHashRoute(market.route),'#/market');
  assert.equal(buildHashRoute(liveMarkets.route),'#/live-markets');
});

test('legacy quant-calculator deep links resolve to the canonical calculator center',()=>{
  const parsed=parseHashRoute('#/quant-calculator?source=legacy');
  assert.equal(parsed.route,'calculator-center');
  assert.equal(parsed.asset,null);
  assert.equal(parsed.query.get('source'),'legacy');
});
