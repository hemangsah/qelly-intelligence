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
    if(String(url).includes('fiscaldata.treasury.gov'))return jsonResponse({data:[{record_date:'2026-07-31',security_type_desc:'Marketable',security_desc:'Treasury Bills',avg_interest_rate_amt:'3.758'}]});
    if(String(url).includes('imf.org/external/datamapper'))return jsonResponse({values:{NGDP_RPCH:{IND:{2026:6.4},USA:{2026:2.1}}}});
    throw new Error(`unexpected request ${url}`);
  };
  try{
    const network=await buildExternalMarketNetwork();
    assert.equal(network.policy.fabricatedFallback,false);
    assert.equal(network.policy.execution,false);
    assert.equal(network.policy.responseCacheSeconds,10);
    assert.equal(network.policy.staleWhileRevalidateSeconds,30);
    assert.deepEqual(network.policy.sourceCacheSeconds,{hyperliquid:8,'alternative-me':60,'world-bank':3600,'us-treasury':21600,imf:21600});
    assert.equal(network.policy.edgeCacheScope,'cloudflare_point_of_presence');
    assert.equal(network.sources['alternative-me'].data.assets[0].priceUsd,65000);
    assert.equal(network.sources.hyperliquid.data[0].symbol,'BTC');
    assert.equal(network.sources['world-bank'].data[0].gdpGrowthPct,6.5);
    assert.equal(network.sources['us-treasury'].data[0].averageInterestRatePct,3.758);
    assert.equal(network.sources.imf.data[0].countryId,'IND');
    assert.ok(network.providerDirectory.length>175);
    assert.equal(network.providerDirectorySummary.total,network.providerDirectory.length);
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
    assert.equal(network.sources['us-treasury'].state,'unavailable');
    assert.equal(network.sources.imf.state,'unavailable');
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
