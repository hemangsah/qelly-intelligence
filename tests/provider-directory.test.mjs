import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {providerDirectory,providerDirectorySummary} from '../functions/_lib/provider-directory.js';

test('provider directory is deduplicated and separates discovery from activation',()=>{
  const providers=providerDirectory();
  const ids=providers.map((item)=>item.id);
  assert.ok(providers.length>=183);
  assert.equal(new Set(ids).size,ids.length);
  assert.equal(providerDirectorySummary().total,providers.length);
  assert.equal(providers.every((item)=>item.source==='user-supplied-2026-08-28'),true);
  for(const name of ['Yahoo Finance','TradingView','US Treasury','IMF Data API','BLS (Bureau of Labor Statistics)','CoinGecko','DefiLlama','DhanHQ','Interactive Brokers India','WorldStock App']){
    assert.equal(providers.some((item)=>item.name===name),true,`${name} should be catalogued`);
  }
  assert.equal(providers.find((item)=>item.name==='TradingView').integration,'official-embed');
  assert.equal(providers.find((item)=>item.name==='CoinGecko').integration,'terms-review');
  assert.equal(providers.find((item)=>item.name==='US Treasury').integration,'delivery-review');
  assert.equal(providers.find((item)=>item.name==='FRED (Federal Reserve)').integration,'key-required');
  assert.equal(providers.find((item)=>item.name==='Bloomberg Terminal').integration,'paid-or-contract');
  assert.equal(providers.find((item)=>item.name==='DhanHQ').integration,'key-required');
  assert.equal(providers.find((item)=>item.name==='Binance').integration,'broker-or-exchange');
});

test('category-summary rows from the supplied documents are not misrepresented as providers',()=>{
  const summary=providerDirectorySummary();
  const names=new Set(providerDirectory().map((item)=>item.name));
  for(const label of summary.nonProviderRowsExcluded)assert.equal(names.has(label),false);
});

test('Market Command exposes a searchable complete atlas and governed public-data board',async()=>{
  const [route,css]=await Promise.all([
    readFile(new URL('../apps/web/public/assets/routes/market-v6.mjs',import.meta.url),'utf8'),
    readFile(new URL('../apps/web/public/assets/routes/market-v6.css',import.meta.url),'utf8')
  ]);
  assert.match(route,/api\('\/api\/v1\/market\/network'\)/);
  assert.match(route,/data-provider-atlas-search/);
  assert.match(route,/data-provider-atlas-filter/);
  assert.match(route,/Every named provider is discoverable here/);
  assert.match(route,/Reference observations are never presented as tradable quotes/);
  assert.match(route,/Slow reference providers load in the background and never block Market Command/);
  assert.match(route,/api\('\/api\/v1\/market\/network'\)\.then/);
  assert.doesNotMatch(route,/\[overviewResult,ecbResult,networkResult\]/);
  assert.match(route,/card\.hidden=!show/);
  assert.match(css,/\.q-provider-atlas-grid/);
  assert.match(css,/\.q-public-source-grid/);
});
