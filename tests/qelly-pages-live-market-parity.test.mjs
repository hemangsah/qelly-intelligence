import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {__liveMarketTest,liveMarketStatus} from '../functions/_lib/live-markets.js';

const routeSource=()=>readFile(new URL('../functions/api/v1/live-markets/[[route]].js',import.meta.url),'utf8');
const uiSource=()=>readFile(new URL('../apps/web/public/assets/routes/live-markets.mjs',import.meta.url),'utf8');
const lockCleanupSource=()=>readFile(new URL('../apps/web/public/assets/qelly-v53-lock-route-cleanup.mjs',import.meta.url),'utf8');

test('unsupported live-market provider stays unavailable and never fabricates observations',()=>{
  const result=__liveMarketTest.unavailableResult({requestedProvider:'unknown-provider',symbol:'TEST',interval:'1h',reason:'provider_not_supported'});
  assert.equal(result.provider,'unknown-provider');
  assert.equal(result.requestedProvider,'unknown-provider');
  assert.equal(result.points.length,0);
  for(const field of ['last','change','changePercent','high','low','volume'])assert.equal(result.summary[field],null,field);
  assert.equal(result.source.mode,'unavailable');
  assert.equal(result.source.fallbackReason,'provider_not_supported');
  assert.equal(result.guardrails.readOnly,true);
  assert.equal(result.guardrails.fabricatedObservations,false);
});

test('Pages route restores all Part 22 live-market endpoints behind authenticated session resolution',async()=>{
  const source=await routeSource();
  assert.match(source,/resolveSession\(request,env,\{required:true\}\)/);
  assert.match(source,/routeName==='catalog'/);
  assert.match(source,/routeName==='status'/);
  assert.match(source,/routeName==='asset'/);
  assert.match(source,/routeName==='candles'/);
  assert.match(source,/routeName==='ticker'/);
  assert.match(source,/method!=='GET'/);
});

test('browser market workspace selects only authorized providers and keeps TradingView display-only',async()=>{
  const source=await uiSource();
  assert.match(source,/authorized=providers\.filter\(\(provider\)=>provider\.realtimeAuthorized===true&&provider\.enabled===true\)/);
  assert.doesNotMatch(source,/coindcx|governed demo|Demonstration watch universe/i);
  assert.match(source,/rights blocked/);
  assert.match(source,/No Qelly-generated fallback values/);
  assert.match(source,/TradingView · isolated display boundary/);
  assert.match(source,/TradingView values are not read, scraped, persisted or used by Qelly analytics/);
  assert.match(source,/Provider symbol/);
  assert.match(source,/Provider interval/);
});

test('dedicated live-market implementation cannot be covered by the synthetic V5.3 lock candidate',async()=>{
  const source=await lockCleanupSource();
  assert.match(source,/DEDICATED_REAL_ROUTES=new Set\(\[[^\]]*'live-markets'[^\]]*\]\)/);
  assert.match(source,/synthetic&&isDedicatedRealRoute\(\)/);
  assert.match(source,/clearLockState\(\)/);
});

test('live-market status reflects rights-authorized state instead of configuration fiction',()=>{
  const status=liveMarketStatus();
  assert.equal(status.enabled,false);
  assert.equal(status.mode,'unavailable-no-authorized-provider');
  assert.equal(status.execution,false);
  assert.equal(status.fabricatedFallback,false);
});