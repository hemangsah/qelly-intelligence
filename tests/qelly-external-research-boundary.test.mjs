import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const source=await readFile(new URL('../apps/web/public/assets/routes/research-workspace.mjs',import.meta.url),'utf8');

test('research workspace exposes official external research launchers without automatic ingestion',()=>{
  assert.match(source,/https:\/\/www\.tradingview\.com\/chart\//);
  assert.match(source,/https:\/\/www\.forexfactory\.com\/calendar/);
  assert.match(source,/https:\/\/data\.ecb\.europa\.eu\/key-figures\/ecb-interest-rates-and-exchange-rates\/exchange-rates/);
  assert.match(source,/not automatically ingested into Qelly analytics/i);
  assert.match(source,/never turns its contents into Qelly evidence/i);
  assert.match(source,/no automatic ingestion/i);
  assert.match(source,/target="_blank"/);
  assert.match(source,/rel="noopener noreferrer"/);
});

test('external research boundary does not scrape, frame or execute third-party research code',()=>{
  assert.doesNotMatch(source,/<iframe\b/i);
  assert.doesNotMatch(source,/createElement\(['"]script['"]\)/i);
  assert.doesNotMatch(source,/fetch\(['"]https?:\/\/(?:www\.)?(?:tradingview\.com|forexfactory\.com|ecb\.europa\.eu)/i);
  assert.doesNotMatch(source,/innerHTML\s*=\s*[^;]*(?:tradingview|forexfactory)/i);
  assert.match(source,/display-and-outbound-only/);
});
