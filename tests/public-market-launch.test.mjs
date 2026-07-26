import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { PublicMarketService } from '../src/markets/public-market-service.mjs';
import { startServer } from '../src/server/server.mjs';

const ticker={symbol:'BTCUSDT',lastPrice:'81234.50',priceChangePercent:'2.25',openPrice:'79446.00',highPrice:'82100.00',lowPrice:'78200.00',volume:'12345.6',quoteVolume:'1002345678.90'};

test('public market service normalizes documented public ticker evidence',async()=>{
  const service=new PublicMarketService({enabled:true,fetchImpl:async()=>new Response(JSON.stringify(ticker),{status:200,headers:{'Content-Type':'application/json'}}),now:()=>new Date('2026-07-25T10:00:00Z')});
  const item=await service.asset('BTC');
  assert.equal(item.canonicalId,'QI-CRYPTO-BTC');
  assert.equal(item.price,81234.5);
  assert.equal(item.source.provider,'binance-public');
  assert.equal(item.source.qualityState,'live-public');
  assert.equal(item.source.degraded,false);
  assert.equal(item.marketCap,null);
  assert.match(item.marketCapDefinition,/does not fabricate/i);
});

test('public market service labels deterministic fallback instead of calling it live',async()=>{
  const service=new PublicMarketService({enabled:true,fetchImpl:async()=>{throw new Error('network unavailable')},now:()=>new Date('2026-07-25T10:00:00Z')});
  const result=await service.overview();
  assert.equal(result.mode,'simulated-fallback');
  assert.equal(result.items.length,6);
  assert.ok(result.items.every(item=>item.source.qualityState==='simulated'));
  assert.ok(result.items.every(item=>item.source.degraded===true));
  assert.match(result.truthBoundary,/simulated/i);
});

test('public market launch APIs work without an authenticated session',async()=>{
  const dir=await mkdtemp(path.join(os.tmpdir(),'qelly-public-market-'));
  const started=await startServer({port:0,runtimePath:dir,environment:{...process.env,NODE_ENV:'test',QELLY_PRODUCTION_FOUNDATION_ENABLED:'true',QELLY_PRODUCTION_IDENTITY_ENABLED:'true',QELLY_DEVELOPMENT_IDENTITY_ENABLED:'false',QELLY_DATABASE_MODE:'sqlite',QELLY_JOB_QUEUE_MODE:'database',QELLY_SESSION_SECRET:'public-market-test-session-secret-000000001',QELLY_PUBLIC_MARKET_DATA_ENABLED:'false',QELLY_LIVE_MARKET_ENABLED:'false'}});
  const base=`http://${started.host}:${started.port}`;
  try{
    const config=await (await fetch(base+'/api/v1/config')).json();
    assert.equal(config.defaultRoute,'market');
    assert.equal(config.productName,'Qelly Intelligence');
    assert.equal(config.productVersion,'0.9.0-preview.1');
    for(const endpoint of ['/api/v1/public/providers','/api/v1/public/markets/overview','/api/v1/public/markets/assets','/api/v1/public/markets/assets/QI-CRYPTO-BTC','/api/v1/public/markets/assets/QI-CRYPTO-BTC/candles']){
      const response=await fetch(base+endpoint);
      assert.equal(response.status,200,endpoint);
      assert.match(response.headers.get('content-type'),/application\/json/);
    }
    const overview=await (await fetch(base+'/api/v1/public/markets/overview')).json();
    assert.equal(overview.mode,'simulated-fallback');
    assert.ok(overview.items.every(item=>item.source.qualityState==='simulated'));
  }finally{
    await new Promise(resolve=>started.server.close(resolve));
    started.runtime.productionRepository?.close?.();
    await rm(dir,{recursive:true,force:true});
  }
});

test('public launch frontend exposes market routes without release-only branding',async()=>{
  const [registry,index,app]=await Promise.all([
    readFile(new URL('../apps/web/public/assets/route-registry.mjs',import.meta.url),'utf8'),
    readFile(new URL('../apps/web/public/index.html',import.meta.url),'utf8'),
    readFile(new URL('../apps/web/public/assets/app.js',import.meta.url),'utf8')
  ]);
  for(const route of ['market','asset-rankings','asset','about-qelly'])assert.match(registry,new RegExp(`route:'${route}'.*public:true`));
  assert.doesNotMatch(index,/Release A5/i);
  assert.match(index,/READ ONLY/);
  assert.match(app,/\/api\/v1\/public\/markets\/overview/);
  assert.match(app,/case 'asset-rankings': await renderRankings\(main\)/);
  assert.doesNotMatch(app,/case 'asset-rankings': await renderAssetRankings\(main\)/);
  assert.match(app,/No fixture value is labelled live/);
});
