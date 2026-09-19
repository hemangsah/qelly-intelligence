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

test('Global Market Network keeps external display separate from attributed analytical observations',()=>{
  assert.match(source,/TradingView is a display-only research surface/);
  assert.match(source,/Widget values are not used in Qelly calculations, alerts or decisions/);
  assert.match(source,/Source details/);
  assert.match(source,/ECB governed FX reference/);
  assert.match(source,/Data reliability/);
  assert.match(source,/Source lineage/);
  assert.match(source,/Synthetic market values/);
  assert.match(source,/Trading execution/);
  assert.match(source,/Unavailable sources/);
  assert.match(source,/>OFF</);
  for(const internal of [/Production truth/,/Connected runtime policy/,/Internal execution/,/Crypto provider rights/,/Coinbase \/ Binance blocked/,/Provider policy/,/Permitted use/,/Provider provenance/,/governed market orientation/])assert.doesNotMatch(source,internal);
  assert.doesNotMatch(source,/\/api\/v1\/live-markets\/candles/);
});

test('market network never substitutes fabricated prices or unrestricted-provider fiction',()=>{
  assert.match(source,/Never generated to fill missing price, candle, volume or market movement/);
  assert.match(source,/Missing or unavailable sources stay unavailable/);
  assert.match(source,/ECB observations are official reference rates, not executable market prices/);
  assert.doesNotMatch(source,/unrestricted-data fiction|CoinPaprika Free|CoinMarketCap keyless access/i);
  assert.match(provider,/sourceFailuresRemainUnavailable:true/);
  assert.match(provider,/fabricatedFallback:false/);
  assert.doesNotMatch(`${source}\n${provider}`,/simulated-demo|qelly-governed-demo|Demonstration watch universe/i);
  assert.doesNotMatch(source,/₹65\.1L|₹3\.42L|₹63,100|₹17,450|₹268|₹92/);
});
