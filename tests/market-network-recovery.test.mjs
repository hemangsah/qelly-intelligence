import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {buildExternalMarketNetwork} from '../functions/_lib/market-network.js';

const jsonResponse=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}});

test('global market network aggregates only explicit external/reference sources and never fabricates fallback values',async()=>{
  const originalFetch=globalThis.fetch;
  const calls=[];
  globalThis.fetch=async(url,options={})=>{
    calls.push({url:String(url),method:options.method||'GET'});
    if(String(url).includes('alternative.me/v2/ticker'))return jsonResponse({data:[{id:'1',name:'Bitcoin',symbol:'BTC',rank:1,last_updated:1770000000,quotes:{USD:{price:65000,market_cap:1000000000,volume_24h:25000000,percentage_change_24h:1.25}}}]});
    if(String(url).includes('alternative.me/fng'))return jsonResponse({data:[{value:'42',value_classification:'Fear',timestamp:'1770000000'}]});
    if(String(url).includes('hyperliquid.xyz/info'))return jsonResponse({BTC:'65001',ETH:'3500',HYPE:'40'});
    if(String(url).includes('api.worldbank.org'))return jsonResponse([{page:1},[{countryiso3code:'IND',country:{value:'India'},date:'2025',value:6.5}]]);
    throw new Error(`unexpected request ${url}`);
  };
  try{
    const network=await buildExternalMarketNetwork();
    assert.equal(network.policy.fabricatedFallback,false);
    assert.equal(network.policy.execution,false);
    assert.equal(network.policy.cacheSeconds,90);
    assert.equal(network.policy.staleWhileRevalidateSeconds,900);
    assert.equal(network.sources['alternative-me'].data.assets[0].priceUsd,65000);
    assert.equal(network.sources.hyperliquid.data[0].symbol,'BTC');
    assert.equal(network.sources['world-bank'].data[0].gdpGrowthPct,6.5);
    assert.equal(calls.some((entry)=>entry.url.includes('coinpaprika')),false);
    assert.equal(calls.some((entry)=>entry.url.includes('coinmarketcap')),false);
    assert.equal(calls.some((entry)=>entry.url.includes('defillama')),false);
  }finally{globalThis.fetch=originalFetch;}
});

test('upstream failures remain unavailable instead of becoming generated market observations',async()=>{
  const originalFetch=globalThis.fetch;
  globalThis.fetch=async()=>{throw new Error('offline');};
  try{
    const network=await buildExternalMarketNetwork();
    assert.equal(network.sources['alternative-me'].state,'unavailable');
    assert.equal(network.sources.hyperliquid.state,'unavailable');
    assert.equal(network.sources['world-bank'].state,'unavailable');
    assert.equal(network.policy.sourceFailuresRemainUnavailable,true);
    assert.equal(JSON.stringify(network).includes('simulated-demo'),false);
  }finally{globalThis.fetch=originalFetch;}
});

test('market terminal exposes cross-asset display and explicit research/license boundaries',async()=>{
  const route=await readFile(new URL('../apps/web/public/assets/routes/market-network.mjs',import.meta.url),'utf8');
  const helper=await readFile(new URL('../functions/_lib/market-network.js',import.meta.url),'utf8');
  const widget=await readFile(new URL('../apps/web/public/assets/market/tradingview-display-widget.mjs',import.meta.url),'utf8');
  assert.match(route,/Global Market Network/);
  assert.match(route,/Fabricated fallback/);
  assert.match(route,/CoinPaprika Free is not used for commercial production redistribution/);
  for(const symbol of ['XAUUSD','EURUSD','USDINR','SPX','NIFTY','HSI','NI225','USOIL'])assert.match(widget,new RegExp(symbol));
  assert.match(helper,/Alternative\.me/);
  assert.match(helper,/Hyperliquid/);
  assert.match(helper,/World Bank/);
  assert.match(helper,/CoinMarketCap/);
  assert.match(helper,/DefiLlama/);
  assert.doesNotMatch(helper,/api\.coinpaprika\.com/);
  assert.doesNotMatch(helper,/pro-api\.coinmarketcap\.com/);
});

test('all-screen evidence server owns market network with a deterministic empty no-fabrication fixture',async()=>{
  const source=await readFile(new URL('../scripts/release-a5-evidence-server.mjs',import.meta.url),'utf8');
  assert.match(source,/function evidenceMarketNetwork\(\)/);
  assert.match(source,/url\.pathname==='\/api\/v1\/market\/network'/);
  assert.match(source,/evidence_runtime_external_network_isolated/);
  assert.match(source,/fabricatedFallback:false/);
  assert.match(source,/sourceFailuresRemainUnavailable:true/);
  assert.match(source,/deterministic-empty-contract-no-market-observations/);
});
