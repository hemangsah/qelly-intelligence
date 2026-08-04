import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {providerCatalog,providerResult,__providerTest} from '../functions/_lib/providers.js';
import {__test as apiTest} from '../functions/api/v1/[[path]].js';

const baseEnv=()=>({
  QELLY_PUBLIC_SITE_URL:'https://qelly-intelligence.pages.dev',
  QELLY_PUBLIC_SUPABASE_URL:'https://example.supabase.co',
  QELLY_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_test_key_long_enough_for_validation',
  QELLY_PUBLIC_RELEASE_SHA:'98a88d76bbba1017a40012aa2790213af6af485a'
});

test('provider catalogue blocks crypto providers pending redistribution rights',()=>{
  const catalog=providerCatalog();
  const binance=catalog.find(provider=>provider.id==='binance');
  const coinbase=catalog.find(provider=>provider.id==='coinbase');
  const ecb=catalog.find(provider=>provider.id==='ecb');
  assert.equal(binance.enabled,false);
  assert.equal(coinbase.enabled,false);
  assert.match(binance.termsState,/blocked/);
  assert.match(coinbase.termsState,/blocked/);
  assert.equal(ecb.enabled,true);
  assert.match(ecb.termsState,/conditionally_approved/);
  assert.ok(!catalog.some(provider=>provider.termsState==='approved_public_read_only'));
});

test('blocked providers return unavailable without making a network call',async()=>{
  let calls=0;
  const context={
    env:{__fetch:async()=>{calls+=1;throw new Error('network must not be called');}},
    waitUntil(){}
  };
  const result=await providerResult(context,'coinbase','quote','BTC-USD',{});
  assert.equal(calls,0);
  assert.equal(result.truthState,'unavailable');
  assert.equal(result.fallbackReason,'provider_end_user_display_rights_not_verified');
  assert.equal(result.data,null);
});

test('public truth mapping preserves cache state',()=>{
  assert.equal(apiTest.publicTruthState('live_provider'),'live');
  assert.equal(apiTest.publicTruthState('cached_provider'),'cached');
  assert.equal(apiTest.publicTruthState('stale_provider'),'stale');
  assert.equal(apiTest.publicTruthState('delayed_provider'),'delayed');
});

test('provider cache parameters ignore arbitrary query-string noise',()=>{
  const normalized=__providerTest.normalizedCacheParams('coinbase','candles',{
    interval:'1h',
    limit:'100',
    start:'2026-08-01T00:00:00.000Z',
    end:'2026-08-02T00:00:00.000Z',
    capability:'candles',
    symbol:'BTC-USD',
    attackerNoise:'different-on-every-request'
  });
  assert.deepEqual(normalized,{
    end:'2026-08-02T00:00:00.000Z',
    interval:'1h',
    limit:'100',
    start:'2026-08-01T00:00:00.000Z'
  });
});

test('direct Coinbase API response is truthful and performs no upstream fetch',async()=>{
  let calls=0;
  const env={...baseEnv(),__fetch:async()=>{calls+=1;throw new Error('network must not be called');}};
  const request=new Request('https://qelly-intelligence.pages.dev/api/v1/providers/coinbase?capability=quote&symbol=BTC-USD');
  const response=await apiTest.route({request,env,params:{path:['providers','coinbase']}});
  const body=await response.json();
  assert.equal(response.status,200);
  assert.equal(calls,0);
  assert.equal(body.truthState,'unavailable');
  assert.equal(body.fallbackReason,'provider_end_user_display_rights_not_verified');
});

test('public config declares unsupported production capabilities as disabled',async()=>{
  const request=new Request('https://qelly-intelligence.pages.dev/api/v1/config');
  const response=await apiTest.route({request,env:baseEnv(),params:{path:['config']}});
  const body=await response.json();
  assert.equal(response.status,200);
  assert.deepEqual(body.capabilityTruth,{
    passkeys:false,
    mfa:false,
    research:false,
    persistentJobs:false,
    productionNotifications:false,
    multiSessionManagement:false
  });
  assert.ok(body.states.includes('cached'));
});

test('login and passkey-center surfaces cannot call passkey APIs',async()=>{
  const [login,center]=await Promise.all([
    readFile(new URL('../apps/web/public/assets/routes/auth-login.mjs',import.meta.url),'utf8'),
    readFile(new URL('../apps/web/public/assets/routes/passkey-center.mjs',import.meta.url),'utf8')
  ]);
  for(const source of [login,center]){
    assert.doesNotMatch(source,/\/api\/v1\/auth\/passkeys/);
    assert.doesNotMatch(source,/navigator\.credentials\.(get|create)/);
  }
  assert.match(login,/Passkey sign-in unavailable/);
  assert.match(center,/Passkeys are unavailable/);
});
