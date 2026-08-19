import test from 'node:test';
import assert from 'node:assert/strict';
import {readinessSnapshot} from '../functions/_lib/readiness.js';

const evidence=Object.freeze({
  supabase:Object.freeze({proven:true,state:'supabase_auth_health_proven'}),
  authEmail:Object.freeze({proven:false,state:'email_delivery_fail_closed'}),
  rlsIsolation:Object.freeze({proven:true,state:'rls_isolation_canary_proven'}),
  providerFreshness:Object.freeze({proven:true,state:'intentionally_unavailable_rights_restricted'})
});

const runtime=(authentication)=>Object.freeze({
  supabaseUrl:'https://project.supabase.co',
  supabasePublishableKey:'sb_publishable_abcdefghijklmnopqrstuvwxyz123456',
  capabilities:Object.freeze({
    authentication,
    emailDelivery:false,
    cloudSync:false,
    liveProviders:false
  }),
  releaseSha:'test-release'
});

test('email delivery is not a readiness requirement when authentication is intentionally disabled',()=>{
  const snapshot=readinessSnapshot(runtime(false),evidence);
  assert.equal(snapshot.checks.authEmail.required,false);
  assert.equal(snapshot.checks.authEmail.configured,false);
  assert.equal(snapshot.checks.authEmail.proven,true);
  assert.equal(snapshot.checks.authEmail.state,'not_required');
  assert.equal(snapshot.ready,true);
  assert.equal(snapshot.status,'ready');
});

test('email delivery remains fail-closed when authentication is enabled',()=>{
  const snapshot=readinessSnapshot(runtime(true),evidence);
  assert.equal(snapshot.checks.authEmail.required,true);
  assert.equal(snapshot.checks.authEmail.configured,false);
  assert.equal(snapshot.checks.authEmail.proven,false);
  assert.equal(snapshot.checks.authEmail.state,'email_delivery_fail_closed');
  assert.equal(snapshot.ready,false);
  assert.equal(snapshot.status,'not_proven');
  assert.match(snapshot.reason,/authEmail/);
});
