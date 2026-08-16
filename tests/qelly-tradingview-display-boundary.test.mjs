import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {__tradingViewDisplayTest,tradingViewSymbol,tradingViewInterval} from '../apps/web/public/assets/market/tradingview-display-widget.mjs';

const read=(path)=>readFile(new URL(path,import.meta.url),'utf8');

test('TradingView widget uses the official embed bootstrap with an explicit display-only boundary',()=>{
  assert.equal(__tradingViewDisplayTest.WIDGET_SRC,'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js');
  assert.match(__tradingViewDisplayTest.DISPLAY_BOUNDARY,/display only/i);
  assert.match(__tradingViewDisplayTest.DISPLAY_BOUNDARY,/does not read, scrape, transform, persist or use widget values/i);
  assert.equal(tradingViewSymbol('BTCUSDT'),'BINANCE:BTCUSDT');
  assert.equal(tradingViewInterval('4h'),'240');
});

test('external market surface is bootstrapped by the production route guard and does not ingest external data',async()=>{
  const [guard,surface,widget]=await Promise.all([
    read('../apps/web/public/assets/qelly-product-route-guard.mjs'),
    read('../apps/web/public/assets/qelly-external-market-surfaces.mjs'),
    read('../apps/web/public/assets/market/tradingview-display-widget.mjs')
  ]);
  assert.match(guard,/import '\.\/qelly-external-market-surfaces\.mjs'/);
  assert.match(surface,/DISPLAY ONLY/);
  assert.match(surface,/does not scrape or ingest/);
  assert.match(surface,/qelly-v6-production-convergence\.css/);
  assert.doesNotMatch(widget,/\bfetch\s*\(/);
  assert.doesNotMatch(widget,/\bWebSocket\b/);
  assert.doesNotMatch(widget,/contentWindow|contentDocument/);
});

test('CSP permits only the TradingView external display boundary while browser data connections remain same-origin',async()=>{
  const headers=await read('../apps/web/public/_headers');
  assert.match(headers,/script-src 'self' https:\/\/s3\.tradingview\.com/);
  assert.match(headers,/frame-src https:\/\/\*\.tradingview\.com https:\/\/\*\.tradingview-widget\.com/);
  assert.match(headers,/connect-src 'self'/);
  assert.match(headers,/frame-ancestors 'none'/);
  assert.doesNotMatch(headers,/connect-src[^\n;]*tradingview/i);
});
