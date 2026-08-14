import test from 'node:test';
import assert from 'node:assert/strict';
import {collectReadinessEvidence,readinessSnapshot} from '../functions/_lib/readiness.js';

const CANONICAL='https://qelly-intelligence.pages.dev';
const runtime=(overrides={})=>({
  releaseSha:'readiness-test-sha',
  publicSiteUrl:overrides.publicSiteUrl||'https://qelly-readiness.test',
  supabaseUrl:'https://example.supabase.co',
  supabasePublishableKey:'sb_publishable_readiness_test_1234567890',
  capabilities:{
    authentication:true,
    emailDelivery:true,
    cloudSync:true,
    liveProviders:false,
    ...overrides
  }
});
const ecbXml=(date=new Date(Date.now()-24*60*60*1000).toISOString().slice(0,10))=>`<?xml version="1.0"?><Envelope><Cube><Cube time='${date}'><Cube currency='USD' rate='1.15'/><Cube currency='GBP' rate='0.86'/><Cube currency='INR' rate='105.1'/><Cube currency='JPY' rate='171.5'/><Cube currency='CHF' rate='0.94'/></Cube></Cube></Envelope>`;

test('rights-restricted live providers are intentionally unavailable rather than a required broken dependency',()=>{
  const snapshot=readinessSnapshot(runtime());
  assert.equal(snapshot.ready,false);
  assert.equal(snapshot.status,'not_proven');
  assert.equal(snapshot.checks.providerFreshness.required,false);
  assert.equal(snapshot.checks.providerFreshness.configured,false);
  assert.equal(snapshot.checks.providerFreshness.proven,true);
  assert.equal(snapshot.checks.providerFreshness.state,'intentionally_unavailable_rights_restricted');
  assert.equal(snapshot.checks.supabase.required,true);
  assert.equal(snapshot.checks.supabase.proven,false);
  assert.equal(snapshot.checks.authEmail.proven,false);
  assert.equal(snapshot.checks.rlsIsolation.proven,false);
});

test('fully injected production evidence can satisfy every required dependency',()=>{
  const snapshot=readinessSnapshot(runtime({publicSiteUrl:CANONICAL,liveProviders:true}),{
    supabase:{proven:true,state:'supabase_auth_health_proven'},
    authEmail:{proven:true,state:'email_delivery_canary_proven'},
    rlsIsolation:{proven:true,state:'rls_isolation_canary_proven'},
    providerFreshness:{proven:true,state:'ecb_reference_freshness_proven'}
  });
  assert.equal(snapshot.ready,true);
  assert.equal(snapshot.status,'ready');
  for(const value of Object.values(snapshot.checks)){
    if(value.required){assert.equal(value.configured,true);assert.equal(value.proven,true);}
  }
});

test('canonical collector proves Supabase health and governed ECB reference freshness with mocked providers',async()=>{
  const env={__fetch:async(url)=>{
    const target=String(url);
    if(target.endsWith('/auth/v1/health'))return new Response(JSON.stringify({version:'test'}),{status:200,headers:{'Content-Type':'application/json'}});
    if(target.includes('eurofxref-daily.xml'))return new Response(ecbXml(),{status:200,headers:{'Content-Type':'application/xml'}});
    throw new Error(`Unexpected URL ${target}`);
  }};
  const liveRuntime=runtime({publicSiteUrl:CANONICAL,liveProviders:true});
  const evidence=await collectReadinessEvidence({env},liveRuntime);
  assert.equal(evidence.supabase.proven,true);
  assert.equal(evidence.authEmail.proven,true);
  assert.equal(evidence.rlsIsolation.proven,true);
  assert.equal(evidence.providerFreshness.proven,true);
  assert.equal(evidence.providerFreshness.transactionUse,'not_for_transaction_execution');
  assert.equal(readinessSnapshot(liveRuntime,evidence).ready,true);
});

test('Supabase or governed provider canary failure keeps readiness fail-closed',async()=>{
  const env={__fetch:async(url)=>{
    const target=String(url);
    if(target.endsWith('/auth/v1/health'))return new Response(JSON.stringify({error:'down'}),{status:503,headers:{'Content-Type':'application/json'}});
    if(target.includes('eurofxref-daily.xml'))return new Response('<invalid/>',{status:200,headers:{'Content-Type':'application/xml'}});
    throw new Error(`Unexpected URL ${target}`);
  }};
  const liveRuntime=runtime({publicSiteUrl:CANONICAL,liveProviders:true});
  const evidence=await collectReadinessEvidence({env},liveRuntime);
  const snapshot=readinessSnapshot(liveRuntime,evidence);
  assert.equal(snapshot.ready,false);
  assert.equal(snapshot.checks.supabase.proven,false);
  assert.equal(snapshot.checks.providerFreshness.proven,false);
});

test('email delivery remains fail-closed when capability is disabled',()=>{
  const snapshot=readinessSnapshot(runtime({emailDelivery:false}),{
    supabase:{proven:true},rlsIsolation:{proven:true}
  });
  assert.equal(snapshot.ready,false);
  assert.equal(snapshot.checks.authEmail.required,true);
  assert.equal(snapshot.checks.authEmail.configured,false);
  assert.equal(snapshot.checks.authEmail.proven,false);
  assert.equal(snapshot.checks.authEmail.state,'email_delivery_fail_closed');
});
