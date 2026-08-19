import test from 'node:test';
import assert from 'node:assert/strict';
import {publicRuntimeConfig} from '../functions/_lib/runtime.js';
import {__authTest} from '../functions/_lib/auth.js';
import {AUTH_EMAIL_CANARY,CANONICAL_QELLY_PUBLIC_SITE,emailDeliveryAvailable,effectivePublicRuntimeConfig} from '../functions/_lib/email-capability.js';
import {onRequest as registerRequest} from '../functions/api/v1/auth/register.js';
import {onRequest as recoveryRequest} from '../functions/api/v1/auth/recovery/request.js';
import {onRequest as configRequest} from '../functions/api/v1/config.js';

const environment=(overrides={})=>({
  QELLY_PUBLIC_SITE_URL:'https://qelly.example',
  QELLY_PUBLIC_SUPABASE_URL:'https://project.supabase.co',
  QELLY_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_abcdefghijklmnopqrstuvwxyz123456',
  QELLY_ALLOWED_ORIGINS:'https://qelly.example',
  QELLY_ENABLE_AUTH:'true',
  ...overrides
});

const canonicalEnvironment=(overrides={})=>environment({
  QELLY_PUBLIC_SITE_URL:CANONICAL_QELLY_PUBLIC_SITE,
  QELLY_ALLOWED_ORIGINS:CANONICAL_QELLY_PUBLIC_SITE,
  ...overrides
});

test('transactional email requires explicit runtime activation in every environment',()=>{
  assert.equal(publicRuntimeConfig(environment()).capabilities.authentication,true);
  assert.equal(publicRuntimeConfig(environment()).capabilities.emailDelivery,false);
  assert.equal(emailDeliveryAvailable(environment()),false);
  assert.equal(emailDeliveryAvailable(canonicalEnvironment()),false);
  assert.equal(emailDeliveryAvailable(environment({QELLY_ENABLE_AUTH_EMAIL_DELIVERY:'true'})),true);
  assert.equal(emailDeliveryAvailable(canonicalEnvironment({QELLY_ENABLE_AUTH_EMAIL_DELIVERY:'true'})),true);
});

test('canonical email canary is dated readiness evidence but never capability authority',()=>{
  assert.equal(AUTH_EMAIL_CANARY.proven,true);
  assert.equal(AUTH_EMAIL_CANARY.verifiedAt,'2026-08-19T16:51:37.822699Z');
  assert.equal(AUTH_EMAIL_CANARY.evidenceMethod,'confirmation_sent_at_then_email_confirmed_at');
  assert.equal(AUTH_EMAIL_CANARY.readinessEvidence,true);
  assert.equal(AUTH_EMAIL_CANARY.capabilityAuthority,false);
  assert.equal(effectivePublicRuntimeConfig(canonicalEnvironment()).capabilities.emailDelivery,false);
  assert.equal(effectivePublicRuntimeConfig(canonicalEnvironment({QELLY_ENABLE_AUTH_EMAIL_DELIVERY:'true'})).capabilities.emailDelivery,true);
  assert.equal(effectivePublicRuntimeConfig(canonicalEnvironment({QELLY_ENABLE_AUTH_EMAIL_DELIVERY:'false'})).capabilities.emailDelivery,false);
});

test('canonical config endpoint fails closed without explicit email activation',async()=>{
  const env=canonicalEnvironment();
  const request=new Request(`${CANONICAL_QELLY_PUBLIC_SITE}/api/v1/config`);
  const response=await configRequest({request,env,next:()=>new Response(null,{status:404})});
  assert.equal(response.status,200);
  const payload=await response.json();
  assert.equal(payload.auth.emailDeliveryAvailable,false);
  assert.equal(payload.auth.registrationAvailable,false);
  assert.equal(payload.auth.recoveryAvailable,false);
  assert.equal(payload.runtime.capabilities.emailDelivery,false);
});

test('canonical config endpoint exposes email capability only with explicit activation',async()=>{
  const env=canonicalEnvironment({QELLY_ENABLE_AUTH_EMAIL_DELIVERY:'true'});
  const request=new Request(`${CANONICAL_QELLY_PUBLIC_SITE}/api/v1/config`);
  const response=await configRequest({request,env,next:()=>new Response(null,{status:404})});
  assert.equal(response.status,200);
  const payload=await response.json();
  assert.equal(payload.auth.emailDeliveryAvailable,true);
  assert.equal(payload.auth.registrationAvailable,true);
  assert.equal(payload.auth.recoveryAvailable,true);
  assert.equal(payload.runtime.capabilities.emailDelivery,true);
});

test('signup and recovery PKCE verifier transaction survives the governed one-hour email window',()=>{
  assert.equal(__authTest.AUTH_TRANSACTION_TTL_MS,60*60*1000);
});

for(const [name,handler,path,body] of [
  ['register',registerRequest,'auth/register',{displayName:'Test User',email:'test@example.com',password:'StrongPassword!123',baseCurrency:'USD',timezone:'UTC'}],
  ['recovery',recoveryRequest,'auth/recovery/request',{email:'test@example.com'}]
]){
  test(`${name} exact route rejects before any Supabase email request when delivery is unproven`,async()=>{
    let upstreamCalls=0;
    const env=environment({__fetch:async()=>{upstreamCalls+=1;throw new Error('upstream must not be called');}});
    const request=new Request(`https://qelly.example/api/v1/${path}`,{method:'POST',headers:{Origin:'https://qelly.example','Content-Type':'application/json'},body:JSON.stringify(body)});
    const response=await handler({request,env,next:()=>new Response(null,{status:404})});
    assert.equal(response.status,503);
    const payload=await response.json();
    assert.equal(payload.error.code,'auth_email_delivery_unavailable');
    assert.equal(payload.error.retryable,false);
    assert.equal(upstreamCalls,0);
  });

  test(`${name} canonical route also rejects before Supabase when the explicit email flag is absent`,async()=>{
    let upstreamCalls=0;
    const env=canonicalEnvironment({__fetch:async()=>{upstreamCalls+=1;throw new Error('upstream must not be called');}});
    const request=new Request(`${CANONICAL_QELLY_PUBLIC_SITE}/api/v1/${path}`,{method:'POST',headers:{Origin:CANONICAL_QELLY_PUBLIC_SITE,'Content-Type':'application/json'},body:JSON.stringify(body)});
    const response=await handler({request,env,next:()=>new Response(null,{status:404})});
    assert.equal(response.status,503);
    const payload=await response.json();
    assert.equal(payload.error.code,'auth_email_delivery_unavailable');
    assert.equal(payload.error.retryable,false);
    assert.equal(upstreamCalls,0);
  });
}

test('canonical registration validates profile preferences before any Supabase request when email is explicitly enabled',async()=>{
  let upstreamCalls=0;
  const env=canonicalEnvironment({QELLY_ENABLE_AUTH_EMAIL_DELIVERY:'true',__fetch:async()=>{upstreamCalls+=1;throw new Error('upstream must not be called');}});
  const request=new Request(`${CANONICAL_QELLY_PUBLIC_SITE}/api/v1/auth/register`,{method:'POST',headers:{Origin:CANONICAL_QELLY_PUBLIC_SITE,'Content-Type':'application/json'},body:JSON.stringify({displayName:'Test User',email:'test@example.com',password:'StrongPassword!123'})});
  const response=await registerRequest({request,env,next:()=>new Response(null,{status:404})});
  assert.equal(response.status,400);
  const payload=await response.json();
  assert.equal(payload.error.code,'profile_preferences_required');
  assert.equal(upstreamCalls,0);
});
