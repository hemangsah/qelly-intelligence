import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {onRequest as readinessOnRequest} from '../functions/api/v1/readiness.js';

const env=(overrides={})=>({
  QELLY_PUBLIC_SITE_URL:'https://qelly-intelligence.pages.dev',
  QELLY_PUBLIC_SUPABASE_URL:'https://example.supabase.co',
  QELLY_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_test_key_long_enough_for_validation',
  QELLY_PUBLIC_RELEASE_SHA:'98a88d76bbba1017a40012aa2790213af6af485a',
  __fetch:async()=>new Response(JSON.stringify({status:'unavailable'}),{status:503,headers:{'content-type':'application/json'}}),
  ...overrides
});

test('canonical readiness can trust dated email evidence but remains not proven until other required dependencies pass',async()=>{
  const request=new Request('https://qelly-intelligence.pages.dev/api/v1/readiness');
  const response=await readinessOnRequest({request,env:env(),params:{path:['readiness']},next:async()=>new Response(null,{status:404})});
  const body=await response.json();
  assert.equal(response.status,503);
  assert.equal(body.ready,false);
  assert.equal(body.status,'not_proven');
  assert.equal(body.dependencies.supabase,'supabase_auth_health_http_503');
  assert.equal(body.dependencies.auth,'email_delivery_canary_proven');
  assert.equal(body.dependencies.providers,'ecb_reference_freshness_not_proven');
  assert.equal(body.checks.authEmail.configured,true);
  assert.equal(body.checks.authEmail.proven,true);
  assert.equal(body.checks.authEmail.evidence.capabilityAuthority,true);
  assert.equal(body.checks.providerFreshness.required,true);
  assert.equal(body.checks.rlsIsolation.proven,true);
});

test('explicit canonical email activation and the dated canary agree on capability authority',async()=>{
  const request=new Request('https://qelly-intelligence.pages.dev/api/v1/readiness');
  const response=await readinessOnRequest({request,env:env({QELLY_ENABLE_AUTH_EMAIL_DELIVERY:'true'}),params:{path:['readiness']},next:async()=>new Response(null,{status:404})});
  const body=await response.json();
  assert.equal(response.status,503);
  assert.equal(body.ready,false);
  assert.equal(body.dependencies.auth,'email_delivery_canary_proven');
  assert.equal(body.checks.authEmail.configured,true);
  assert.equal(body.checks.authEmail.proven,true);
  assert.equal(body.checks.authEmail.evidence.readinessEvidence,true);
  assert.equal(body.checks.authEmail.evidence.capabilityAuthority,true);
  assert.equal(body.checks.authEmail.evidence.evidenceMethod,'confirmation_sent_at_then_email_confirmed_at');
});

test('explicit canonical email disable remains an operator kill switch',async()=>{
  const request=new Request('https://qelly-intelligence.pages.dev/api/v1/readiness');
  const response=await readinessOnRequest({request,env:env({QELLY_ENABLE_AUTH_EMAIL_DELIVERY:'false'}),params:{path:['readiness']},next:async()=>new Response(null,{status:404})});
  const body=await response.json();
  assert.equal(response.status,503);
  assert.equal(body.ready,false);
  assert.equal(body.dependencies.auth,'email_delivery_fail_closed');
  assert.equal(body.checks.authEmail.configured,false);
  assert.equal(body.checks.authEmail.proven,false);
  assert.equal(body.checks.authEmail.evidence.capabilityAuthority,true);
});

test('placeholder job, notification and foundation-ready routes are absent',async()=>{
  const router=await readFile(new URL('../functions/api/v1/[[path]].js',import.meta.url),'utf8');
  assert.doesNotMatch(router,/path==='jobs'/);
  assert.doesNotMatch(router,/path==='production-notifications'/);
  assert.doesNotMatch(router,/path==='production-foundation\/status'/);
  assert.match(router,/status:response\?\.status\?\?500/);
});

test('account page describes only the current browser session',async()=>{
  const account=await readFile(new URL('../apps/web/public/assets/routes/account-session.mjs',import.meta.url),'utf8');
  assert.doesNotMatch(account,/\/api\/v1\/jobs/);
  assert.doesNotMatch(account,/\/api\/v1\/production-notifications/);
  assert.doesNotMatch(account,/\/api\/v1\/production-foundation\/status/);
  assert.match(account,/Current browser session/);
  assert.match(account,/not a complete multi-device session inventory/);
  assert.match(account,/Sign out this browser/);
});
