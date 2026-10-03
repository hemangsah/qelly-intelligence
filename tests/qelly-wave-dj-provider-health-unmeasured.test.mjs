import test from 'node:test';
import assert from 'node:assert/strict';
import {__providerRuntimeTest} from '../functions/api/v1/providers/runtime.js';

const runtime=(liveProviders)=>({
  releaseSha:'tested-head',environment:'cloudflare-pages-production',
  publicSiteUrl:'https://terminal.qellyintelligence.com',
  capabilities:{liveProviders}
});

test('enabled ECB policy is not represented as measured 100% runtime health',()=>{
  const inventory=__providerRuntimeTest.runtimeProviderInventory(runtime(true));
  const ecb=inventory.items.find(x=>x.providerId==='ecb');
  assert.equal(ecb.status,'enabled');
  assert.equal(ecb.selectionRole,'reference');
  assert.equal(ecb.truthState,'DELAYED');
  assert.equal(ecb.quality.score,null);
  assert.equal(ecb.quality.latencyMs,null);
  assert.equal(ecb.quality.failureCount,null);
  assert.equal(ecb.quality.quotaRemaining,null);
  assert.equal(ecb.quality.lastSuccessAt,null);
  assert.equal(ecb.quality.observedAt,null);
  assert.equal(ecb.quality.status,'UNMEASURED');
  assert.match(ecb.quality.boundary,/not probed availability/);
  assert.equal(ecb.breaker.state,'not-observed');
  assert.equal(inventory.providers.find(x=>x.id==='ecb').healthState,'UNMEASURED');
  assert.equal(inventory.providers.find(x=>x.id==='ecb').observedAt,null);
  assert.equal(inventory.guardrails.healthMetricsAreMeasured,false);
  assert.equal(inventory.guardrails.providerProbesPerformed,false);
});

test('rights-restricted providers are never called or granted fabricated success metrics',()=>{
  const inventory=__providerRuntimeTest.runtimeProviderInventory(runtime(true));
  for(const id of ['binance','coinbase']){
    const entry=inventory.items.find(x=>x.providerId===id);
    assert.equal(entry.status,'disabled');
    assert.equal(entry.truthState,'UNAVAILABLE');
    assert.equal(entry.quality.score,null);
    assert.equal(entry.quality.latencyMs,null);
    assert.equal(entry.quality.status,'NOT_CALLED');
    assert.equal(entry.breaker.state,'disabled');
    assert.equal(inventory.providers.find(x=>x.id===id).runtimeState,'UNAVAILABLE');
    assert.equal(inventory.providers.find(x=>x.id===id).healthState,'NOT_CALLED');
  }
});

test('disabled live-provider feature never manufactures freshness, uptime or measured scores',()=>{
  const inventory=__providerRuntimeTest.runtimeProviderInventory(runtime(false));
  assert.equal(inventory.liveProviderFeatureEnabled,false);
  assert.equal(inventory.providers.find(x=>x.id==='ecb').runtimeState,'UNAVAILABLE');
  for(const entry of inventory.items){
    assert.equal(entry.status,'disabled');
    assert.equal(entry.quality.status,'NOT_CALLED');
    assert.equal(entry.quality.score,null);
    assert.equal(entry.quality.latencyMs,null);
    assert.equal(entry.quality.failureCount,null);
    assert.equal(entry.quality.lastSuccessAt,null);
    assert.equal(entry.quality.freshnessClass,'unavailable');
    assert.equal(entry.truthState,'UNAVAILABLE');
    assert.equal(entry.breaker.state,'disabled');
  }
});

test('runtime inventory cannot be interpreted as telemetry or trade execution capability',()=>{
  const inventory=__providerRuntimeTest.runtimeProviderInventory(runtime(true));
  assert.equal(inventory.truthState,'AUDIT');
  assert.equal(inventory.guardrails.readOnly,true);
  assert.equal(inventory.guardrails.execution,false);
  assert.equal(inventory.guardrails.credentialsExposed,false);
  assert.equal(inventory.guardrails.policyDisabledProvidersAreNotCalled,true);
  assert.ok(inventory.items.every(entry=>entry.execution===false));
  assert.ok(inventory.items.every(entry=>entry.quality.score===null));
  assert.doesNotMatch(JSON.stringify(inventory),/"score":100|"breaker":{"state":"closed"/);
});
