import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');

test('production terminal shell never labels governed market data simulated',async()=>{
  const source=await read('apps/web/public/assets/qelly-v53-lock-shell.mjs');
  assert.match(source,/MARKET DATA · GOVERNED PROVIDER TRUTH/);
  assert.doesNotMatch(source,/SIMULATED REFERENCE DATA|Providers 5\/6/);
});

test('canonical production Market renderer is no-fabrication and anonymous-safe',async()=>{
  const source=await read('apps/web/public/assets/routes/market-v6.mjs');
  assert.match(source,/\/api\/v1\/public\/markets\/overview/);
  assert.match(source,/\/api\/v1\/providers\/ecb\?capability=fx-reference-rates&symbol=EUR/);
  assert.match(source,/TradingView market visualization/);
  assert.match(source,/Forex Factory Calendar/);
  assert.match(source,/Missing market data is never replaced with invented values/);
  assert.doesNotMatch(source,/aria-label="Market truth boundary"/);
  assert.doesNotMatch(source,/\/api\/v1\/platform\/data-plane|\/api\/v1\/providers\/runtime/);
  assert.doesNotMatch(source,/Math\.sin|Math\.cos|qelly-governed-demo|simulated-demo/);
});

test('Market Command keeps the hero transition intentional and removes the shell separator artifact',async()=>{
  const [source,marketCss,shellCss]=await Promise.all([
    read('apps/web/public/assets/routes/market-v6.mjs'),
    read('apps/web/public/assets/qelly-v53-real-market.css'),
    read('apps/web/public/assets/qelly-v53-production-shell-status.css')
  ]);
  assert.match(source,/q-market-principle/);
  assert.match(source,/Price is an observation; risk is a decision\./);
  assert.match(marketCss,/\.q-market-principle\{display:flex/);
  assert.match(marketCss,/\.q-page > \.q-page-head\{margin-bottom:0!important;padding-bottom:10px!important/);
  assert.match(marketCss,/\.q-product-nav\{border-top:0!important/);
  assert.match(shellCss,/\.q-product-nav\{[\s\S]*?border-top:0!important/);
});

test('legacy route guard no longer owns the Market route',async()=>{
  const source=await read('apps/web/public/assets/qelly-product-route-guard.mjs');
  assert.match(source,/Market is owned exclusively by the canonical V6\/V7 production renderer/);
  assert.doesNotMatch(source,/route==='market'\?'\.q-market-home'/);
  assert.doesNotMatch(source,/qellyProductHome/);
});

test('connectivity changes cannot replace the canonical Market renderer',async()=>{
  const source=await read('apps/web/public/assets/qelly-public-runtime.mjs');
  assert.match(source,/window\.addEventListener\('online',buildProductHeader\)/);
  assert.doesNotMatch(source,/addEventListener\('online',[\s\S]{0,180}renderMarketHomepage/);
  assert.match(source,/if\(route==='market'\)return/);
});

test('public recovery never invents market observations or deterministic crypto prices',async()=>{
  const source=await read('apps/web/public/assets/qelly-public-recovery.mjs');
  assert.match(source,/No fabricated recovery data/);
  assert.match(source,/No substitute price, candle, volume or market movement has been generated/);
  assert.match(source,/TradingView/);
  assert.match(source,/Forex Factory/);
  assert.doesNotMatch(source,/demoAssets|\$42,500|\$2,280|\$98\.40|\$312\.60|deterministic public market recovery/i);
});

test('legacy live-market API preserves provider-specific contracts while the public UI uses the network aggregator',async()=>{
  const [service,route,wrapper,ui]=await Promise.all([
    read('functions/_lib/live-markets.js'),
    read('functions/api/v1/live-markets/[[route]].js'),
    read('apps/web/public/assets/routes/live-markets.mjs'),
    read('apps/web/public/assets/routes/market-network.mjs')
  ]);
  assert.match(service,/binance:Object\.freeze\(\['1m','5m','15m','30m','1h','4h','1d'\]\)/);
  assert.match(service,/coinbase:Object\.freeze\(\['1m','5m','15m','1h','6h','1d'\]\)/);
  assert.doesNotMatch(service,/coinbase:Object\.freeze\([^\n]*'4h'/);
  assert.match(route,/routeName==='asset'/);
  assert.match(route,/liveMarketAsset/);
  assert.match(wrapper,/renderGlobalMarketNetwork/);
  assert.match(ui,/\/api\/v1\/market\/network/);
  assert.match(ui,/Coinbase \/ Binance blocked/);
  assert.doesNotMatch(ui,/\/api\/v1\/live-markets\/candles\?provider=/);
});

test('market route keeps long governed labels readable on narrow screens',async()=>{
  const css=await read('apps/web/public/assets/routes/market-v6.css');
  assert.match(css,/@media\(max-width:430px\)/);
  assert.match(css,/\.q-v7-public-market>\.q-page-head h1\{[^}]*overflow-wrap:anywhere!important/);
  assert.match(css,/\.q-page-actions\{display:grid!important;grid-template-columns:1fr!important/);
  assert.match(css,/\[data-v53-family-harmonization="active"\] #main \.q-v7-public-market \.q-v7-boundary-ribbon :where\(span,small\)\{[^}]*font-size:11px!important;overflow-wrap:anywhere!important/);
});
