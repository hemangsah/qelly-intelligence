import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {onRequest,__middlewareTest} from '../functions/api/v1/_middleware.js';

const environment=(overrides={})=>({
  QELLY_PUBLIC_SITE_URL:'https://qelly-middleware.test',
  QELLY_PUBLIC_SUPABASE_URL:'https://example.supabase.co',
  QELLY_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_middleware_test_1234567890',
  QELLY_PUBLIC_RELEASE_SHA:'1111111111111111111111111111111111111111',
  QELLY_ENABLE_AUTH:'true',
  QELLY_ENABLE_AUTH_EMAIL_DELIVERY:'false',
  QELLY_ENABLE_CLOUD_SYNC:'true',
  QELLY_ENABLE_LIVE_PROVIDERS:'true',
  ...overrides
});

test('readiness middleware remains fail-closed with structured proof states',async()=>{
  let nextCalls=0;
  const request=new Request('https://qelly-middleware.test/api/v1/readiness');
  const response=await onRequest({request,env:environment(),next:async()=>{nextCalls+=1;return new Response('unexpected');}});
  const body=await response.json();
  assert.equal(response.status,503);
  assert.equal(nextCalls,0);
  assert.equal(body.ready,false);
  assert.equal(body.status,'not_proven');
  assert.equal(body.checks.authEmail.configured,false);
  assert.equal(body.checks.authEmail.proven,false);
  assert.equal(body.dependencies.auth,'email_delivery_fail_closed');
  assert.equal(body.checks.rlsIsolation.proven,false);
  assert.equal(body.checks.providerFreshness.proven,false);
});

test('configured email transport never becomes ready without end-to-end proof',async()=>{
  const request=new Request('https://qelly-middleware.test/api/v1/readiness');
  const response=await onRequest({request,env:environment({QELLY_ENABLE_AUTH_EMAIL_DELIVERY:'true'}),next:async()=>new Response('unexpected')});
  const body=await response.json();
  assert.equal(response.status,503);
  assert.equal(body.ready,false);
  assert.equal(body.checks.authEmail.configured,true);
  assert.equal(body.checks.authEmail.proven,false);
  assert.equal(body.dependencies.auth,'email_delivery_configured_not_end_to_end_proven');
});

test('governance writes are intercepted before the legacy route handler',async()=>{
  for(const path of ['cloud/opt-in','account/delete']){
    let nextCalls=0;
    const request=new Request(`https://qelly-middleware.test/api/v1/${path}`,{method:'POST'});
    const response=await onRequest({request,env:environment(),next:async()=>{nextCalls+=1;return new Response('legacy');}});
    assert.equal(nextCalls,0,path);
    assert.equal(response.status,401,path);
  }
});

test('registration and recovery remain unavailable at the API boundary when email delivery is disabled',async()=>{
  for(const path of ['auth/register','auth/recovery/request']){
    let nextCalls=0;
    const request=new Request(`https://qelly-middleware.test/api/v1/${path}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(path==='auth/register'?{baseCurrency:'USD',timezone:'UTC'}:{email:'person@example.com'})});
    const response=await onRequest({request,env:environment(),next:async()=>{nextCalls+=1;return new Response('legacy');}});
    const body=await response.json();
    assert.equal(nextCalls,0,path);
    assert.equal(response.status,503,path);
    assert.equal(body.error.code,'email_delivery_unavailable',path);
  }
});

test('registration preferences are validated before the existing Auth handler runs',async()=>{
  const enabled=environment({QELLY_ENABLE_AUTH_EMAIL_DELIVERY:'true'});
  for(const payload of [
    {baseCurrency:'XYZ',timezone:'UTC'},
    {baseCurrency:'USD',timezone:'Not/A_Real_Zone'},
    {baseCurrency:'USD'}
  ]){
    let nextCalls=0;
    const request=new Request('https://qelly-middleware.test/api/v1/auth/register',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});
    const response=await onRequest({request,env:enabled,next:async()=>{nextCalls+=1;return new Response('accepted',{status:202});}});
    assert.equal(nextCalls,0);
    assert.equal(response.status,400);
  }
  let nextCalls=0;
  const validRequest=new Request('https://qelly-middleware.test/api/v1/auth/register',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({baseCurrency:'INR',timezone:'Asia/Kolkata'})});
  const validResponse=await onRequest({request:validRequest,env:enabled,next:async()=>{nextCalls+=1;return new Response('accepted',{status:202});}});
  assert.equal(nextCalls,1);
  assert.equal(validResponse.status,202);
});

test('session context is now owned by the governed shell middleware contract',()=>{
  assert.equal(__middlewareTest.shellContextRoute('session/context','GET'),true);
  assert.equal(__middlewareTest.shellContextRoute('session/context','POST'),false);
  assert.equal(__middlewareTest.shellContextRoute('health','GET'),false);
});

test('non-governed API routes continue through the existing handler',async()=>{
  let nextCalls=0;
  const request=new Request('https://qelly-middleware.test/api/v1/health');
  const response=await onRequest({request,env:environment(),next:async()=>{nextCalls+=1;return new Response(null,{status:204});}});
  assert.equal(nextCalls,1);
  assert.equal(response.status,204);
});

test('middleware source owns governed, shell-context and transactional email paths',async()=>{
  const source=await readFile(new URL('../functions/api/v1/_middleware.js',import.meta.url),'utf8');
  assert.equal(__middlewareTest.governanceRoute('cloud/opt-in','POST'),true);
  assert.equal(__middlewareTest.governanceRoute('account/delete','POST'),true);
  assert.equal(__middlewareTest.governanceRoute('cloud/opt-in','GET'),false);
  assert.equal(__middlewareTest.transactionalEmailRoute('auth/register','POST'),true);
  assert.equal(__middlewareTest.transactionalEmailRoute('auth/recovery/request','POST'),true);
  assert.match(source,/handleGovernance/);
  assert.match(source,/readinessSnapshot/);
  assert.match(source,/safeBaseCurrency/);
  assert.match(source,/safeTimezone/);
  assert.match(source,/buildShellContext/);
  assert.match(source,/if\(!interceptReadiness&&!interceptGovernance&&!interceptEmail&&!interceptShellContext\)return context\.next\(\)/);
});
