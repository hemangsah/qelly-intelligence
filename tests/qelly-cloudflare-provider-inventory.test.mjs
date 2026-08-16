import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {__publicProvidersTest} from '../functions/api/v1/public/providers.js';
import {__providerRuntimeTest} from '../functions/api/v1/providers/runtime.js';
import {matchUnavailableCapability} from '../functions/_lib/capability-registry.js';

const runtime={
  releaseSha:'test-sha',
  environment:'cloudflare-pages-production',
  publicSiteUrl:'https://qelly-intelligence.pages.dev',
  capabilities:{liveProviders:true}
};

test('public provider inventory preserves rights restrictions and read-only boundary',()=>{
  const inventory=__publicProvidersTest.publicProviderInventory();
  assert.equal(inventory.truthState,'AUDIT');
  assert.equal(inventory.guardrails.execution,false);
  assert.equal(inventory.guardrails.credentialsExposed,false);
  const binance=inventory.providers.find((item)=>item.id==='binance');
  const coinbase=inventory.providers.find((item)=>item.id==='coinbase');
  const ecb=inventory.providers.find((item)=>item.id==='ecb');
  assert.equal(binance.enabled,false);
  assert.equal(binance.presentationState,'UNAVAILABLE');
  assert.match(binance.termsState,/blocked_/);
  assert.equal(coinbase.enabled,false);
  assert.equal(coinbase.presentationState,'UNAVAILABLE');
  assert.equal(ecb.enabled,true);
  assert.equal(ecb.presentationState,'REFERENCE');
});

test('runtime provider inventory does not convert policy-disabled providers into live data',()=>{
  const inventory=__providerRuntimeTest.runtimeProviderInventory(runtime);
  assert.equal(inventory.releaseSha,'test-sha');
  assert.equal(inventory.guardrails.policyDisabledProvidersAreNotCalled,true);
  assert.equal(inventory.providers.find((item)=>item.id==='binance').runtimeState,'UNAVAILABLE');
  assert.equal(inventory.providers.find((item)=>item.id==='coinbase').runtimeState,'UNAVAILABLE');
  assert.equal(inventory.providers.find((item)=>item.id==='ecb').runtimeState,'REFERENCE_ENABLED');
});

test('promoted provider inventory routes are no longer capability debt',async()=>{
  assert.equal(matchUnavailableCapability('providers/runtime'),null);
  assert.equal(matchUnavailableCapability('public/providers'),null);
  const [runtimeRoute,publicRoute]=await Promise.all([
    readFile(new URL('../functions/api/v1/providers/runtime.js',import.meta.url),'utf8'),
    readFile(new URL('../functions/api/v1/public/providers.js',import.meta.url),'utf8')
  ]);
  assert.match(runtimeRoute,/providerCatalog/);
  assert.match(publicRoute,/providerCatalog/);
  assert.doesNotMatch(runtimeRoute,/service[_ -]?role|private[_ -]?key|access[_ -]?token/i);
  assert.doesNotMatch(publicRoute,/service[_ -]?role|private[_ -]?key|access[_ -]?token/i);
});
