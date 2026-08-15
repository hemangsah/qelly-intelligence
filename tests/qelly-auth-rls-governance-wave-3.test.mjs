import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {handleAuth,__authTest} from '../functions/_lib/auth.js';
import {handleGovernance} from '../functions/_lib/governance.js';

const SITE='https://qelly-intelligence.pages.dev';
const SUPABASE='https://qelly-test.supabase.co';
const USER_ID='11111111-1111-4111-8111-111111111111';
const WORKSPACE_ID='22222222-2222-4222-8222-222222222222';

const jsonResponse=(body,status=200)=>new Response(JSON.stringify(body),{
  status,
  headers:{'Content-Type':'application/json'}
});

const baseEnv=(fetchImpl)=>({
  QELLY_PUBLIC_SITE_URL:SITE,
  QELLY_PUBLIC_SUPABASE_URL:SUPABASE,
  QELLY_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_qelly_test_key_1234567890',
  QELLY_DEPLOYMENT_ENVIRONMENT:'test',
  QELLY_ENABLE_AUTH:'true',
  QELLY_ALLOWED_ORIGINS:SITE,
  __fetch:fetchImpl
});

const setCookies=(response)=>typeof response.headers.getSetCookie==='function'
  ?response.headers.getSetCookie()
  :[response.headers.get('set-cookie')||''];

const cookiePair=(setCookie,name)=>{
  const header=setCookie.find(value=>value.startsWith(`${name}=`));
  assert.ok(header,`Expected ${name} Set-Cookie header`);
  return header.split(';',1)[0];
};

const jwt=()=>{
  const encode=(value)=>Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${encode({alg:'HS256',typ:'JWT'})}.${encode({
    iss:`${SUPABASE}/auth/v1`,
    aud:'authenticated',
    exp:Math.floor(Date.now()/1000)+3600,
    sub:USER_ID
  })}.signature`;
};

test('registration starts a bound PKCE transaction without returning tokens',async()=>{
  let signupUrl;
  let signupBody;
  const env=baseEnv(async(url,options={})=>{
    signupUrl=new URL(url);
    signupBody=JSON.parse(options.body);
    return jsonResponse({user:{id:USER_ID,email:'hemang@example.com'},session:null});
  });
  const request=new Request(`${SITE}/api/v1/auth/register`,{
    method:'POST',
    headers:{'Content-Type':'application/json','Origin':SITE},
    body:JSON.stringify({
      email:'hemang@example.com',
      password:'StrongPassword!123',
      displayName:'Hemang'
    })
  });
  const response=await handleAuth({request,env},'auth/register','POST');
  const body=await response.json();
  assert.equal(response.status,202);
  assert.equal(body.callbackMode,'pkce-code');
  assert.equal(body.verificationRequired,true);
  assert.equal(signupUrl.pathname,'/auth/v1/signup');
  assert.match(signupBody.code_challenge,/^[A-Za-z0-9_-]{43}$/);
  assert.equal(signupBody.code_challenge_method,'s256');
  assert.equal('access_token' in body,false);
  assert.equal('refresh_token' in body,false);

  const redirect=new URL(signupUrl.searchParams.get('redirect_to'));
  assert.equal(redirect.origin,SITE);
  assert.equal(redirect.pathname,'/auth/callback.html');
  assert.equal(redirect.searchParams.get('flow'),'signup');
  assert.match(redirect.searchParams.get('state'),/^[0-9a-f]{64}$/);
  assert.match(redirect.searchParams.get('nonce'),/^[0-9a-f]{64}$/);

  const transactionHeader=setCookies(response).find(value=>value.startsWith('qelly_auth_transaction='));
  assert.ok(transactionHeader);
  assert.match(transactionHeader,/HttpOnly/i);
  assert.match(transactionHeader,/SameSite=Lax/i);
  assert.doesNotMatch(transactionHeader,/access_token|refresh_token/i);
});

test('callback exchanges a one-time code with the matching verifier and rotates cookies',async()=>{
  const transaction=await __authTest.issueAuthTransaction('signup');
  const callbackUrl=new URL(__authTest.callbackRedirect({publicSiteUrl:SITE},transaction));
  let exchangeBody;
  const accessToken=jwt();
  const env=baseEnv(async(url,options={})=>{
    const target=new URL(url);
    if(target.pathname==='/auth/v1/token'&&target.searchParams.get('grant_type')==='pkce'){
      exchangeBody=JSON.parse(options.body);
      return jsonResponse({access_token:accessToken,refresh_token:'refresh-token',expires_in:3600});
    }
    if(target.pathname==='/auth/v1/user')return jsonResponse({id:USER_ID,email:'hemang@example.com',email_confirmed_at:new Date().toISOString(),user_metadata:{}});
    if(target.pathname==='/rest/v1/qelly_profiles')return jsonResponse([{user_id:USER_ID,display_name:'Hemang',cloud_sync_opt_in:false,privacy_version:'2026-08-01',terms_version:'2026-08-01'}]);
    if(target.pathname==='/rest/v1/qelly_workspaces')return jsonResponse([{id:WORKSPACE_ID,owner_id:USER_ID,name:'My Qelly Workspace'}]);
    throw new Error(`Unexpected URL ${target}`);
  });
  const request=new Request(`${SITE}/api/v1/auth/callback`,{
    method:'POST',
    headers:{
      'Content-Type':'application/json',
      'Origin':SITE,
      'Cookie':transaction.cookie.split(';',1)[0]
    },
    body:JSON.stringify({
      code:'one-time-auth-code',
      state:callbackUrl.searchParams.get('state'),
      nonce:callbackUrl.searchParams.get('nonce'),
      flow:'signup'
    })
  });
  const response=await handleAuth({request,env},'auth/callback','POST');
  const body=await response.json();
  assert.equal(response.status,200);
  assert.equal(body.authenticated,true);
  assert.equal(body.flow,'signup');
  assert.equal(exchangeBody.auth_code,'one-time-auth-code');
  assert.equal(exchangeBody.code_verifier,transaction.verifier);
  const expectedChallenge=Buffer.from(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(exchangeBody.code_verifier))).toString('base64url');
  assert.equal(expectedChallenge,transaction.challenge);
  assert.equal('accessToken' in body,false);
  assert.equal('refreshToken' in body,false);

  const cookies=setCookies(response);
  assert.ok(cookies.some(value=>value.startsWith('qelly_sb_access=')));
  assert.ok(cookies.some(value=>value.startsWith('qelly_sb_refresh=')));
  assert.ok(cookies.some(value=>value.startsWith('qelly_csrf=')));
  assert.ok(cookies.some(value=>value.startsWith('qelly_auth_transaction=')&&/Max-Age=0/.test(value)));
});

test('callback rejects mismatched state and legacy fragment-token sessions',async()=>{
  const transaction=await __authTest.issueAuthTransaction('signup');
  const request=new Request(`${SITE}/api/v1/auth/callback`,{
    method:'POST',
    headers:{'Cookie':transaction.cookie.split(';',1)[0]},
    body:JSON.stringify({code:'code',state:'0'.repeat(64),nonce:transaction.nonce,flow:'signup'})
  });
  await assert.rejects(
    ()=>handleAuth({request,env:baseEnv(()=>jsonResponse({}))},'auth/callback','POST'),
    error=>error?.code==='auth_transaction_mismatch'&&error?.status===400
  );

  const legacyRequest=new Request(`${SITE}/api/v1/auth/session`,{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({accessToken:'legacy',refreshToken:'legacy'})
  });
  await assert.rejects(
    ()=>handleAuth({request:legacyRequest,env:baseEnv(()=>jsonResponse({}))},'auth/session','POST'),
    error=>error?.code==='implicit_callback_disabled'&&error?.status===410
  );
});

test('cloud consent writes through the append-only governance RPC only',async()=>{
  const calls=[];
  const env=baseEnv(async(url,options={})=>{
    calls.push({url:new URL(url),body:JSON.parse(options.body)});
    return jsonResponse({enabled:true,eventIds:['a','b','c']});
  });
  const request=new Request(`${SITE}/api/v1/cloud/opt-in`,{
    method:'POST',
    headers:{
      'Content-Type':'application/json',
      'Origin':SITE,
      'Cookie':'qelly_csrf=proof',
      'X-Qelly-CSRF':'proof'
    },
    body:JSON.stringify({enabled:true,privacyVersion:'2026-08-01',termsVersion:'2026-08-01'})
  });
  const response=await handleGovernance(
    {request,env},
    'cloud/opt-in',
    'POST',
    {accessToken:'access',user:{id:USER_ID}},
    {profile:{privacy_version:'2026-08-01',terms_version:'2026-08-01'}}
  );
  const body=await response.json();
  assert.equal(body.enabled,true);
  assert.equal(calls.length,1);
  assert.equal(calls[0].url.pathname,'/rest/v1/rpc/qelly_set_cloud_sync_consent');
  assert.deepEqual(calls[0].body,{
    p_enabled:true,
    p_privacy_version:'2026-08-01',
    p_terms_version:'2026-08-01'
  });
});

test('account deletion atomically completes durable evidence and authenticated identity deletion',async()=>{
  const calls=[];
  const requestId='33333333-3333-4333-8333-333333333333';
  const completedAt='2026-08-15T07:30:00.000Z';
  const env=baseEnv(async(url,options={})=>{
    calls.push({url:new URL(url),body:options.body?JSON.parse(options.body):null});
    return jsonResponse({
      requested:true,
      requestId,
      status:'completed',
      replayed:false,
      identityDeleted:true,
      identityDeletionStatus:204,
      evidenceCompleted:true,
      evidenceError:null,
      completedAt
    });
  });
  const request=new Request(`${SITE}/api/v1/account/delete`,{
    method:'POST',
    headers:{
      'Content-Type':'application/json',
      'Origin':SITE,
      'Cookie':'qelly_csrf=proof',
      'X-Qelly-CSRF':'proof'
    },
    body:JSON.stringify({reason:'Close account'})
  });
  const response=await handleGovernance(
    {request,env},
    'account/delete',
    'POST',
    {accessToken:'access',user:{id:USER_ID}},
    {profile:{privacy_version:'2026-08-01',terms_version:'2026-08-01'}}
  );
  const body=await response.json();
  assert.equal(response.status,202);
  assert.equal(body.requested,true);
  assert.equal(body.requestId,requestId);
  assert.equal(body.identityDeleted,true);
  assert.equal(body.identityDeletionStatus,204);
  assert.equal(body.evidenceCompleted,true);
  assert.equal(body.evidenceError,null);
  assert.equal(body.status,'completed');
  assert.equal(body.completedAt,completedAt);
  assert.equal(calls.length,1);
  assert.equal(calls[0].url.pathname,'/rest/v1/rpc/qelly_self_delete_account');
  assert.deepEqual(calls[0].body,{
    p_reason:'Close account',
    p_privacy_version:'2026-08-01',
    p_terms_version:'2026-08-01'
  });
  assert.ok(setCookies(response).some(value=>value.startsWith('qelly_sb_access=')&&/Max-Age=0/.test(value)));
});

test('browser callback source contains no fragment-token handling',()=>{
  const source=readFileSync(new URL('../apps/web/public/assets/qelly-auth-callback.mjs',import.meta.url),'utf8');
  assert.doesNotMatch(source,/location\.hash/);
  assert.doesNotMatch(source,/access_token/);
  assert.doesNotMatch(source,/refresh_token/);
  assert.match(source,/\/api\/v1\/auth\/callback/);
  assert.match(source,/JSON\.stringify\(\{code,state,nonce,flow\}\)/);
});

test('governance migration is append-only, pseudonymous and least privilege',()=>{
  const source=readFileSync(new URL('../packages/migrations/20260805030000_qelly_auth_rls_governance_wave_3.sql',import.meta.url),'utf8');
  assert.match(source,/create table if not exists public\.qelly_consent_events/i);
  assert.match(source,/create table if not exists public\.qelly_account_deletion_events/i);
  assert.match(source,/on delete set null/i);
  assert.match(source,/prevent_append_only_mutation/i);
  assert.match(source,/qelly_set_cloud_sync_consent/i);
  assert.match(source,/qelly_request_account_deletion/i);
  assert.match(source,/qelly_complete_account_deletion/i);
  assert.match(source,/using \(owner_id = \(select auth\.uid\(\)\)\)/i);
  assert.match(source,/grant update \(display_name\) on table public\.qelly_profiles/i);
  assert.match(source,/revoke all on table public\.qelly_sync_operations from authenticated/i);
  assert.doesNotMatch(source,/grant .*cloud_sync_opt_in.* to authenticated/i);
});
