import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=(path)=>readFile(new URL(`../${path}`,import.meta.url),'utf8');

test('router fallback converges on the canonical Market renderer only',async()=>{
  const app=await read('apps/web/public/assets/app.js');
  assert.match(app,/case 'market': await renderMarketV6\(main,\{api,pageHead,stateBanner,escapeHtml\}\); break;/);
  assert.match(app,/default: await renderMarketV6\(main,\{api,pageHead,stateBanner,escapeHtml\}\);/);
  assert.doesNotMatch(app,/async function renderMarket\(main\)/);
  assert.doesNotMatch(app,/default: await renderMarket\(main\)/);
  assert.doesNotMatch(app,/Public market launch/);
});

test('canonical Market keeps Advanced Chart first and Crypto Heatmap immediately after it',async()=>{
  const source=await read('apps/web/public/assets/routes/market-v6.mjs');
  const hero=source.indexOf('id="v6-market-tradingview"');
  const widgetSection=source.indexOf('data-market-widget-grid');
  const firstPanel=source.indexOf("{id:'crypto-heatmap',label:'Crypto Coins Heatmap'");
  assert.ok(hero>=0,'advanced chart host is missing');
  assert.ok(widgetSection>hero,'market widget grid must follow the advanced chart');
  assert.ok(firstPanel>=0,'crypto heatmap panel definition is missing');
  const panelBlock=source.slice(source.indexOf('const MARKET_WIDGET_PANELS'),source.indexOf('const INTELLIGENCE_DOCK_PANELS'));
  assert.match(panelBlock,/MARKET_WIDGET_PANELS=Object\.freeze\(\[\s*\{id:'crypto-heatmap'/);
  assert.match(source,/mountTradingViewDisplay\(chart,\{symbol:symbol\.value,interval:interval\.value\}\)/);
  assert.match(source,/mountTradingViewMarketGrid\(marketGrid,\{panels:gridPanels,context:/);
});

test('TradingView embeds remain destroyable and timeout-bounded',async()=>{
  const widget=await read('apps/web/public/assets/market/tradingview-display-widget.mjs');
  assert.match(widget,/WIDGET_TIMEOUT_MS/);
  assert.match(widget,/MutationObserver/);
  assert.match(widget,/destroy\(\)\{destroyed=true;settled=true;cleanupAttempt\(\);container\.replaceChildren\(\)/);
  assert.match(widget,/Retry market view/);
  assert.match(widget,/Qelly has not substituted or fabricated chart values/);
});
