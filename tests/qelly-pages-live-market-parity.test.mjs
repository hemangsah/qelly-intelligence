import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {__liveMarketTest,liveMarketStatus} from '../functions/_lib/live-markets.js';

const routeSource=()=>readFile(new URL('../functions/api/v1/live-markets/[[route]].js',import.meta.url),'utf8');
const uiSource=()=>readFile(new URL('../apps/web/public/assets/routes/market-network.mjs',import.meta.url),'utf8');
const wrapperSource=()=>readFile(new URL('../apps/web/public/assets/routes/live-markets.mjs',import.meta.url),'utf8');
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

test('Pages route restores all Part 22 live-market compatibility endpoints behind authenticated session resolution',async()=>{
  const source=await routeSource();
  assert.match(source,/resolveSession\(request,env,\{required:true\}\)/);
  assert.match(source,/routeName==='catalog'/);
  assert.match(source,/routeName==='status'/);
  assert.match(source,/routeName==='asset'/);
  assert.match(source,/routeName==='candles'/);
  assert.match(source,/routeName==='ticker'/);
  assert.match(source,/method!=='GET'/);
});

test('public browser market workspace uses the rights-aware market network and keeps TradingView display-only',async()=>{
  const [source,wrapper]=await Promise.all([uiSource(),wrapperSource()]);
  assert.match(wrapper,/renderGlobalMarketNetwork/);
  assert.match(source,/\/api\/v1\/market\/network/);
  assert.doesNotMatch(source,/coindcx|governed demo|Demonstration watch universe/i);
  assert.match(source,/Coinbase \/ Binance blocked/);
  assert.match(source,/No fabricated fallback values/);
  assert.match(source,/TradingView is an external display boundary/);
  assert.match(source,/Qelly does not scrape or reuse widget values/);
  assert.doesNotMatch(source,/\/api\/v1\/live-markets\/candles/);
});

test('dedicated live-market implementation cannot be covered by the synthetic V5.3 lock candidate',async()=>{
  const source=await lockCleanupSource();
  assert.match(source,/DEDICATED_REAL_ROUTES=new Set\(\[[^\]]*'live-markets'[^\]]*\]\)/);
  assert.match(source,/synthetic&&isDedicatedRealRoute\(\)/);
  assert.match(source,/clearLockState\(\)/);
});

test('legacy live-market status reflects rights-authorized state instead of configuration fiction',()=>{
  const status=liveMarketStatus();
  assert.equal(status.enabled,false);
  assert.equal(status.mode,'unavailable-no-authorized-provider');
  assert.equal(status.execution,false);
  assert.equal(status.fabricatedFallback,false);
});
