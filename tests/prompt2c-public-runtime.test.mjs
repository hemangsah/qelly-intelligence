import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {publicRuntimeConfig,__test,onRequest} from '../functions/api/v1/[[path]].js';
import {onRequest as onConfigRequest} from '../functions/api/v1/config.js';

const read=(path)=>readFile(new URL(`../${path}`,import.meta.url),'utf8');
const env=()=>({
  QELLY_PUBLIC_SITE_URL:'https://qelly-runtime.test',
  QELLY_PUBLIC_SUPABASE_URL:'https://example.supabase.co',
  QELLY_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_ci_public_key_1234567890',
  QELLY_PUBLIC_RELEASE_SHA:'0123456789abcdef0123456789abcdef01234567',
  QELLY_ENABLE_AUTH:'true',
  QELLY_ENABLE_CLOUD_SYNC:'true',
  QELLY_ENABLE_LIVE_PROVIDERS:'true',
  QELLY_ENABLE_FEEDBACK_WRITES:'true'
});

test('typed public runtime config exposes only browser-safe capability values',()=>{
  const config=publicRuntimeConfig(env(),'https://qelly-runtime.test/api/v1/config');
  assert.equal(config.releaseSha,'0123456789abcdef0123456789abcdef01234567');
  assert.equal(config.supabaseUrl,'https://example.supabase.co');
  assert.equal(config.capabilities.authentication,true);
  assert.equal(config.capabilities.cloudSync,true);
  assert.equal(config.capabilities.liveProviders,true);
  assert.equal('serviceRoleKey' in config,false);
  assert.equal(JSON.stringify(config).includes('SERVICE_ROLE'),false);
});

test('JWT validation rejects incorrect issuer before upstream verification',()=>{
  const header=Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url');
  const payload=Buffer.from(JSON.stringify({iss:'https://attacker.invalid/auth/v1',aud:'authenticated',exp:Math.floor(Date.now()/1000)+3600,sub:'00000000-0000-4000-8000-000000000000'})).toString('base64url');
  assert.throws(()=>__test.validateJwtClaims(`${header}.${payload}.signature`,env()),/issuer/i);
});

test('Pages config route is available without authentication and establishes truthful capabilities',async()=>{
  const request=new Request('https://qelly-runtime.test/api/v1/config');
  const response=await onConfigRequest({request,env:env(),waitUntil(){}});
  assert.equal(response.status,200);
  const body=await response.json();
  assert.equal(body.auth.authenticated,false);
  assert.equal(body.auth.productionIdentityEnabled,true);
  assert.equal(body.cloud.syncAvailable,true);
  assert.equal(body.runtime.capabilities.liveProviders,true);
});

test('forbidden CORS origin returns a typed error instead of throwing from error handling',async()=>{
  const request=new Request('https://qelly-runtime.test/api/v1/config',{headers:{Origin:'https://attacker.invalid'}});
  const response=await onConfigRequest({request,env:env(),waitUntil(){}});
  assert.equal(response.status,403);
  assert.equal((await response.json()).error.code,'cors_origin_forbidden');
});

test('Auth callback exchanges one-time code into server cookies without browser persistence',async()=>{
  const source=await read('apps/web/public/assets/qelly-auth-callback.mjs');
  assert.match(source,/\/api\/v1\/auth\/callback/);
  assert.match(source,/X-Qelly-CSRF/);
  assert.match(source,/JSON\.stringify\(\{code,state,nonce,flow\}\)/);
  assert.doesNotMatch(source,/location\.hash|access_token|refresh_token|localStorage|sessionStorage/);
});

test('cloud lifecycle remains explicit opt-in and conflict preserving',async()=>{
  const sync=await read('apps/web/public/assets/qelly-cloud-sync.mjs');
  const saved=await read('apps/web/public/assets/routes/saved-calculations.mjs');
  assert.match(sync,/cloud\/opt-in/);
  assert.match(sync,/Idempotency-Key/);
  assert.match(sync,/conflict/);
  assert.match(saved,/Nothing uploads until you explicitly enable cloud sync/);
  assert.match(saved,/No (?:conflicting|cloud) record was silently overwritten/i);
});

test('Pages Functions source covers required public runtime route families',async()=>{
  const source=(await Promise.all(['functions/api/v1/[[path]].js','functions/_lib/auth.js','functions/_lib/data.js','functions/_lib/providers.js'].map(read))).join('\n');
  for(const route of ['auth/register','auth/login','auth/session','auth/refresh','auth/logout','auth/recovery/request','session/context','cloud/status','sync/push','sync/pull','saved-calculations','providers/status','account/export','account/delete'])assert.match(source,new RegExp(route));
  assert.doesNotMatch(source,/Math\.random/);
});

test('build pipeline requires exact public runtime variables and emits release identity',async()=>{
  const source=await read('scripts/build-frontend.mjs');
  for(const marker of ['QELLY_REQUIRE_PUBLIC_RUNTIME','QELLY_PUBLIC_SUPABASE_URL','QELLY_PUBLIC_SUPABASE_PUBLISHABLE_KEY','qelly-release.json','_routes.json','fallbackReleaseSha'])assert.match(source,new RegExp(marker.replaceAll('.','\\.')));
});

const userId='11111111-1111-4111-8111-111111111111';
const workspaceId='22222222-2222-4222-8222-222222222222';
const jwt=()=>{
  const header=Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url');
  const payload=Buffer.from(JSON.stringify({iss:'https://example.supabase.co/auth/v1',aud:'authenticated',exp:Math.floor(Date.now()/1000)+3600,sub:userId,email:'user@example.com'})).toString('base64url');
  return `${header}.${payload}.test-signature`;
};
const jsonResponse=(value,status=200)=>new Response(value==null?'':JSON.stringify(value),{status,headers:{'Content-Type':'application/json'}});
const coreSupabaseFetch=(calls,overrides={})=>async(input,init={})=>{
  const url=new URL(input),key=`${init.method||'GET'} ${url.pathname}${url.search}`;
  calls.push({key,url,init,body:init.body?JSON.parse(init.body):null});
  if(overrides[key])return overrides[key]({url,init});
  if(url.pathname==='/auth/v1/user')return jsonResponse({id:userId,email:'user@example.com',email_confirmed_at:new Date().toISOString(),user_metadata:{display_name:'Qelly User'}});
  if(url.pathname==='/rest/v1/qelly_profiles')return jsonResponse([{user_id:userId,display_name:'Qelly User',cloud_sync_opt_in:true,privacy_version:'2026-08-01',terms_version:'2026-08-01'}]);
  if(url.pathname==='/rest/v1/qelly_workspaces')return jsonResponse([{id:workspaceId,owner_id:userId,name:'My Qelly Workspace'}]);
  if(url.pathname==='/rest/v1/qelly_saved_calculations')return jsonResponse([]);
  if(url.pathname==='/rest/v1/qelly_sync_operations')return jsonResponse([]);
  return jsonResponse([]);
};

test('login establishes HttpOnly Supabase session cookies and never returns tokens in JSON',async()=>{
  const calls=[],token=jwt(),runtimeEnv={...env(),__fetch:coreSupabaseFetch(calls,{
    'POST /auth/v1/token?grant_type=password':()=>jsonResponse({access_token:token,refresh_token:'refresh-token',expires_in:3600,user:{id:userId,email:'user@example.com'}})
  })};
  const request=new Request('https://qelly-runtime.test/api/v1/auth/login',{method:'POST',headers:{Origin:'https://qelly-runtime.test','Content-Type':'application/json'},body:JSON.stringify({email:'user@example.com',password:'StrongPassword!23'})});
  const response=await onRequest({request,env:runtimeEnv,params:{path:['auth','login']},waitUntil(){}});
  assert.equal(response.status,200);
  const body=await response.json();
  assert.equal(body.authenticated,true);
  assert.equal(JSON.stringify(body).includes(token),false);
  const setCookie=response.headers.get('set-cookie')||'';
  assert.match(setCookie,/qelly_sb_access=/);
  assert.match(setCookie,/qelly_sb_refresh=/);
  assert.match(setCookie,/HttpOnly/);
  assert.equal(calls.some(call=>call.url.pathname==='/auth/v1/user'),true);
});

test('atomic RLS sync push derives owner and workspace from verified JWT context',async()=>{
  const calls=[],token=jwt(),runtimeEnv={...env(),__fetch:coreSupabaseFetch(calls,{
    'POST /rest/v1/rpc/qelly_sync_push_batch':()=>jsonResponse({
      batchId:'44444444-4444-4444-8444-444444444444',
      results:[{id:'33333333-3333-4333-8333-333333333333',status:'applied',cloudRevision:1}],
      applied:1,
      conflicts:0,
      replayed:false
    })
  })};
  const csrf='csrf-test-token';
  const item={id:'33333333-3333-4333-8333-333333333333',name:'BTC model',version:1,updatedAt:'2026-08-05T00:00:00.000Z',result:{formulaId:'kelly-criterion',inputs:{p:.55,b:1.2},outputs:{fraction:.175}},notes:'',tags:[],favorite:false,revisions:[]};
  const request=new Request('https://qelly-runtime.test/api/v1/sync/push',{method:'POST',headers:{Origin:'https://qelly-runtime.test','Content-Type':'application/json','X-Qelly-CSRF':csrf,'Idempotency-Key':'qelly-sync-test-123','Cookie':`qelly_sb_access=${encodeURIComponent(token)}; qelly_sb_refresh=refresh; qelly_csrf=${csrf}`},body:JSON.stringify({items:[{...item,ownerId:'attacker',workspaceId:'attacker'}],baseRevisions:{}})});
  const response=await onRequest({request,env:runtimeEnv,params:{path:['sync','push']},waitUntil(){}});
  assert.equal(response.status,200);
  const rpcCalls=calls.filter(call=>call.init.method==='POST'&&call.url.pathname==='/rest/v1/rpc/qelly_sync_push_batch');
  assert.equal(rpcCalls.length,1);
  const payload=rpcCalls[0].body;
  assert.equal(payload.p_workspace_id,workspaceId);
  assert.equal(payload.p_items.length,1);
  assert.equal(payload.p_items[0].record.owner_id,userId);
  assert.equal(payload.p_items[0].record.workspace_id,workspaceId);
  assert.notEqual(payload.p_items[0].record.owner_id,'attacker');
  assert.notEqual(payload.p_items[0].record.workspace_id,'attacker');
  assert.equal(calls.some(call=>call.url.pathname==='/rest/v1/qelly_saved_calculations'&&call.init.method==='POST'),false);
});

test('blocked crypto provider facade returns rights reason without an upstream network call',async()=>{
  const calls=[],runtimeEnv={...env(),__fetch:coreSupabaseFetch(calls)};
  const request=new Request('https://qelly-runtime.test/api/v1/providers/binance?capability=quote&symbol=BTCUSDT');
  const response=await onRequest({request,env:runtimeEnv,params:{path:['providers','binance']},waitUntil(){}});
  assert.equal(response.status,200);
  const body=await response.json();
  assert.equal(calls.length,0);
  assert.equal(body.truthState,'unavailable');
  assert.equal(body.provider,'binance');
  assert.equal(body.confidence,0);
  assert.equal(body.cache.hit,false);
  assert.equal(body.fallbackReason,'provider_redistribution_rights_not_verified');
  assert.equal(body.termsState,'blocked_pending_redistribution_rights');
});
