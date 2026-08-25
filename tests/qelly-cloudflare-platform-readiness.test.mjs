import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {platformReadinessSnapshot} from '../functions/_lib/platform-readiness.js';

const runtime=Object.freeze({
  environment:'cloudflare-pages-production',
  releaseSha:'abc123def456',
  publicSiteUrl:'https://qelly-intelligence.pages.dev',
  supabaseUrl:'https://example.supabase.co',
  supabasePublishableKey:'publishable-key-long-enough-for-test',
  capabilities:Object.freeze({authentication:true,emailDelivery:true,cloudSync:true,liveProviders:true})
});

const provenEvidence=Object.freeze({
  supabase:Object.freeze({proven:true,state:'supabase_auth_health_proven'}),
  authEmail:Object.freeze({proven:true,state:'email_delivery_canary_proven',verifiedAt:'2026-08-14'}),
  rlsIsolation:Object.freeze({proven:true,state:'rls_isolation_canary_proven',verifiedAt:'2026-08-14'}),
  providerFreshness:Object.freeze({proven:true,state:'ecb_reference_freshness_proven',truthState:'delayed_provider',observedAt:'2026-08-15T16:00:00.000Z'})
});

test('Cloudflare platform readiness separates proven infrastructure from rights-restricted providers',()=>{
  const snapshot=platformReadinessSnapshot(runtime,provenEvidence);
  assert.equal(snapshot.ready,true);
  assert.equal(snapshot.readinessStatus,'ready');
  assert.equal(snapshot.gates.find((item)=>item.id==='supabase')?.status,'ready');
  assert.equal(snapshot.gates.find((item)=>item.id==='ecb-reference')?.truthState,'DELAYED');
  assert.equal(snapshot.gates.find((item)=>item.id==='binance-market-data')?.status,'deferred');
  assert.equal(snapshot.gates.find((item)=>item.id==='coinbase-market-data')?.status,'deferred');
  const binance=snapshot.providers.find((item)=>item.id==='binance');
  const coinbase=snapshot.providers.find((item)=>item.id==='coinbase');
  const ecb=snapshot.providers.find((item)=>item.id==='ecb');
  const demo=snapshot.providers.find((item)=>item.id==='qelly-governed-demo');
  assert.equal(binance.policyState,'rights-restricted');
  assert.equal(binance.healthState,'not-called-policy-disabled');
  assert.equal(coinbase.policyState,'rights-restricted');
  assert.equal(ecb.policyState,'approved-reference');
  assert.equal(ecb.truthState,'DELAYED');
  assert.equal(demo.truthState,'SIMULATED');
  assert.equal(snapshot.safety.readOnly,true);
  assert.equal(snapshot.safety.tradeExecution,false);
  assert.equal(snapshot.safety.custody,false);
});

test('required dependency failure remains blocked instead of being disguised as provider policy',()=>{
  const snapshot=platformReadinessSnapshot(runtime,{...provenEvidence,supabase:{proven:false,state:'supabase_auth_health_http_503'}});
  assert.equal(snapshot.ready,false);
  assert.equal(snapshot.gates.find((item)=>item.id==='supabase')?.status,'blocked');
  assert.equal(snapshot.summary.blocked,1);
  assert.equal(snapshot.gates.find((item)=>item.id==='binance-market-data')?.status,'deferred');
});

test('canonical Cloudflare route owns platform readiness and the UI consumes its evidence model',async()=>{
  const [route,catchAll,ui]=await Promise.all([
    readFile(new URL('../functions/api/v1/platform/readiness.js',import.meta.url),'utf8'),
    readFile(new URL('../functions/api/v1/[[path]].js',import.meta.url),'utf8'),
    readFile(new URL('../apps/web/public/assets/routes/platform-readiness.mjs',import.meta.url),'utf8')
  ]);
  assert.match(route,/collectReadinessEvidence/);
  assert.match(route,/platformReadinessSnapshot/);
  assert.match(route,/providerCatalog/);
  assert.match(route,/cache:'no-store'/);
  assert.doesNotMatch(catchAll,/path==='platform\/readiness'/);
  assert.match(ui,/\/api\/v1\/platform\/readiness/);
  assert.match(ui,/Data source permissions/);
  assert.match(ui,/Financial safety boundary/);
  assert.match(ui,/customer-readable view/);
  assert.match(ui,/providerPolicyMessage/);
});
