import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {providerCatalog,providerResult,__providerTest} from '../functions/_lib/providers.js';
import {__test as apiTest} from '../functions/api/v1/[[path]].js';
import {onRequest as configOnRequest} from '../functions/api/v1/config.js';
import {HttpError,errorResponse,requireOrigin,resolveSession,responseJson} from '../functions/_lib/runtime.js';

const baseEnv=()=>({
  QELLY_PUBLIC_SITE_URL:'https://qelly-intelligence.pages.dev',
  QELLY_PUBLIC_SUPABASE_URL:'https://example.supabase.co',
  QELLY_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_test_key_long_enough_for_validation',
  QELLY_PUBLIC_RELEASE_SHA:'98a88d76bbba1017a40012aa2790213af6af485a'
});
const encodeJwtPart=(value)=>Buffer.from(JSON.stringify(value)).toString('base64url');
const unsignedJwt=(claims)=>`${encodeJwtPart({alg:'none',typ:'JWT'})}.${encodeJwtPart(claims)}.signature`;
const setCookieText=(response)=>typeof response.headers.getSetCookie==='function'?response.headers.getSetCookie().join('\n'):String(response.headers.get('set-cookie')||'');

const refreshFixture=()=>{
  const userId='11111111-1111-4111-8111-111111111111';
  const now=Math.floor(Date.now()/1000);
  const issuer='https://example.supabase.co/auth/v1';
  const expiredAccess=unsignedJwt({iss:issuer,aud:'authenticated',exp:now-300,sub:userId});
  const freshAccess=unsignedJwt({iss:issuer,aud:'authenticated',exp:now+3600,sub:userId});
  const calls=[];
  const env={
    ...baseEnv(),
    __fetch:async(url,options={})=>{
      calls.push({url:String(url),options});
      if(String(url).endsWith('/auth/v1/token?grant_type=refresh_token'))return new Response(JSON.stringify({access_token:freshAccess,refresh_token:'new-refresh-token',expires_in:3600}),{status:200,headers:{'content-type':'application/json'}});
      if(String(url).endsWith('/auth/v1/user'))return new Response(JSON.stringify({id:userId,email:'user@example.com',user_metadata:{}}),{status:200,headers:{'content-type':'application/json'}});
      throw new Error(`Unexpected URL: ${url}`);
    }
  };
  const request=new Request('https://qelly-intelligence.pages.dev/api/v1/preferences/layout',{headers:{cookie:`qelly_sb_access=${encodeURIComponent(expiredAccess)}; qelly_sb_refresh=old-refresh-token`}});
  return {request,env,calls,freshAccess,userId};
};

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
  const context={env:{__fetch:async()=>{calls+=1;throw new Error('network must not be called');}},waitUntil(){}};
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
  assert.deepEqual(normalized,{end:'2026-08-02T00:00:00.000Z',interval:'1h',limit:'100',start:'2026-08-01T00:00:00.000Z'});
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
  const response=await configOnRequest({request,env:baseEnv(),params:{path:['config']},next:async()=>new Response(null,{status:404})});
  const body=await response.json();
  assert.equal(response.status,200);
  assert.deepEqual(body.capabilityTruth,{passkeys:false,mfa:false,research:false,persistentJobs:false,productionNotifications:false,multiSessionManagement:false});
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

test('expired sessions propagate rotated cookies on successful responses',async()=>{
  const {request,env,calls,freshAccess}=refreshFixture();
  const session=await resolveSession(request,env,{required:true});
  assert.equal(session.accessToken,freshAccess);
  const response=responseJson(request,env,{ok:true});
  const cookies=setCookieText(response);
  assert.match(cookies,/qelly_sb_access=/);
  assert.match(cookies,/qelly_sb_refresh=new-refresh-token/);
  assert.equal(calls.filter(call=>call.url.endsWith('/auth/v1/token?grant_type=refresh_token')).length,1);
});

test('expired sessions propagate rotated cookies even when downstream handling fails',async()=>{
  const {request,env}=refreshFixture();
  await resolveSession(request,env,{required:true});
  const response=errorResponse(request,env,new HttpError(409,'test_conflict','Conflict'));
  const body=await response.json();
  const cookies=setCookieText(response);
  assert.equal(response.status,409);
  assert.match(cookies,/qelly_sb_access=/);
  assert.match(cookies,/qelly_sb_refresh=new-refresh-token/);
  assert.equal(response.headers.get('x-correlation-id'),body.correlationId);
});

test('browser state changes from an unapproved preview origin are rejected',()=>{
  const preview=new Request('https://preview.qelly-intelligence.pages.dev/api/v1/auth/login',{method:'POST',headers:{origin:'https://preview.qelly-intelligence.pages.dev'}});
  assert.throws(()=>requireOrigin(preview,baseEnv()),error=>error instanceof HttpError&&error.code==='csrf_origin_forbidden');
  const production=new Request('https://qelly-intelligence.pages.dev/api/v1/auth/login',{method:'POST',headers:{origin:'https://qelly-intelligence.pages.dev'}});
  assert.doesNotThrow(()=>requireOrigin(production,baseEnv()));
});
