import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {__publicMarketTruthTest} from '../functions/api/v1/public/markets/[[route]].js';
import {__liveMarketTest} from '../functions/_lib/live-markets.js';

test('canonical public market boundary explicitly refuses substitute observations',()=>{
  assert.match(__publicMarketTruthTest.MARKET_UNAVAILABLE_REASON,/does not generate substitute prices or candles/i);
  assert.match(__publicMarketTruthTest.DISPLAY_BOUNDARY,/does not ingest, scrape, persist or use widget values for analytics/i);
});

test('blocked authenticated market providers return an empty unavailable envelope',()=>{
  const result=__liveMarketTest.unavailableResult({requestedProvider:'binance',symbol:'BTCUSDT',interval:'5m',reason:'rights_not_confirmed',termsState:'blocked'});
  assert.equal(result.source.mode,'unavailable');
  assert.equal(result.source.realtimeAuthorized,false);
  assert.equal(result.points.length,0);
  assert.equal(result.summary.last,null);
  assert.equal(result.guardrails.live,false);
  assert.equal(result.guardrails.fabricatedObservations,false);
});

test('canonical Cloudflare market route contains no deterministic price or candle generator',async()=>{
  const source=await readFile(new URL('../functions/api/v1/public/markets/[[route]].js',import.meta.url),'utf8');
  assert.match(source,/fabricatedObservations:false/);
  assert.match(source,/points:\[\]/);
  assert.doesNotMatch(source,/Math\.sin|Math\.cos|basePrice|seeded|syntheticPrice|simulated-demo/i);
});
