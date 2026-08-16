import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');

test('production terminal shell never labels governed market data simulated',async()=>{
  const source=await read('apps/web/public/assets/qelly-v53-lock-shell.mjs');
  assert.match(source,/MARKET DATA · GOVERNED PROVIDER TRUTH/);
  assert.doesNotMatch(source,/SIMULATED REFERENCE DATA|Providers 5\/6/);
});

test('public Market Command is a no-fabrication external-display plus governed-reference surface',async()=>{
  const source=await read('apps/web/public/assets/routes/public-market-v7.mjs');
  assert.match(source,/\/api\/v1\/public\/markets\/overview/);
  assert.match(source,/\/api\/v1\/providers\/ecb\?capability=fx-reference-rates&symbol=EUR/);
  assert.match(source,/TradingView market visualization/);
  assert.match(source,/Forex Factory Calendar/);
  assert.match(source,/Fabricated fallback/);
  assert.match(source,/OFF/);
  assert.doesNotMatch(source,/Math\.sin|Math\.cos|qelly-governed-demo|simulated-demo/);
});

test('live market compatibility contract keeps provider-specific intervals and asset route',async()=>{
  const [service,route]=await Promise.all([
    read('functions/_lib/live-markets.js'),
    read('functions/api/v1/live-markets/[[route]].js')
  ]);
  assert.match(service,/binance:Object\.freeze\(\['1m','5m','15m','30m','1h','4h','1d'\]\)/);
  assert.match(service,/coinbase:Object\.freeze\(\['1m','5m','15m','1h','6h','1d'\]\)/);
  assert.doesNotMatch(service,/coinbase:Object\.freeze\([^\n]*'4h'/);
  assert.match(route,/routeName==='asset'/);
  assert.match(route,/liveMarketAsset/);
});
