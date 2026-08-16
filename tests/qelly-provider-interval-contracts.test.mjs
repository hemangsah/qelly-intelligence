import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const source=await readFile(new URL('../functions/_lib/providers.js',import.meta.url),'utf8');

test('Binance and Coinbase do not share incompatible candle interval maps',()=>{
  assert.match(source,/const BINANCE_INTERVALS=new Set\(\['1m','5m','15m','30m','1h','4h','1d'\]\)/);
  assert.match(source,/const COINBASE_GRANULARITY=new Map\(\[\['1m',60\],\['5m',300\],\['15m',900\],\['1h',3600\],\['6h',21600\],\['1d',86400\]\]\)/);
  assert.match(source,/if\(!BINANCE_INTERVALS\.has\(interval\)\)throw new HttpError\(400,'invalid_provider_interval','Invalid Binance interval'\)/);
  assert.match(source,/if\(!COINBASE_GRANULARITY\.has\(interval\)\)throw new HttpError\(400,'invalid_provider_interval','Invalid Coinbase interval'\)/);
});

test('Coinbase Exchange is never sent an unsupported four-hour granularity',()=>{
  const coinbaseSection=source.slice(source.indexOf("if(provider==='coinbase')"),source.indexOf("if(provider==='ecb')"));
  assert.doesNotMatch(coinbaseSection,/\['4h'|14400/);
  assert.match(coinbaseSection,/COINBASE_GRANULARITY\.get\(interval\)/);
});
