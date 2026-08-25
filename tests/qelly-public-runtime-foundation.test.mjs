import test from 'node:test';
import assert from 'node:assert/strict';
import {parsePublicRuntimeConfig,assertNoBrowserSecrets,buildSecurityHeaders,enforceCsrf,escapeCsvCell,safeJsonParse,validateImportFile,SlidingWindowRateLimiter,verifyTurnstileToken,ProviderGateway,LocalFirstSyncEngine,assessQuota} from '../src/public-runtime/foundation.mjs';

test('config defaults to truthful deterministic fallback and redacts secrets',()=>{
  const config=parsePublicRuntimeConfig({QELLY_SUPABASE_SERVICE_ROLE_KEY:'server-secret'});
  assert.equal(config.mode,'local-only');
  assert.equal(config.public.cloudSyncAvailable,false);
  assert.equal(JSON.stringify(config.public).includes('server-secret'),false);
  assert.throws(()=>assertNoBrowserSecrets('process.env.QELLY_SUPABASE_SERVICE_ROLE_KEY'));
});

test('strict cloud mode requires public and server-only credentials',()=>{
  assert.throws(()=>parsePublicRuntimeConfig({QELLY_CLOUD_MODE:'supabase',QELLY_PUBLIC_SUPABASE_URL:'https://example.supabase.co',QELLY_PUBLIC_SUPABASE_ANON_KEY:'anon'},{strictCloud:true}));
});

test('browser security and file boundaries reject malicious inputs',()=>{
  assert.match(buildSecurityHeaders()['Content-Security-Policy'],/frame-ancestors 'none'/);
  assert.throws(()=>enforceCsrf({method:'POST',origin:'https://evil.example',secFetchSite:'cross-site',allowlist:['https://qelly.example'],csrfHeader:'a',expectedCsrf:'a'}));
  assert.equal(escapeCsvCell('=HYPERLINK("bad")').includes("'=HYPERLINK"),true);
  assert.throws(()=>safeJsonParse('{"__proto__":{"polluted":true}}'));
  assert.equal(validateImportFile({name:'data.json',type:'application/json',size:20}),true);
  assert.throws(()=>validateImportFile({name:'data.exe',type:'application/json',size:20}));
});

test('rate limiter uses a bounded sliding window',()=>{
  const limiter=new SlidingWindowRateLimiter({limit:2,windowMs:1000});
  assert.equal(limiter.consume('u',1).allowed,true);
  assert.equal(limiter.consume('u',2).allowed,true);
  assert.equal(limiter.consume('u',3).allowed,false);
  assert.equal(limiter.consume('u',2000).allowed,true);
});

test('Turnstile validation verifies hostname and fails closed',async()=>{
  const fetchImpl=async()=>({ok:true,json:async()=>({success:true,hostname:'qelly.pages.dev'})});
  assert.equal((await verifyTurnstileToken({token:'t',secret:'s',expectedHostname:'qelly.pages.dev',fetchImpl})).success,true);
  assert.equal((await verifyTurnstileToken({token:'t',secret:'s',expectedHostname:'other.example',fetchImpl})).success,false);
});

test('provider gateway proves live truth then uses bounded cache',async()=>{
  let calls=0;
  const gateway=new ProviderGateway({clock:()=>Date.parse('2026-08-01T00:00:10Z')});
  gateway.register({id:'official-public',termsState:'approved_public_read_only',capabilities:['quote'],attribution:'Official Public API',license:'provider terms',ttlMs:60_000,fetch:async()=>{calls+=1;return {truthState:'live_provider',observationTime:'2026-08-01T00:00:09Z',data:{price:100}};}});
  const first=await gateway.request({providerId:'official-public',capability:'quote',sourceIdentifier:'BTC-USD'});
  const second=await gateway.request({providerId:'official-public',capability:'quote',sourceIdentifier:'BTC-USD'});
  assert.equal(first.truthState,'live_provider');
  assert.equal(second.truthState,'cached_provider');
  assert.equal(calls,1);
});

test('authorization-required provider never becomes a false live claim',async()=>{
  const gateway=new ProviderGateway();
  gateway.register({id:'needs-auth',termsState:'authorization_required',capabilities:['quote'],fetch:async()=>{throw new Error('must not run');}});
  const result=await gateway.request({providerId:'needs-auth',capability:'quote',sourceIdentifier:'X',fallback:{data:{price:1},truthState:'simulated_demonstration'}});
  assert.equal(result.truthState,'simulated_demonstration');
  assert.equal(result.fallbackReason,'provider_authorization_required');
});

test('local-first sync requires opt-in and rejects cross-user records',()=>{
  const engine=new LocalFirstSyncEngine({userId:'user-a'});
  engine.upsertLocal({id:'calc-1',payload:{result:42}});
  assert.equal(engine.nextBatch().length,0);
  engine.setCloudOptIn(true);
  engine.upsertLocal({id:'calc-1',payload:{result:43}});
  assert.equal(engine.nextBatch().length,1);
  assert.throws(()=>engine.applyRemote({id:'calc-2',ownerId:'user-b',revision:1,payload:{}}),/Cross-user/);
});

test('sync detects conflicts and requires an explicit resolution',()=>{
  const engine=new LocalFirstSyncEngine({userId:'user-a',cloudOptIn:true,clock:()=> '2026-08-01T00:00:00Z'});
  engine.upsertLocal({id:'calc-1',payload:{value:1},baseCloudRevision:1});
  const result=engine.applyRemote({id:'calc-1',ownerId:'user-a',revision:2,payload:{value:2},title:'remote'});
  assert.equal(result.status,'conflict');
  assert.equal(engine.resolveConflict('calc-1','keep-remote').payload.value,2);
});

test('free-tier governance suspends nonessential writes before exhaustion',()=>{
  const report=assessQuota({cloudflareWorkers:{requestsPerDay:96_000},supabase:{databaseBytes:490*1024*1024}});
  assert.equal(report.severity,'critical');
  assert.equal(report.checks.some((check)=>check.action==='stop-nonessential-writes'),true);
});
