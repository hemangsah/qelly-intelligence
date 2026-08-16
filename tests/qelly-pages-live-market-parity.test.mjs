import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {liveMarketCandles,liveMarketCatalog,liveMarketStatus} from '../functions/_lib/live-markets.js';

const routeSource=()=>readFile(new URL('../functions/api/v1/live-markets/[[route]].js',import.meta.url),'utf8');
const uiSource=()=>readFile(new URL('../apps/web/public/assets/routes/live-markets.mjs',import.meta.url),'utf8');
const lockCleanupSource=()=>readFile(new URL('../apps/web/public/assets/qelly-v53-lock-route-cleanup.mjs',import.meta.url),'utf8');

test('Pages live-market catalog exposes only governed provider policy and blocks unapproved crypto display rights',()=>{
  const catalog=liveMarketCatalog();
  const binance=catalog.providers.find(provider=>provider.id==='binance');
  const coinbase=catalog.providers.find(provider=>provider.id==='coinbase');
  assert.equal(catalog.providers.some(provider=>provider.id==='fixture'),false);
  assert.equal(binance.enabled,false);
  assert.equal(binance.realtimeAuthorized,false);
  assert.equal(binance.termsState,'blocked_pending_redistribution_rights');
  assert.equal(coinbase.enabled,false);
  assert.equal(coinbase.realtimeAuthorized,false);
  assert.equal(coinbase.termsState,'blocked_pending_written_end_user_display_permission');
  assert.equal(catalog.liveModeEnabled,false);
  assert.equal(catalog.guardrails.blockedProvidersNeverPresentedAsLive,true);
  assert.equal(catalog.guardrails.fabricatedFallback,false);
});

test('blocked Binance request produces explicit unavailable state with no substitute observations',async()=>{
  const result=await liveMarketCandles({}, {provider:'binance',symbol:'BTCUSDT',interval:'1m',limit:80});
  assert.equal(result.provider,'binance');
  assert.equal(result.requestedProvider,'binance');
  assert.equal(result.points.length,0);
  assert.equal(result.summary.last,null);
  assert.equal(result.source.mode,'unavailable');
  assert.equal(result.source.realtimeAuthorized,false);
  assert.equal(result.source.termsState,'blocked_pending_redistribution_rights');
  assert.match(result.source.fallbackReason,/redistribution_rights/i);
  assert.equal(result.guardrails.executionDisabled,true);
  assert.equal(result.guardrails.live,false);
  assert.equal(result.guardrails.fabricatedObservations,false);
});

test('retired fixture provider cannot manufacture candle summaries in the production compatibility layer',async()=>{
  const result=await liveMarketCandles({}, {provider:'fixture',symbol:'ETHUSDT',interval:'5m',limit:60});
  assert.equal(result.requestedProvider,'fixture');
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
  assert.match(source,/TradingView · display-only boundary/);
  assert.match(source,/TradingView values are not read, scraped, persisted or used by Qelly analytics/);
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
