import test from 'node:test';
import assert from 'node:assert/strict';
import {readinessSnapshot} from '../functions/_lib/readiness.js';

const runtime=(overrides={})=>({
  releaseSha:'readiness-test-sha',
  capabilities:{
    authentication:true,
    emailDelivery:true,
    cloudSync:true,
    liveProviders:false,
    ...overrides
  }
});

test('rights-restricted live providers are intentionally unavailable rather than a required broken dependency',()=>{
  const snapshot=readinessSnapshot(runtime());
  assert.equal(snapshot.ready,false);
  assert.equal(snapshot.status,'not_proven');
  assert.equal(snapshot.checks.providerFreshness.required,false);
  assert.equal(snapshot.checks.providerFreshness.configured,false);
  assert.equal(snapshot.checks.providerFreshness.proven,true);
  assert.equal(snapshot.checks.providerFreshness.state,'intentionally_unavailable_rights_restricted');
  assert.equal(snapshot.dependencies.providers,'intentionally_unavailable_rights_restricted');
  assert.equal(snapshot.checks.supabase.required,true);
  assert.equal(snapshot.checks.supabase.proven,false);
  assert.equal(snapshot.checks.authEmail.required,true);
  assert.equal(snapshot.checks.authEmail.proven,false);
  assert.equal(snapshot.checks.rlsIsolation.required,true);
  assert.equal(snapshot.checks.rlsIsolation.proven,false);
});

test('enabled live providers remain a required dependency until freshness is proven',()=>{
  const snapshot=readinessSnapshot(runtime({liveProviders:true}));
  assert.equal(snapshot.ready,false);
  assert.equal(snapshot.checks.providerFreshness.required,true);
  assert.equal(snapshot.checks.providerFreshness.configured,true);
  assert.equal(snapshot.checks.providerFreshness.proven,false);
  assert.equal(snapshot.checks.providerFreshness.state,'configured_but_freshness_not_proven');
});

test('email delivery remains fail-closed when capability is disabled',()=>{
  const snapshot=readinessSnapshot(runtime({emailDelivery:false}));
  assert.equal(snapshot.ready,false);
  assert.equal(snapshot.checks.authEmail.required,true);
  assert.equal(snapshot.checks.authEmail.configured,false);
  assert.equal(snapshot.checks.authEmail.proven,false);
  assert.equal(snapshot.checks.authEmail.state,'email_delivery_fail_closed');
});
