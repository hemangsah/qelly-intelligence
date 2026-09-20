import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {onRequest,__test} from '../functions/api/v1/formula-screener.js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');

function candles({asset='BTC',count=120}={}){
  const now=Date.now();
  const base={BTC:60_000,ETH:3_000,SOL:150,HYPE:40,XRP:.7,DOGE:.14}[asset]||100;
  return Array.from({length:count},(_,index)=>{
    const t=now-(count-1-index)*3_600_000;
    const drift=index*.0012;
    const wave=Math.sin(index/5)*.004;
    const open=base*(1+drift+wave);
    const close=open*(1+.0015+Math.sin(index/7)*.001);
    const high=Math.max(open,close)*1.004;
    const low=Math.min(open,close)*.996;
    return {t,o:open,h:high,l:low,c:close,v:1000+index*7,n:25+index};
  });
}

function providerFetch({fail=false,calls=[]}={}){
  return async (url,options={})=>{
    calls.push({url:String(url),options});
    if(fail)return new Response(JSON.stringify({error:'unavailable'}),{status:503,headers:{'content-type':'application/json'}});
    const body=JSON.parse(options.body||'{}');
    const asset=body?.req?.coin||'BTC';
    return new Response(JSON.stringify(candles({asset})),{status:200,headers:{'content-type':'application/json'}});
  };
}

function request(method='GET',body,ip='203.0.113.10'){
  return new Request('https://terminal.qellyintelligence.com/api/v1/formula-screener',{
    method,
    headers:{'content-type':'application/json','cf-connecting-ip':ip},
    body:body===undefined?undefined:JSON.stringify(body)
  });
}

test('anonymous catalog is public, bounded, and contains the approved universe',async()=>{
  const response=await onRequest({request:request('GET',undefined,'203.0.113.11'),env:{}});
  const payload=await response.json();
  assert.equal(response.status,200);
  assert.deepEqual(payload.assets,['BTC','ETH','SOL','HYPE','XRP','DOGE']);
  assert.deepEqual(payload.formulas.map(item=>item.id),['momentum_quality','trend_efficiency','rsi_impulse']);
  assert.equal(payload.boundaries.customExpressions,false);
  assert.equal(payload.boundaries.arbitraryCode,false);
  assert.equal(payload.boundaries.arbitrarySql,false);
  assert.equal(payload.boundaries.providerProxy,false);
  assert.equal(payload.boundaries.privilegedState,false);
});

test('anonymous live evaluation uses Hyperliquid candleSnapshot and returns ranked provider-derived rows',async()=>{
  const calls=[];
  const response=await onRequest({
    request:request('POST',{formula:'momentum_quality',assets:['BTC','ETH','SOL']},'203.0.113.12'),
    env:{__fetch:providerFetch({calls})}
  });
  const payload=await response.json();
  assert.equal(response.status,200);
  assert.equal(payload.fabricatedFallback,false);
  assert.equal(payload.state,'live');
  assert.equal(payload.available,3);
  assert.equal(payload.rows.length,3);
  assert.ok(payload.rows.every(row=>row.state==='available'&&row.source.provider==='Hyperliquid'&&row.source.observedAt));
  assert.ok(payload.rows.every(row=>Number.isFinite(row.value)));
  assert.ok(calls.every(call=>call.url==='https://api.hyperliquid.xyz/info'));
  assert.ok(calls.every(call=>JSON.parse(call.options.body).type==='candleSnapshot'));
  assert.deepEqual([...payload.rows].sort((a,b)=>b.value-a.value).map(row=>row.asset),payload.rows.map(row=>row.asset));
});

test('unsupported assets, formulas, and custom expressions fail closed',async()=>{
  const env={__fetch:providerFetch()};
  const unsupportedAsset=await onRequest({request:request('POST',{formula:'momentum_quality',assets:['BTC','ADA']},'203.0.113.13'),env});
  assert.equal(unsupportedAsset.status,400);
  assert.equal((await unsupportedAsset.json()).error.code,'unsupported_asset');

  const unsupportedFormula=await onRequest({request:request('POST',{formula:'arbitrary_ratio',assets:['BTC']},'203.0.113.14'),env});
  assert.equal(unsupportedFormula.status,400);
  assert.equal((await unsupportedFormula.json()).error.code,'unsupported_formula');

  const expression=await onRequest({request:request('POST',{formula:'momentum_quality',assets:['BTC'],expression:'price / secret'},'203.0.113.15'),env});
  assert.equal(expression.status,400);
  assert.equal((await expression.json()).error.code,'custom_expression_not_supported');
});

test('provider outage returns a retryable 503 without a fallback result',async()=>{
  const response=await onRequest({
    request:request('POST',{formula:'trend_efficiency',assets:['BTC','ETH']},'203.0.113.16'),
    env:{__fetch:providerFetch({fail:true})}
  });
  const payload=await response.json();
  assert.equal(response.status,503);
  assert.equal(payload.error.code,'provider_unavailable');
  assert.equal(payload.error.retryable,true);
  assert.equal(payload.rows,undefined);
});

test('public endpoint enforces per-client rate limits',async()=>{
  const ip='203.0.113.199';
  for(let index=0;index<20;index++){
    const response=await onRequest({request:request('GET',undefined,ip),env:{}});
    assert.equal(response.status,200);
  }
  const limited=await onRequest({request:request('GET',undefined,ip),env:{}});
  const payload=await limited.json();
  assert.equal(limited.status,429);
  assert.equal(payload.error.code,'rate_limited');
  assert.equal(payload.error.retryable,true);
});

test('frontend uses only the public live contract and retains consumer-facing truth',async()=>{
  const [route,registry,endpoint,styles]=await Promise.all([
    readFile(path.join(root,'apps/web/public/assets/routes/formula-screener.mjs'),'utf8'),
    readFile(path.join(root,'apps/web/public/assets/route-registry.mjs'),'utf8'),
    readFile(path.join(root,'functions/api/v1/formula-screener.js'),'utf8'),
    readFile(path.join(root,'apps/web/public/assets/app.css'),'utf8')
  ]);
  assert.match(route,/\/api\/v1\/formula-screener/);
  assert.doesNotMatch(route,/screeners\/formulas/);
  assert.doesNotMatch(route,/fixture|deterministic universe|numeric fixture fields|ACCOUNT REQUIRED|private Qelly workspace/i);
  assert.match(route,/Freshness/);
  assert.match(route,/Observed/);
  assert.match(route,/Retry/);
  assert.match(registry,/route:'formula-screener'.*public:true/);
  assert.doesNotMatch(endpoint,/service[_-]?role|supabase|eval\s*\(|new Function|Function\s*\(/i);
  assert.doesNotMatch(endpoint,/api\.hyperliquid\.xyz\/info.*\+|new URL\([^)]*provider/i);
  assert.match(styles,/#formula-grid \.q-grid-scroll\{overflow-x:hidden/);
  assert.match(styles,/#formula-grid \.q-data-grid table\{width:100%;min-width:0;table-layout:fixed\}/);
  assert.deepEqual(__test.ASSETS,['BTC','ETH','SOL','HYPE','XRP','DOGE']);
});
