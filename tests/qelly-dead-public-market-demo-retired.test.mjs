import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const catchAll=await readFile(new URL('../functions/api/v1/[[path]].js',import.meta.url),'utf8');
const dedicated=await readFile(new URL('../functions/api/v1/public/markets/[[route]].js',import.meta.url),'utf8');

test('legacy catch-all no longer owns or fabricates the public market namespace',()=>{
  assert.doesNotMatch(catchAll,/PUBLIC_MARKET_ASSETS|PUBLIC_MARKET_OBSERVED_AT|publicMarketCandles|publicMarketOverviewContract|qelly-governed-demo|simulated-demo/);
  assert.doesNotMatch(catchAll,/path==='public\/markets\/overview'|path==='public\/markets\/assets'/);
  assert.doesNotMatch(catchAll,/segments\[0\]==='public'&&segments\[1\]==='markets'/);
  assert.doesNotMatch(catchAll,/Math\.sin|Math\.cos/);
});

test('dedicated Cloudflare public market owner remains bounded live and explicit no-fabrication authority',()=>{
  assert.match(dedicated,/MARKET_UNAVAILABLE_REASON/);
  assert.match(dedicated,/NO_FABRICATION_RULE/);
  assert.match(dedicated,/fabricatedObservations:false/);
  assert.match(dedicated,/fabricatedFallback:false/);
  assert.match(dedicated,/HYPERLIQUID_URL='https:\/\/api\.hyperliquid\.xyz\/info'/);
  assert.match(dedicated,/type:'candleSnapshot'/);
  assert.match(dedicated,/LIVE_ASSETS=Object\.freeze/);
  assert.doesNotMatch(dedicated,/qelly-fixture|simulated-demo|qelly-governed-demo|Math\.sin|Math\.cos/);
});

test('provider-backed legacy market overview remains read-only and truth-labeled',()=>{
  assert.match(catchAll,/path==='market\/overview'/);
  assert.match(catchAll,/providerResult\(context,'binance','quote','BTCUSDT'/);
  assert.match(catchAll,/providerResult\(context,'coinbase','quote','BTC-USD'/);
  assert.match(catchAll,/providerResult\(context,'ecb','fx-reference-rates','EUR'/);
  assert.match(catchAll,/execution:false/);
});
