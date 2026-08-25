import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=(path)=>readFile(new URL(`../${path}`,import.meta.url),'utf8');

test('Asset Rankings production route does not import deterministic crypto observations',async()=>{
  const source=await read('apps/web/public/assets/routes/asset-rankings-premium.mjs');
  assert.doesNotMatch(source,/asset-rankings-data|demonstrationRows|deterministicRows|deterministicOhlc|fixed scenario/i);
  assert.doesNotMatch(source,/\bmarketCap\s*:|\bopenInterest\s*:|\bfundingRate\s*:|\bliquidations?\s*:|\bprice\s*:\s*[0-9]/i);
  assert.doesNotMatch(source,/\$42,500|\$2,280|\$98\.40|\$312\.60|18420000000|9120000000/i);
  assert.match(source,/data-market-ranking-runtime="no-fabrication"/);
  assert.match(source,/Fabricated prices<\/span><strong>0/);
});

test('Asset Rankings visibly discloses provider-rights and ranking-feed availability',async()=>{
  const source=await read('apps/web/public/assets/routes/asset-rankings-premium.mjs');
  assert.match(source,/Governed production truth/);
  assert.match(source,/market ranking feed \$\{authorizedRankProviders\.length\?'authorized':'unavailable'\}/);
  assert.match(source,/Binance and Coinbase remain rights-blocked/);
  assert.match(source,/Rankings are being connected/);
  assert.match(source,/Qelly will publish rankings only after the required market-data permissions and source checks are complete/);
  assert.match(source,/Open research workspace/);
  assert.doesNotMatch(source,/Deterministic demonstration|Values are not live market observations|High agreement/);
});

test('Asset Rankings separates approved ECB reference coverage from rankings and exposes research exits',async()=>{
  const source=await read('apps/web/public/assets/routes/asset-rankings-premium.mjs');
  assert.match(source,/ECB euro reference-rate universe/);
  assert.match(source,/They are not re-labeled as asset rankings/);
  assert.match(source,/TradingView market overview/);
  assert.match(source,/CME markets/);
  assert.match(source,/Forex Factory/);
  assert.match(source,/data-ranking-boundary/);
  assert.match(source,/navigate\?\.\('decision-provenance'\)/);
});
