import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {__tradingViewDisplayTest,tradingViewSymbol,tradingViewInterval} from '../apps/web/public/assets/market/tradingview-display-widget.mjs';

const read=(path)=>readFile(new URL(path,import.meta.url),'utf8');

test('TradingView widget uses the official embed bootstrap with an explicit display-only boundary',()=>{
  assert.equal(__tradingViewDisplayTest.WIDGET_SRC,'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js');
  assert.deepEqual(Object.keys(__tradingViewDisplayTest.WIDGET_SOURCES),['advancedChart','tickerTape','marketOverview','screener','economicCalendar','technicalAnalysis','cryptoHeatmap','stockHeatmap','forexCrossRates','topStories','symbolOverview','miniChart','marketQuotes']);
  assert.match(__tradingViewDisplayTest.DISPLAY_BOUNDARY,/display only/i);
  assert.match(__tradingViewDisplayTest.DISPLAY_BOUNDARY,/does not read, scrape, transform, persist or use widget values/i);
  assert.equal(tradingViewSymbol('BTCUSDT'),'BINANCE:BTCUSDT');
  assert.equal(tradingViewInterval('4h'),'240');
  assert.equal(__tradingViewDisplayTest.WIDGET_TIMEOUT_MS,12000);
  assert.match(__tradingViewDisplayTest.COMPONENT_STYLESHEET,/tradingview-display-widget\.css$/);
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
  assert.match(widget,/const widgetReady=\(wrapper\)=>Boolean\(wrapper\?\.querySelector\('iframe'\)\)/);
  assert.match(widget,/observer\.observe\(wrapper,\{childList:true,subtree:true\}\)/);
  assert.doesNotMatch(widget,/observer\.observe\(host/);
  assert.match(widget,/iframe\.addEventListener\('load'/);
  assert.doesNotMatch(widget,/script\.addEventListener\('load',\(\)=>requestAnimationFrame/);
  const css=await read('../apps/web/public/assets/market/tradingview-display-widget.css');
  assert.match(css,/inset:0 0 32px/);
  assert.match(css,/z-index:3/);
  assert.match(css,/pointer-events:none/);
});

test('Market Command exposes the complete lazy embedded research suite',async()=>{
  const route=await read('../apps/web/public/assets/routes/market-v6.mjs');
  for(const label of ['Market overview','Screener','Economic calendar','Technicals','Crypto heatmap','Stock heatmap','FX cross rates','Top stories','Symbol overview','Mini chart','Market quotes'])assert.match(route,new RegExp(label));
  assert.equal((await import('../apps/web/public/assets/routes/market-v6.mjs')).__marketV6Test.EMBED_PANELS.length,14);
  assert.match(route,/kind:'tickerTape'/);
  assert.match(route,/Fourteen official TradingView surfaces/);
  assert.match(route,/IntersectionObserver/);
  assert.match(route,/role="tablist"/);
  assert.match(route,/ArrowLeft/);
  assert.match(route,/suiteHandle\?\.refresh\(\)/);
});

test('CSP preserves the TradingView boundary alongside separately governed provider displays',async()=>{
  const headers=await read('../apps/web/public/_headers');
  assert.match(headers,/script-src 'self' https:\/\/s3\.tradingview\.com/);
  assert.match(headers,/frame-src https:\/\/\*\.tradingview\.com https:\/\/\*\.tradingview-widget\.com https:\/\/platform\.twitter\.com https:\/\/syndication\.twitter\.com/);
  assert.match(headers,/connect-src 'self' https:\/\/3rdparty-apis\.coinmarketcap\.com wss:\/\/api\.hyperliquid\.xyz/);
  assert.match(headers,/frame-ancestors 'none'/);
  assert.doesNotMatch(headers,/connect-src[^\n;]*tradingview/i);
});
