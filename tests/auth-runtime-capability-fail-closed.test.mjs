import test from 'node:test';
import assert from 'node:assert/strict';
import {ACCESS_COOKIE} from '../functions/_lib/runtime.js';
import {onRequest as configRequest} from '../functions/api/v1/config.js';
import {onRequest as bootstrapRequest} from '../functions/api/v1/bootstrap.js';
import {onRequest as emailCapabilityRequest} from '../functions/api/v1/auth/email-capability.js';
import {onRequest as registerRequest} from '../functions/api/v1/auth/register.js';
import {onRequest as recoveryRequest} from '../functions/api/v1/auth/recovery/request.js';
import {onRequest as genericRequest} from '../functions/api/v1/[[path]].js';

const SITE='https://qelly.example';
const SUPABASE='https://project.supabase.co';
const USER_ID='11111111-1111-4111-8111-111111111111';

const environment=(overrides={})=>({
  QELLY_PUBLIC_SITE_URL:SITE,
  QELLY_PUBLIC_SUPABASE_URL:SUPABASE,
  QELLY_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_abcdefghijklmnopqrstuvwxyz123456',
  QELLY_ALLOWED_ORIGINS:SITE,
  QELLY_ENABLE_AUTH:'false',
  QELLY_ENABLE_AUTH_EMAIL_DELIVERY:'true',
  ...overrides
});

const encoded=(value)=>Buffer.from(JSON.stringify(value)).toString('base64url');
const validLookingAccessToken=()=>`${encoded({alg:'HS256',typ:'JWT'})}.${encoded({iss:`${SUPABASE}/auth/v1`,aud:'authenticated',exp:Math.floor(Date.now()/1000)+3600,sub:USER_ID})}.signature`;
const sessionCookie=()=>`${ACCESS_COOKIE}=${encodeURIComponent(validLookingAccessToken())}`;

const noUpstreamEnvironment=()=>{
  let calls=0;
  const env=environment({__fetch:async()=>{calls+=1;throw new Error('auth upstream must not be called while authentication is disabled');}});
  return {env,calls:()=>calls};
};

test('public config exposes the authentication kill switch and does not verify an existing cookie',async()=>{
  const harness=noUpstreamEnvironment();
  const request=new Request(`${SITE}/api/v1/config`,{headers:{Cookie:sessionCookie()}});
  const response=await configRequest({request,env:harness.env,next:()=>new Response(null,{status:404})});
  assert.equal(response.status,200);
  const payload=await response.json();
  assert.equal(payload.runtime.capabilities.authentication,false);
  assert.equal(payload.runtime.capabilities.emailDelivery,true);
  assert.equal(payload.auth.authenticated,false);
  assert.equal(payload.auth.backendAvailable,false);
  assert.equal(payload.auth.productionIdentityEnabled,false);
  assert.equal(payload.auth.emailDeliveryAvailable,false);
  assert.equal(payload.auth.registrationAvailable,false);
  assert.equal(payload.auth.recoveryAvailable,false);
  assert.equal(harness.calls(),0);
});

test('bootstrap stays public-only and performs no private auth/profile bootstrap when authentication is disabled',async()=>{
  const harness=noUpstreamEnvironment();
  const request=new Request(`${SITE}/api/v1/bootstrap`,{headers:{Cookie:sessionCookie()}});
  const response=await bootstrapRequest({request,env:harness.env,next:()=>new Response(null,{status:404})});
  assert.equal(response.status,200);
  const payload=await response.json();
  assert.equal(payload.config.auth.authenticated,false);
  assert.equal(payload.config.auth.backendAvailable,false);
  assert.equal(payload.context,null);
  assert.equal(payload.preferences,null);
  assert.equal(harness.calls(),0);
});

test('email capability endpoint cannot advertise registration or recovery while authentication is disabled',async()=>{
  const harness=noUpstreamEnvironment();
  const response=await emailCapabilityRequest({request:new Request(`${SITE}/api/v1/auth/email-capability`),env:harness.env,next:()=>new Response(null,{status:404})});
  assert.equal(response.status,200);
  const payload=await response.json();
  assert.equal(payload.emailDeliveryAvailable,false);
  assert.equal(payload.registrationAvailable,false);
  assert.equal(payload.recoveryAvailable,false);
  assert.equal(payload.evidence,null);
  assert.equal(harness.calls(),0);
});

for(const [name,handler,path,body] of [
  ['registration',registerRequest,'auth/register',{displayName:'Test User',email:'test@example.com',password:'StrongPassword!123',baseCurrency:'USD',timezone:'UTC'}],
  ['recovery',recoveryRequest,'auth/recovery/request',{email:'test@example.com'}]
]){
  test(`${name} dedicated route rejects on the auth kill switch before any Supabase request`,async()=>{
    const harness=noUpstreamEnvironment();
    const request=new Request(`${SITE}/api/v1/${path}`,{method:'POST',headers:{Origin:SITE,'Content-Type':'application/json'},body:JSON.stringify(body)});
    const response=await handler({request,env:harness.env,next:()=>new Response(null,{status:404})});
    assert.equal(response.status,503);
    const payload=await response.json();
    assert.equal(payload.error.code,'auth_runtime_unavailable');
    assert.equal(payload.error.retryable,false);
    assert.equal(harness.calls(),0);
  });
}

test('generic login route rejects on the auth kill switch before password auth reaches Supabase',async()=>{
  const harness=noUpstreamEnvironment();
  const request=new Request(`${SITE}/api/v1/auth/login`,{method:'POST',headers:{Origin:SITE,'Content-Type':'application/json'},body:JSON.stringify({email:'test@example.com',password:'StrongPassword!123'})});
  const response=await genericRequest({request,env:harness.env,params:{path:['auth','login']}});
  assert.equal(response.status,503);
  const payload=await response.json();
  assert.equal(payload.error.code,'auth_runtime_unavailable');
  assert.equal(payload.error.retryable,false);
  assert.equal(harness.calls(),0);
});

test('auth-owned cloud governance route is also unavailable when authentication is disabled',async()=>{
  const harness=noUpstreamEnvironment();
  const request=new Request(`${SITE}/api/v1/cloud/opt-in`,{method:'POST',headers:{Origin:SITE,'Content-Type':'application/json'},body:'{}'});
  const response=await genericRequest({request,env:harness.env,params:{path:['cloud','opt-in']}});
  assert.equal(response.status,503);
  const payload=await response.json();
  assert.equal(payload.error.code,'auth_runtime_unavailable');
  assert.equal(harness.calls(),0);
});

test('auth kill switch does not disable unrelated public capability inventory',async()=>{
  const harness=noUpstreamEnvironment();
  const request=new Request(`${SITE}/api/v1/platform/capabilities`);
  const response=await genericRequest({request,env:harness.env,params:{path:['platform','capabilities']}});
  assert.equal(response.status,200);
  assert.equal(harness.calls(),0);
});
