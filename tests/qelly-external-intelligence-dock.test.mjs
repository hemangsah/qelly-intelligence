import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {__externalIntelligenceTest,EXTERNAL_INTELLIGENCE_BOUNDARY,PROVIDER_PORTALS} from '../apps/web/public/assets/market/external-intelligence-widgets.mjs';
import {__marketV6Test} from '../apps/web/public/assets/routes/market-v6.mjs';

const read=(path)=>readFile(new URL(path,import.meta.url),'utf8');

test('external intelligence providers use official public display surfaces',()=>{
  assert.equal(__externalIntelligenceTest.HYPERLIQUID_WS_URL,'wss://api.hyperliquid.xyz/ws');
  assert.equal(__externalIntelligenceTest.COINMARKETCAP_WIDGET_SRC,'https://files.coinmarketcap.com/static/widget/coinPriceBlock.js');
  assert.equal(__externalIntelligenceTest.X_WIDGET_SRC,'https://platform.twitter.com/widgets.js');
  assert.match(EXTERNAL_INTELLIGENCE_BOUNDARY,/read-only external display/i);
  assert.match(EXTERNAL_INTELLIGENCE_BOUNDARY,/does not persist, replay, rank or use/i);
  for(const id of ['forex-factory','coinglass','hypurrscan','arkham','coinbase','binance','coindcx','ndtv-profit','youtube-finance','instagram','facebook'])assert.ok(PROVIDER_PORTALS.some((item)=>item.id===id));
  assert.match(PROVIDER_PORTALS.find(item=>item.id==='forex-factory').reason,/SAMEORIGIN/);
  assert.match(PROVIDER_PORTALS.find(item=>item.id==='arkham').reason,/X-Frame-Options: DENY/);
});

test('Hyperliquid live display subscribes only to public market structure channels',async()=>{
  const source=await read('../apps/web/public/assets/market/external-intelligence-widgets.mjs');
  assert.match(source,/subscription:\{type:'l2Book',coin:activeCoin\}/);
  assert.match(source,/subscription:\{type:'trades',coin:activeCoin\}/);
  assert.match(source,/method:'ping'/);
  assert.match(source,/window\.__WIDGET_INIT/);
  assert.match(source,/no wallet connection/i);
  assert.doesNotMatch(source,/localStorage|sessionStorage|indexedDB|document\.cookie/);
  assert.doesNotMatch(source,/apiKey|privateKey|seedPhrase|walletConnect/i);
});

test('Market Command exposes the lazy accessible intelligence dock',async()=>{
  const route=await read('../apps/web/public/assets/routes/market-v6.mjs');
  assert.deepEqual(__marketV6Test.INTELLIGENCE_DOCK_PANELS.map(item=>item.id),['hyperliquid','coinmarketcap','x-pulse','provider-portals']);
  for(const label of ['Live book & trades','CoinMarketCap','X market pulse','Research portals'])assert.match(route,new RegExp(label));
  for(const provider of ['Forex Factory','CoinGlass','HypurrScan','Arkham Intelligence','Coinbase','Binance','CoinDCX','NDTV Profit','YouTube Finance'])assert.ok(PROVIDER_PORTALS.some(item=>item.name===provider));
  assert.match(route,/data-external-intelligence-dock/);
  assert.match(route,/IntersectionObserver/);
  assert.match(route,/aria-label="Choose an external intelligence display"/);
  assert.match(route,/intelligenceDockHandle\?\.destroy\?\.\(\)/);
});
