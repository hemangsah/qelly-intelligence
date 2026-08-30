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
  assert.match(source,/attributed sample \$\{ranking\.state==='available'\?'available':'unavailable'\}/);
  assert.match(source,/Blocked feeds stay outside the ranking/);
  assert.match(source,/Missing required evidence/);
  assert.match(source,/Source ledger unavailable/);
  assert.match(source,/Open research workspace/);
  assert.doesNotMatch(source,/Deterministic demonstration|Values are not live market observations|High agreement/);
});

test('Asset Rankings separates approved ECB reference coverage from rankings and exposes research exits',async()=>{
  const source=await read('apps/web/public/assets/routes/asset-rankings-premium.mjs');
  assert.match(source,/ECB euro reference-rate universe/);
  assert.match(source,/remain visibly separate from candidate scores/);
  assert.match(source,/TradingView/);
  assert.match(source,/CME markets/);
  assert.match(source,/Forex Factory/);
  assert.match(source,/data-ranking-boundary/);
  assert.match(source,/not search, a recommendation engine or a trading surface/);
});
