import test from 'node:test';
import assert from 'node:assert/strict';
import {__test,onRequest,publicRuntimeConfig} from '../functions/api/v1/[[path]].js';

const environment=(overrides={})=>({
  QELLY_PUBLIC_SITE_URL:'https://qelly-readiness.test',
  QELLY_PUBLIC_SUPABASE_URL:'https://example.supabase.co',
  QELLY_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_readiness_test_1234567890',
  QELLY_PUBLIC_RELEASE_SHA:'1111111111111111111111111111111111111111',
  QELLY_ENABLE_AUTH:'true',
  QELLY_ENABLE_CLOUD_SYNC:'true',
  QELLY_ENABLE_LIVE_PROVIDERS:'true',
  QELLY_ENABLE_FEEDBACK_WRITES:'true',
  ...overrides
});

const readiness=async(overrides={})=>{
  const request=new Request('https://qelly-readiness.test/api/v1/readiness');
  const response=await onRequest({request,env:environment(overrides),params:{path:['readiness']},waitUntil(){}});
  return {response,body:await response.json()};
};

test('readiness snapshot remains fail-closed and exposes structured proof states',()=>{
  const snapshot=__test.readinessSnapshot(publicRuntimeConfig(environment()));
  assert.equal(snapshot.ready,false);
  assert.equal(snapshot.status,'not_proven');
  assert.equal(snapshot.checks.supabase.proven,false);
  assert.equal(snapshot.checks.authEmail.proven,false);
  assert.equal(snapshot.checks.rlsIsolation.proven,false);
  assert.equal(snapshot.checks.providerFreshness.proven,false);
  assert.equal(snapshot.dependencies.auth,'email_delivery_fail_closed');
  assert.equal(JSON.stringify(snapshot).includes('smtp_delivery_blocked'),false);
});

test('public readiness reports disabled email delivery as fail-closed',async()=>{
  const {response,body}=await readiness();
  assert.equal(response.status,503);
  assert.equal(body.ready,false);
  assert.equal(body.status,'not_proven');
  assert.equal(body.capabilities.emailDelivery,false);
  assert.equal(body.checks.authEmail.configured,false);
  assert.equal(body.dependencies.auth,'email_delivery_fail_closed');
});

test('configured email delivery never becomes ready without end-to-end proof',async()=>{
  const {response,body}=await readiness({QELLY_ENABLE_AUTH_EMAIL_DELIVERY:'true'});
  assert.equal(response.status,503);
  assert.equal(body.ready,false);
  assert.equal(body.status,'not_proven');
  assert.equal(body.capabilities.emailDelivery,true);
  assert.equal(body.checks.authEmail.configured,true);
  assert.equal(body.checks.authEmail.proven,false);
  assert.equal(body.dependencies.auth,'email_delivery_configured_not_end_to_end_proven');
});
