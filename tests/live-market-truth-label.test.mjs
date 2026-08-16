import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../apps/web/public/assets/routes/live-markets.mjs', import.meta.url), 'utf8');

test('live market command exposes only rights-authorized internal providers', () => {
  assert.match(source, /const authorized=providers\.filter\(\(provider\)=>provider\.realtimeAuthorized===true&&provider\.enabled===true\)/);
  assert.match(source, /No rights-authorized provider/);
  assert.match(source, /Streaming unavailable/);
  assert.match(source, /rights blocked/);
  assert.doesNotMatch(source, /governed demo|Demonstration watch universe/i);
});

test('live market command keeps external display separate from Qelly analytical observations', () => {
  assert.match(source, /TradingView · display-only boundary/);
  assert.match(source, /TradingView values are not read, scraped, persisted or used by Qelly analytics/);
  assert.match(source, /Display reuse<\/span><strong>PROHIBITED/);
  assert.match(source, /External widget observations never become Qelly analytical inputs/);
});

test('market UI never substitutes fabricated prices or moves when internal feeds are unavailable', () => {
  assert.match(source, /No Qelly-generated fallback values/);
  assert.match(source, /Fabricated fallback<\/span><strong>OFF/);
  assert.match(source, /No synthetic market substitute/);
  assert.match(source, /Missing internal market data remains visibly unavailable/);
  assert.doesNotMatch(source, /₹65\.1L|₹3\.42L|₹63,100|₹17,450|₹268|₹92/);
  assert.doesNotMatch(source, /\+0\.58%|−0\.42%/);
});
