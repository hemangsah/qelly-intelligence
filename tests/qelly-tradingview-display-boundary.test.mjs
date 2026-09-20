import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {__tradingViewDisplayTest,tradingViewSymbol,tradingViewInterval} from '../apps/web/public/assets/market/tradingview-display-widget.mjs';
import {validateMarketWidgetPanels} from '../apps/web/public/assets/market/tradingview-market-grid.mjs';

const read=(path)=>readFile(new URL(path,import.meta.url),'utf8');

test('TradingView widget uses official bootstraps with an explicit market-reference boundary',()=>{
  assert.equal(__tradingViewDisplayTest.WIDGET_SRC,'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js');
  assert.deepEqual(Object.keys(__tradingViewDisplayTest.WIDGET_SOURCES),['advancedChart','tickerTape','marketOverview','screener','economicCalendar','technicalAnalysis','cryptoHeatmap','stockHeatmap','etfHeatmap','forexHeatmap','forexCrossRates','topStories','symbolOverview','miniChart','marketQuotes']);
  assert.match(__tradingViewDisplayTest.WIDGET_SOURCES.etfHeatmap,/embed-widget-etf-heatmap\.js$/);
  assert.match(__tradingViewDisplayTest.WIDGET_SOURCES.forexHeatmap,/embed-widget-forex-heat-map\.js$/);
  assert.match(__tradingViewDisplayTest.DISPLAY_BOUNDARY,/market reference only/i);
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

test('Market Command makes Crypto Heatmap the first major market module and lazy-loads secondary views',async()=>{
  const route=await read('../apps/web/public/assets/routes/market-v6.mjs');
  const grid=await read('../apps/web/public/assets/market/tradingview-market-grid.mjs');
  const mod=await import('../apps/web/public/assets/routes/market-v6.mjs');
  const panels=mod.__marketV6Test.MARKET_WIDGET_PANELS;
  assert.equal(panels[0].kind,'cryptoHeatmap');
  assert.equal(panels[0].label,'Crypto Coins Heatmap');
  assert.equal(new Set(panels.map(panel=>panel.kind)).size,panels.length);
  for(const label of ['Crypto Coins Heatmap','Market Overview','Crypto Market Screener','Economic Calendar','Stock Heatmap','ETF Heatmap','Forex Heatmap','Technical Analysis','Top Stories'])assert.match(route,new RegExp(label));
  assert.match(route,/data-market-widget-priority="\$\{index===0\?'primary':'secondary'\}"/);
  assert.ok(route.indexOf('data-market-widget-grid')<route.indexOf('q-tv-tape-shell'));
  assert.ok(route.indexOf('data-market-widget-grid')<route.indexOf('q-v7-market-grid'));
  assert.doesNotMatch(route,/data-tv-suite/);
  assert.match(grid,/IntersectionObserver/);
  assert.match(grid,/requestAnimationFrame\(\(\)=>mountCard\(primary\)\)/);
  assert.match(grid,/Duplicate TradingView widget kind/);
  assert.doesNotMatch(route,/embedded research suite|third-party panel|iframe/i);
});

test('market widget grid reserves layout and keeps Crypto Heatmap leftmost/first across responsive breakpoints',async()=>{
  const css=await read('../apps/web/public/assets/routes/market-v6.css');
  const {MARKET_WIDGET_PANELS}= (await import('../apps/web/public/assets/routes/market-v6.mjs')).__marketV6Test;
  assert.equal(validateMarketWidgetPanels(MARKET_WIDGET_PANELS),true);
  assert.equal(MARKET_WIDGET_PANELS[0].kind,'cryptoHeatmap');
  assert.match(css,/\.q-market-widget-grid\{display:grid;grid-template-columns:repeat\(12,minmax\(0,1fr\)\)/);
  assert.match(css,/\.q-market-widget-card--hero\{grid-column:span 8;grid-row:span 2\}/);
  assert.match(css,/\.q-market-widget-card--hero \.q-market-widget-stage\{min-height:610px\}/);
  assert.match(css,/@media\(max-width:700px\)[\s\S]*\.q-market-widget-grid\{grid-template-columns:1fr\}/);
  assert.match(css,/@media\(max-width:700px\)[\s\S]*\.q-market-widget-card,\.q-market-widget-card--hero,\.q-market-widget-card--tall,\.q-market-widget-card--wide\{grid-column:1;grid-row:auto\}/);
});

test('market widget definitions reject duplicate provider bootstraps',()=>{
  assert.throws(()=>validateMarketWidgetPanels([
    {id:'one',kind:'cryptoHeatmap'},
    {id:'two',kind:'cryptoHeatmap'}
  ]),/Duplicate TradingView widget kind/);
  assert.throws(()=>validateMarketWidgetPanels([{id:'overview',kind:'marketOverview'}]),/Crypto Heatmap must be the first market widget/);
});

test('CSP preserves the TradingView boundary alongside separately governed provider displays',async()=>{
  const headers=await read('../apps/web/public/_headers');
  assert.match(headers,/script-src 'self' https:\/\/s3\.tradingview\.com/);
  assert.match(headers,/frame-src https:\/\/\*\.tradingview\.com https:\/\/\*\.tradingview-widget\.com https:\/\/platform\.twitter\.com https:\/\/syndication\.twitter\.com/);
  assert.match(headers,/connect-src 'self' https:\/\/3rdparty-apis\.coinmarketcap\.com wss:\/\/api\.hyperliquid\.xyz/);
  assert.match(headers,/frame-ancestors 'none'/);
  assert.doesNotMatch(headers,/connect-src[^\n;]*tradingview/i);
});
