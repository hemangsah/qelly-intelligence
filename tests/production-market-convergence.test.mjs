import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseHashRoute} from '../apps/web/public/assets/hash-route-state.mjs';

const source=(relative)=>readFileSync(new URL(`../${relative}`,import.meta.url),'utf8');

test('production market route resolves to the source-backed global market network',()=>{
  const previous=globalThis.window;
  try{
    delete globalThis.window;
    assert.equal(parseHashRoute('#/market').route,'live-markets');
    assert.equal(parseHashRoute('').route,'live-markets');
  }finally{
    if(previous===undefined)delete globalThis.window;
    else globalThis.window=previous;
  }
});

test('static visual preview preserves the legacy market frame for design evidence',()=>{
  const previous=globalThis.window;
  try{
    globalThis.window={__QELLY_CONFIG__:{staticVisualPreview:true}};
    assert.equal(parseHashRoute('#/market').route,'market');
  }finally{
    if(previous===undefined)delete globalThis.window;
    else globalThis.window=previous;
  }
});

test('authenticated market overview exposes a real macro contract without fabricated fallback',()=>{
  const api=source('functions/api/v1/[[path]].js');
  assert.match(api,/macroObservation/);
  assert.match(api,/label:'BTC'/);
  assert.match(api,/label:'Fear & Greed'/);
  assert.match(api,/fabricatedFallback:false/);
  assert.match(api,/deterministicLocal:false/);
});

test('institutional research dock contains professional official destinations',()=>{
  const network=source('functions/_lib/market-network.js');
  for(const required of [
    'https://www.tradingview.com/',
    'https://www.forexfactory.com/calendar',
    'https://www.cmegroup.com/markets.html',
    'https://fred.stlouisfed.org/',
    'https://www.sec.gov/search-filings',
    'https://data.rbi.org.in/',
    'https://www.nseindia.com/market-data',
    'https://data.imf.org/en/'
  ])assert.match(network,new RegExp(required.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
  assert.match(network,/fabricatedFallback:false/);
  assert.match(network,/sourceFailuresRemainUnavailable:true/);
});
