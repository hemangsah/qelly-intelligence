import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=(path)=>readFile(new URL('../'+path,import.meta.url),'utf8');

test('contextual TradingView loader waits for proximity and exposes cleanup',async()=>{
  const source=await read('apps/web/public/assets/market/lazy-tradingview-widget.mjs');
  assert.match(source,/IntersectionObserver/);
  assert.match(source,/rootMargin='280px 0px'/);
  assert.match(source,/threshold:0\.01/);
  assert.match(source,/observer\.disconnect\(\)/);
  assert.match(source,/handle\?\.destroy\?\.\(\)/);
  assert.match(source,/mountTradingViewWidget\(container,options\)/);
});

test('contextual market widgets never become an execution or ingestion surface',async()=>{
  const source=await read('apps/web/public/assets/market/lazy-tradingview-widget.mjs');
  assert.doesNotMatch(source,/\bfetch\s*\(|\bWebSocket\b|contentWindow|contentDocument|execute|order-entry|wallet/i);
});
