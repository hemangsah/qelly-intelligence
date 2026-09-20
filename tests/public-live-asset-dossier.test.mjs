import test from 'node:test';
import assert from 'node:assert/strict';
import {onRequest,__publicMarketTruthTest} from '../functions/api/v1/public/markets/[[route]].js';

function candles({count=180,base=60000}={}){
  const now=Date.now();
  return Array.from({length:count},(_,index)=>{
    const t=now-(count-1-index)*3_600_000;
    const open=base*(1+index*.0008+Math.sin(index/7)*.003);
    const close=open*(1+.001+Math.sin(index/9)*.0008);
    return {t,o:open,h:Math.max(open,close)*1.003,l:Math.min(open,close)*.997,c:close,v:1000+index,n:20+index};
  });
}

function providerFetch({fail=false,calls=[]}={}){
  return async (url,options={})=>{
    calls.push({url:String(url),options});
    if(fail)return new Response(JSON.stringify({error:'down'}),{status:503,headers:{'content-type':'application/json'}});
    return new Response(JSON.stringify(candles()),{status:200,headers:{'content-type':'application/json'}});
  };
}

function context(route,{url,fetchImpl,ip='203.0.113.44'}={}){
  const request=new Request(url||`https://terminal.qellyintelligence.com/api/v1/public/markets/${route.join('/')}`,{
    headers:{'cf-connecting-ip':ip}
  });
  return {
    request,
    env:{__fetch:fetchImpl||providerFetch()},
    params:{route},
    next:async()=>new Response('next',{status:418})
  };
}

test('Asset Dossier supports only the approved bounded live crypto universe',()=>{
  assert.deepEqual(__publicMarketTruthTest.LIVE_ASSETS.map((item)=>item.symbol),['BTC','ETH','SOL','XRP','HYPE','DOGE']);
  assert.equal(__publicMarketTruthTest.liveAsset('QI-CRYPTO-BTC').symbol,'BTC');
  assert.equal(__publicMarketTruthTest.liveAsset('eth').symbol,'ETH');
  assert.throws(()=>__publicMarketTruthTest.liveAsset('QI-CRYPTO-ADA'),/not currently available/i);
});

test('anonymous asset detail is provider-derived and contains no fabricated fallback',async()=>{
  const calls=[];
  const response=await onRequest(context(['assets','QI-CRYPTO-BTC'],{fetchImpl:providerFetch({calls})}));
  const payload=await response.json();
  assert.equal(response.status,200);
  assert.equal(payload.canonicalId,'QI-CRYPTO-BTC');
  assert.equal(payload.symbol,'BTC');
  assert.equal(payload.source.provider,'hyperliquid-public');
  assert.equal(payload.source.providerName,'Hyperliquid');
  assert.equal(payload.source.entitlement,'public-read');
  assert.equal(payload.fabricatedFallback,false);
  assert.ok(Number.isFinite(payload.price));
  assert.ok(Number.isFinite(payload.change24h));
  assert.ok(Number.isFinite(payload.high24h));
  assert.ok(Number.isFinite(payload.low24h));
  assert.ok(calls.every((call)=>call.url==='https://api.hyperliquid.xyz/info'));
  assert.ok(calls.every((call)=>JSON.parse(call.options.body).type==='candleSnapshot'));
});

test('anonymous candle endpoint returns bounded live candles and consumer source evidence',async()=>{
  const calls=[];
  const response=await onRequest(context(['assets','QI-CRYPTO-BTC','candles'],{
    url:'https://terminal.qellyintelligence.com/api/v1/public/markets/assets/QI-CRYPTO-BTC/candles?interval=1h&limit=168',
    fetchImpl:providerFetch({calls})
  }));
  const payload=await response.json();
  assert.equal(response.status,200);
  assert.equal(payload.mode,'live-public');
  assert.equal(payload.assetId,'QI-CRYPTO-BTC');
  assert.equal(payload.interval,'1h');
  assert.equal(payload.fabricatedFallback,false);
  assert.ok(payload.points.length>=24);
  assert.ok(payload.points.length<=168);
  assert.equal(payload.source.provider,'Hyperliquid');
  assert.equal(payload.guardrails.fabricatedObservations,false);
  const requestBody=JSON.parse(calls[0].options.body);
  assert.equal(requestBody.req.coin,'BTC');
  assert.equal(requestBody.req.interval,'1h');
});

test('asset route fails closed for unsupported assets and intervals',async()=>{
  const unsupported=await onRequest(context(['assets','QI-CRYPTO-ADA']));
  assert.equal(unsupported.status,404);
  assert.equal((await unsupported.json()).error.code,'asset_not_supported');

  const interval=await onRequest(context(['assets','QI-CRYPTO-BTC','candles'],{
    url:'https://terminal.qellyintelligence.com/api/v1/public/markets/assets/QI-CRYPTO-BTC/candles?interval=5m&limit=168'
  }));
  assert.equal(interval.status,400);
  assert.equal((await interval.json()).error.code,'unsupported_interval');
});

test('provider outage is retryable and never returns fixture rows',async()=>{
  const response=await onRequest(context(['assets','QI-CRYPTO-BTC'],{fetchImpl:providerFetch({fail:true})}));
  const payload=await response.json();
  assert.equal(response.status,503);
  assert.equal(payload.error.code,'provider_unavailable');
  assert.equal(payload.error.retryable,true);
  assert.equal(payload.price,undefined);
  assert.equal(payload.points,undefined);
});

test('governed overview remains deny-by-default for blocked provider catalog',async()=>{
  const response=await onRequest(context(['overview']));
  const payload=await response.json();
  assert.equal(response.status,200);
  assert.equal(payload.mode,'governed-only');
  assert.equal(payload.truthState,'UNAVAILABLE');
  assert.equal(payload.guardrails.fabricatedObservations,false);
  assert.ok(Array.isArray(payload.providers));
});
