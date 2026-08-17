import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const wrapper=await readFile(new URL('../apps/web/public/assets/routes/live-markets.mjs',import.meta.url),'utf8');
const source=await readFile(new URL('../apps/web/public/assets/routes/market-network.mjs',import.meta.url),'utf8');
const provider=await readFile(new URL('../functions/_lib/market-network.js',import.meta.url),'utf8');

test('live-markets route delegates to the rights-aware Global Market Network without a second renderer owner',()=>{
  assert.match(wrapper,/import \{renderGlobalMarketNetwork\} from '\.\/market-network\.mjs'/);
  assert.match(wrapper,/export async function renderLiveMarkets/);
  assert.match(wrapper,/return renderGlobalMarketNetwork\(main,deps\)/);
  assert.doesNotMatch(wrapper,/renderLiveMarkets[\s\S]*innerHTML/);
});

test('Global Market Network keeps external display separate from governed analytical observations',()=>{
  assert.match(source,/TradingView is an external display boundary/);
  assert.match(source,/Qelly does not scrape or reuse widget values/);
  assert.match(source,/Provider provenance/);
  assert.match(source,/ECB governed FX reference/);
  assert.match(source,/Coinbase \/ Binance blocked/);
  assert.match(source,/Fabricated fallback/);
  assert.match(source,/>OFF</);
  assert.doesNotMatch(source,/\/api\/v1\/live-markets\/candles/);
});

test('market network never substitutes fabricated prices or unrestricted-provider fiction',()=>{
  assert.match(source,/No fabricated fallback values/);
  assert.match(source,/No unrestricted-data fiction/);
  assert.match(source,/CoinPaprika Free is not used for commercial production redistribution/);
  assert.match(source,/CoinMarketCap keyless access is treated as evaluation\/prototype access/);
  assert.match(provider,/sourceFailuresRemainUnavailable:true/);
  assert.match(provider,/fabricatedFallback:false/);
  assert.doesNotMatch(`${source}\n${provider}`,/simulated-demo|qelly-governed-demo|Demonstration watch universe/i);
  assert.doesNotMatch(source,/₹65\.1L|₹3\.42L|₹63,100|₹17,450|₹268|₹92/);
});
