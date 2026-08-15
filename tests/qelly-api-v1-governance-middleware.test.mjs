import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {onRequest,__middlewareTest} from '../functions/api/v1/_middleware.js';
import {onRequest as onReadinessRequest} from '../functions/api/v1/readiness.js';

const SITE='https://qelly-middleware.test';
const CANONICAL='https://qelly-intelligence.pages.dev';
const ecbXml=(date=new Date(Date.now()-24*60*60*1000).toISOString().slice(0,10))=>`<?xml version="1.0"?><Envelope><Cube><Cube time='${date}'><Cube currency='USD' rate='1.15'/><Cube currency='GBP' rate='0.86'/><Cube currency='INR' rate='105.1'/><Cube currency='JPY' rate='171.5'/><Cube currency='CHF' rate='0.94'/></Cube></Cube></Envelope>`;
const environment=(overrides={})=>({
  QELLY_PUBLIC_SITE_URL:SITE,
  QELLY_PUBLIC_SUPABASE_URL:'https://example.supabase.co',
  QELLY_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_middleware_test_1234567890',
  QELLY_PUBLIC_RELEASE_SHA:'1111111111111111111111111111111111111111',
  QELLY_ENABLE_AUTH:'true',
  QELLY_ENABLE_AUTH_EMAIL_DELIVERY:'false',
  QELLY_ENABLE_CLOUD_SYNC:'true',
  QELLY_ENABLE_LIVE_PROVIDERS:'true',
  ...overrides
});
const browserHeaders=(extra={})=>({origin:SITE,...extra});

test('dedicated readiness route remains fail-closed with structured proof states outside canonical production',async()=>{
  let nextCalls=0;
  const request=new Request(`${SITE}/api/v1/readiness`);
  const response=await onReadinessRequest({request,env:environment(),next:async()=>{nextCalls+=1;return new Response('unexpected');}});
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

test('configured email transport never becomes ready outside canonical evidence scope',async()=>{
  const request=new Request(`${SITE}/api/v1/readiness`);
  const response=await onReadinessRequest({request,env:environment({QELLY_ENABLE_AUTH_EMAIL_DELIVERY:'true'}),next:async()=>new Response('unexpected')});
  const body=await response.json();
  assert.equal(response.status,503);
  assert.equal(body.ready,false);
  assert.equal(body.checks.authEmail.configured,true);
  assert.equal(body.checks.authEmail.proven,false);
  assert.equal(body.dependencies.auth,'canonical_production_scope_required');
});

test('canonical readiness returns 200 only when all production evidence canaries pass',async()=>{
  const env=environment({
    QELLY_PUBLIC_SITE_URL:CANONICAL,
    QELLY_ENABLE_AUTH_EMAIL_DELIVERY:'true',
    __fetch:async(url)=>{
      const target=String(url);
      if(target.endsWith('/auth/v1/health'))return new Response(JSON.stringify({version:'test'}),{status:200,headers:{'Content-Type':'application/json'}});
      if(target.includes('eurofxref-daily.xml'))return new Response(ecbXml(),{status:200,headers:{'Content-Type':'application/xml'}});
      throw new Error(`Unexpected URL ${target}`);
    }
  });
  const request=new Request(`${CANONICAL}/api/v1/readiness`);
  const response=await onReadinessRequest({request,env,next:async()=>new Response('unexpected')});
  const body=await response.json();
  assert.equal(response.status,200);
  assert.equal(body.ready,true);
  assert.equal(body.status,'ready');
  for(const check of Object.values(body.checks))if(check.required){assert.equal(check.configured,true);assert.equal(check.proven,true);}
});

test('readiness GET delegates through middleware to its dedicated route owner',async()=>{
  let nextCalls=0;
  const request=new Request(`${SITE}/api/v1/readiness`);
  const response=await onRequest({request,env:environment(),next:async()=>{nextCalls+=1;return new Response('dedicated-readiness',{status:204});}});
  assert.equal(nextCalls,1);
  assert.equal(response.status,204);
});

test('unsafe Auth mutations fail closed when Origin is absent',async()=>{
  for(const path of ['auth/login','auth/register','auth/recovery','auth/callback','auth/password','auth/refresh','auth/logout']){
    let nextCalls=0;
    const request=new Request(`${SITE}/api/v1/${path}`,{method:'POST',headers:{'content-type':'application/json'},body:'{}'});
    const response=await onRequest({request,env:environment(),next:async()=>{nextCalls+=1;return new Response('unsafe-auth-bypass',{status:204});}});
    assert.equal(nextCalls,0,path);
    assert.equal(response.status,403,path);
  }
});

test('same-origin Auth mutations continue to the existing Auth handler',async()=>{
  for(const path of ['auth/login','auth/recovery','auth/callback','auth/password','auth/refresh','auth/logout']){
    let nextCalls=0;
    const request=new Request(`${SITE}/api/v1/${path}`,{method:'POST',headers:browserHeaders({'content-type':'application/json'}),body:'{}'});
    const response=await onRequest({request,env:environment(),next:async()=>{nextCalls+=1;return new Response(null,{status:204});}});
    assert.equal(nextCalls,1,path);
    assert.equal(response.status,204,path);
  }
});

test('governance writes are intercepted before the legacy route handler',async()=>{
  for(const path of ['cloud/opt-in','account/delete']){
    let nextCalls=0;
    const request=new Request(`${SITE}/api/v1/${path}`,{method:'POST',headers:browserHeaders()});
    const response=await onRequest({request,env:environment(),next:async()=>{nextCalls+=1;return new Response('legacy');}});
    assert.equal(nextCalls,0,path);
    assert.equal(response.status,401,path);
  }
});

test('registration preferences are validated before the existing Auth handler runs when email delivery is enabled',async()=>{
  const enabled=environment({QELLY_ENABLE_AUTH_EMAIL_DELIVERY:'true'});
  for(const payload of [
    {baseCurrency:'XYZ',timezone:'UTC'},
    {baseCurrency:'USD',timezone:'Not/A_Real_Zone'},
    {baseCurrency:'USD'}
  ]){
    let nextCalls=0;
    const request=new Request(`${SITE}/api/v1/auth/register`,{method:'POST',headers:browserHeaders({'content-type':'application/json'}),body:JSON.stringify(payload)});
    const response=await onRequest({request,env:enabled,next:async()=>{nextCalls+=1;return new Response('accepted',{status:202});}});
    assert.equal(nextCalls,0);
    assert.equal(response.status,400);
  }

  let nextCalls=0;
  const validRequest=new Request(`${SITE}/api/v1/auth/register`,{method:'POST',headers:browserHeaders({'content-type':'application/json'}),body:JSON.stringify({baseCurrency:'INR',timezone:'Asia/Kolkata'})});
  const validResponse=await onRequest({request:validRequest,env:enabled,next:async()=>{nextCalls+=1;return new Response('accepted',{status:202});}});
  assert.equal(nextCalls,1);
  assert.equal(validResponse.status,202);
});

test('registration remains delegated to the existing fail-closed Auth handler while email delivery is disabled',async()=>{
  let nextCalls=0;
  const request=new Request(`${SITE}/api/v1/auth/register`,{method:'POST',headers:browserHeaders({'content-type':'application/json'}),body:JSON.stringify({})});
  const response=await onRequest({request,env:environment(),next:async()=>{nextCalls+=1;return new Response('legacy-auth-boundary',{status:503});}});
  assert.equal(nextCalls,1);
  assert.equal(response.status,503);
});

test('safe Auth reads and non-governed API routes continue through the existing handler',async()=>{
  for(const path of ['auth/me','health']){
    let nextCalls=0;
    const request=new Request(`${SITE}/api/v1/${path}`);
    const response=await onRequest({request,env:environment(),next:async()=>{nextCalls+=1;return new Response(null,{status:204});}});
    assert.equal(nextCalls,1,path);
    assert.equal(response.status,204,path);
  }
});

test('middleware source owns governed mutations but not readiness evidence collection',async()=>{
  const source=await readFile(new URL('../functions/api/v1/_middleware.js',import.meta.url),'utf8');
  const readinessSource=await readFile(new URL('../functions/api/v1/readiness.js',import.meta.url),'utf8');
  assert.equal(__middlewareTest.governanceRoute('cloud/opt-in','POST'),true);
  assert.equal(__middlewareTest.governanceRoute('account/delete','POST'),true);
  assert.equal(__middlewareTest.governanceRoute('cloud/opt-in','GET'),false);
  assert.equal(__middlewareTest.registrationRoute('auth/register','POST'),true);
  assert.equal(__middlewareTest.registrationRoute('auth/register','GET'),false);
  assert.equal(__middlewareTest.authMutationRoute('auth/recovery','POST'),true);
  assert.equal(__middlewareTest.authMutationRoute('auth/me','GET'),false);
  assert.equal(__middlewareTest.unsafeMethod('POST'),true);
  assert.equal(__middlewareTest.unsafeMethod('OPTIONS'),false);
  assert.match(source,/handleGovernance/);
  assert.doesNotMatch(source,/collectReadinessEvidence/);
  assert.doesNotMatch(source,/readinessSnapshot/);
  assert.doesNotMatch(source,/interceptReadiness/);
  assert.match(readinessSource,/collectReadinessEvidence/);
  assert.match(readinessSource,/readinessSnapshot/);
  assert.match(source,/safeBaseCurrency/);
  assert.match(source,/safeTimezone/);
  assert.match(source,/requireOrigin\(request,env\)/);
  assert.match(source,/interceptAuthMutation/);
});
