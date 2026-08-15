import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {liveMarketCandles,liveMarketCatalog,liveMarketStatus} from '../functions/_lib/live-markets.js';

const routeSource=()=>readFile(new URL('../functions/api/v1/live-markets/[[route]].js',import.meta.url),'utf8');
const uiSource=()=>readFile(new URL('../apps/web/public/assets/routes/live-markets.mjs',import.meta.url),'utf8');
const lockCleanupSource=()=>readFile(new URL('../apps/web/public/assets/qelly-v53-lock-route-cleanup.mjs',import.meta.url),'utf8');

test('Pages live-market catalog exposes governed fixture and blocks unapproved crypto display rights',()=>{
  const catalog=liveMarketCatalog();
  const fixture=catalog.providers.find(provider=>provider.id==='fixture');
  const binance=catalog.providers.find(provider=>provider.id==='binance');
  const coinbase=catalog.providers.find(provider=>provider.id==='coinbase');
  assert.equal(fixture.enabled,true);
  assert.equal(fixture.realtimeAuthorized,false);
  assert.equal(binance.enabled,false);
  assert.equal(binance.realtimeAuthorized,false);
  assert.equal(binance.termsState,'blocked_pending_redistribution_rights');
  assert.equal(coinbase.enabled,false);
  assert.equal(coinbase.realtimeAuthorized,false);
  assert.equal(coinbase.termsState,'blocked_pending_written_end_user_display_permission');
  assert.equal(catalog.liveModeEnabled,false);
  assert.equal(catalog.guardrails.blockedProvidersNeverPresentedAsLive,true);
});

test('blocked Binance request produces explicit governed demonstration fallback, never live-public',async()=>{
  const result=await liveMarketCandles({}, {provider:'binance',symbol:'BTCUSDT',interval:'1m',limit:80,mode:'auto'});
  assert.equal(result.provider,'fixture');
  assert.equal(result.requestedProvider,'binance');
  assert.equal(result.points.length,80);
  assert.equal(result.source.mode,'simulated-demo');
  assert.equal(result.source.realtimeAuthorized,false);
  assert.equal(result.source.termsState,'blocked_pending_redistribution_rights');
  assert.match(result.source.fallbackReason,/redistribution_rights/i);
  assert.equal(result.guardrails.executionDisabled,true);
  assert.equal(result.guardrails.live,false);
});

test('fixture candle contract supplies the summary fields required by the production browser route',async()=>{
  const result=await liveMarketCandles({}, {provider:'fixture',symbol:'ETHUSDT',interval:'5m',limit:60,mode:'fixture'});
  assert.equal(result.points.length,60);
  for(const field of ['last','change','changePercent','high','low','volume'])assert.equal(typeof result.summary[field],'number',field);
  assert.equal(result.source.mode,'simulated-demo');
  assert.equal(result.guardrails.readOnly,true);
  assert.ok(result.points.every(point=>point.high>=Math.max(point.open,point.close)&&point.low<=Math.min(point.open,point.close)));
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

test('browser market workspace defaults to governed fixture and cannot stream without backend authorization',async()=>{
  const source=await uiSource();
  assert.match(source,/defaults=\{provider:fixture\.id/);
  assert.doesNotMatch(source,/coindcx/i);
  assert.match(source,/provider\.enabled\?'':' · rights blocked'/);
  assert.match(source,/data\.source\?\.mode!=='live-public'\|\|data\.source\?\.realtimeAuthorized!==true/);
  assert.match(source,/blocked or simulated observations as live/);
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
  assert.equal(status.mode,'governed-demo-fallback');
  assert.equal(status.execution,false);
});
