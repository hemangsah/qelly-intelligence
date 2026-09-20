import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=(path)=>readFile(new URL('../'+path,import.meta.url),'utf8');

test('Market mounts Advanced Chart before the secondary widget network',async()=>{
  const source=await read('apps/web/public/assets/routes/market-v6.mjs');
  assert.ok(source.indexOf('q-v7-chart-panel') < source.indexOf('q-market-widget-section'));
  assert.match(source,/chartFrame=requestAnimationFrame\(mount\)/);
  assert.ok(source.indexOf('q-v7-chart-panel') < source.indexOf('data-market-widget-grid'));
});

test('Market suppresses appearance mutation remount storms',async()=>{
  const source=await read('apps/web/public/assets/routes/market-v6.mjs');
  assert.match(source,/let lastAppearance=tradingViewAppearance\(\),themeTimer=0/);
  assert.match(source,/if\(nextAppearance===lastAppearance\)return/);
  assert.match(source,/themeTimer=setTimeout/);
  assert.doesNotMatch(source,/intelligenceDockHandle\?\.refresh\(\)/);
});

test('secondary TradingView widgets mount lazily and in a staggered queue',async()=>{
  const source=await read('apps/web/public/assets/market/tradingview-market-grid.mjs');
  assert.match(source,/const mountTimers=new Set\(\)/);
  assert.match(source,/scheduleCard\(entry\.target,index\*350\)/);
  assert.match(source,/cards\.forEach\(card=>observer\.observe\(card\)\)/);
  assert.doesNotMatch(source,/requestAnimationFrame\(\(\)=>mountCard\(primary\)\)/);
  assert.match(source,/for\(const timer of mountTimers\)clearTimeout\(timer\)/);
});

test('TradingView blank states are bounded and retryable',async()=>{
  const source=await read('apps/web/public/assets/market/tradingview-display-widget.mjs');
  assert.match(source,/const WIDGET_TIMEOUT_MS=12000/);
  assert.match(source,/data-qelly-tv-retry/);
  assert.match(source,/Retry market view/);
  assert.match(source,/retry:start/);
  assert.match(source,/did not initialize within the production timeout/);
});


test('production shell ignores third-party subtree churn after route root settles',async()=>{
  const source=await read('apps/web/public/assets/qelly-production-shell.mjs');
  assert.match(source,/const routeRootChanged=records\.some\(\(record\)=>record\.type==='childList'&&record\.target===main\)/);
  assert.match(source,/if\(routeRootChanged\)schedule\(main\)/);
  assert.doesNotMatch(source,/new MutationObserver\(\(\)=>schedule\(main\)\)/);
});
