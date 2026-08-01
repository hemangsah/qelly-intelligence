import test from 'node:test';
import assert from 'node:assert/strict';
import {createBinancePublicProvider,createCoinbaseExchangePublicProvider,createEcbReferenceRateProvider} from '../src/prompt2c/official-providers.mjs';

function jsonResponse(value,status=200){return new Response(JSON.stringify(value),{status,headers:{'content-type':'application/json'}});}

test('Binance public quote exposes official observation time and numeric provenance',async()=>{
  const provider=createBinancePublicProvider({fetchImpl:async(url)=>{assert.match(String(url),/\/api\/v3\/ticker\/24hr\?symbol=BTCUSDT/);return jsonResponse({closeTime:1785542400000,lastPrice:'65000.1',openPrice:'64000',highPrice:'66000',lowPrice:'63000',volume:'1000',quoteVolume:'65000000'});}});
  const result=await provider.fetch({capability:'quote',sourceIdentifier:'BTC-USDT'});
  assert.equal(result.truthState,'live_provider');
  assert.equal(result.data.price,65000.1);
  assert.equal(result.quality,'official-public-endpoint');
});

test('Binance rejects unbounded symbols and intervals',async()=>{
  const provider=createBinancePublicProvider({fetchImpl:async()=>jsonResponse([])});
  await assert.rejects(provider.fetch({capability:'quote',sourceIdentifier:'../../secret'}),/invalid_provider_symbol/);
  await assert.rejects(provider.fetch({capability:'candles',sourceIdentifier:'BTCUSDT',params:{interval:'2s'}}),/invalid_provider_interval/);
});

test('Coinbase Exchange candles are normalized in chronological order and capped',async()=>{
  const provider=createCoinbaseExchangePublicProvider({fetchImpl:async(url,options)=>{assert.match(String(url),/\/products\/BTC-USD\/candles/);assert.equal(options.headers['User-Agent'],'Qelly-Public-Beta/1.0');return jsonResponse([[200,2,5,3,4,10],[100,1,4,2,3,9]]);}});
  const result=await provider.fetch({capability:'candles',sourceIdentifier:'BTC-USD',params:{interval:'1h',limit:999}});
  assert.equal(result.truthState,'live_provider');
  assert.equal(result.data.candles.length,2);
  assert.ok(result.data.candles[0].time<result.data.candles[1].time);
  assert.match(result.quality,/may-have-gaps/);
});

test('ECB rates are delayed official reference data rather than false live quotes',async()=>{
  const xml=`<Envelope><Cube><Cube time='2026-08-01'><Cube currency='USD' rate='1.14'/><Cube currency='GBP' rate='0.85'/><Cube currency='JPY' rate='186.4'/><Cube currency='INR' rate='99.5'/><Cube currency='CHF' rate='0.93'/></Cube></Cube></Envelope>`;
  const provider=createEcbReferenceRateProvider({fetchImpl:async()=>new Response(xml,{status:200,headers:{'content-type':'application/xml'}})});
  const result=await provider.fetch({capability:'fx-reference-rates'});
  assert.equal(result.truthState,'delayed_provider');
  assert.equal(result.data.base,'EUR');
  assert.equal(result.data.rates.INR,99.5);
  assert.match(provider.license,/transaction use is discouraged/);
});

test('ECB incomplete or undated payload fails closed',async()=>{
  const provider=createEcbReferenceRateProvider({fetchImpl:async()=>new Response('<xml/>',{status:200})});
  await assert.rejects(provider.fetch({capability:'fx-reference-rates'}),/observation_time_missing/);
});
