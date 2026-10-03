import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {providerDisplayModel} from '../apps/web/public/assets/routes/platform-readiness.mjs';
import {platformReadinessSnapshot} from '../functions/_lib/platform-readiness.js';
const runtime=Object.freeze({environment:'cloudflare-pages-production',releaseSha:'2026test',publicSiteUrl:'https://terminal.qellyintelligence.com',capabilities:{authentication:true,emailDelivery:true,cloudSync:true,liveProviders:true}});
const proof={
 supabase:{proven:true,state:'supabase_auth_health_proven'},
 authEmail:{proven:true,state:'email_delivery_canary_proven'},
 rlsIsolation:{proven:true,state:'rls_isolation_canary_proven'},
 providerFreshness:{proven:true,state:'ecb_reference_freshness_proven',truthState:'delayed_provider',observedAt:'2026-10-02T16:00:00.000Z'}
};
test('UI derives ECB reference observation only from existing trusted readiness evidence',()=>{
 const providers=platformReadinessSnapshot(runtime,proof).providers;
 const ecb=providerDisplayModel(providers.find(x=>x.id==='ecb'));
 assert.equal(ecb.name,'European Central Bank');
 assert.equal(ecb.truthState,'DELAYED');
 assert.equal(ecb.approval,'Policy enabled');
 assert.equal(ecb.observation,'2026-10-02T16:00:00.000Z');
 assert.deepEqual(ecb.capabilities,['FX reference rates']);
 assert.equal(ecb.latencyState,'Not measured');
 assert.equal(ecb.quotaState,'Not reported');
 assert.equal(ecb.failureCount,null);
});
test('rights-restricted Binance and Coinbase are never elevated by spoofed LIVE or observation claims',()=>{
 const providers=platformReadinessSnapshot(runtime,proof).providers;
 for(const id of ['binance','coinbase']){
  const r=providers.find(x=>x.id===id),out=providerDisplayModel({...r,truthState:'LIVE',observedAt:'2026-10-03T08:00:00.000Z'});
  assert.equal(out.enabled,false);
  assert.equal(out.truthState,'UNAVAILABLE');
  assert.equal(out.observation,null);
  assert.equal(out.approval,'Display unavailable');
  assert.match(out.health,/Not polled/);
  assert.match(out.policy,/approval/i);
 }
});
test('demonstration always remains visibly simulated and has no invented source timestamp',()=>{
 const source=platformReadinessSnapshot(runtime,proof).providers.find(x=>x.id==='qelly-governed-demo');
 const m=providerDisplayModel({...source,truthState:'LIVE',observedAt:'2026-10-03T08:00:00.000Z'});
 assert.equal(m.truthState,'SIMULATED');
 assert.equal(m.enabled,false);
 assert.equal(m.observation,null);
 assert.equal(m.approval,'Simulation only');
 assert.match(m.health,/no independent provider status/);
});
test('unknown or malformed provider state fails closed instead of advertising coverage',()=>{
 const x=providerDisplayModel({id:'malformed',enabled:'true',truthState:'LIVE',capabilities:['unexpected-capability','quote']});
 assert.equal(x.truthState,'UNAVAILABLE');
 assert.equal(x.enabled,false);
 assert.deepEqual(x.capabilities,[]); // Unregistered feeds may not advertise any licensed coverage
 assert.equal(x.observation,null);
 const y=providerDisplayModel({id:'not-trusted',enabled:true,truthState:'PREDICTIVE',observedAt:'not a date'});
 assert.equal(y.truthState,'UNAVAILABLE');
 assert.equal(y.observation,null);
});
test('unrecognized providers and inherited object keys can never advertise market availability',()=>{
 for(const id of ['future-unapproved','constructor','__proto__']){
  const row=providerDisplayModel({id,enabled:true,truthState:'LIVE',observedAt:'2026-10-03T08:00:00.000Z',capabilities:['quote','constructor','__proto__']});
  assert.equal(row.name,'Unidentified provider');
  assert.equal(row.enabled,false);
  assert.equal(row.truthState,'UNAVAILABLE');
  assert.equal(row.observation,null);
  assert.deepEqual(row.capabilities,[]);
 }
 const known=providerDisplayModel({id:'ecb',enabled:true,truthState:'DELAYED',capabilities:['fx-reference-rates','constructor']});
 assert.deepEqual(known.capabilities,['FX reference rates']);
});
test('public readiness UI renders bounded policy provenance with escaping and explicit missing metrics',async()=>{
 const [ui,backend]=await Promise.all([
  readFile(new URL('../apps/web/public/assets/routes/platform-readiness.mjs',import.meta.url),'utf8'),
  readFile(new URL('../functions/_lib/platform-readiness.js',import.meta.url),'utf8')
 ]);
 assert.match(ui,/api\\\/v1\\\/platform\\\/readiness|\/api\/v1\/platform\/readiness/);
 assert.match(ui,/data-provenance="governed-provider-coverage"/);
 assert.match(ui,/providers\.map\(provider=>/);
 for(const key of ['provider.id','provider.name','provider.policy','provider.health','provider.observation','provider.approval','provider.capabilities'])assert.match(ui,new RegExp('escapeHtml\\(provider\\.'+key.split('.')[1]));
 for(const token of ['Latency: Not measured','Quota: Not reported','No market coverage has been inferred','Reference observations are not executable live trading quotes'])assert.ok(ui.includes(token),token);
 assert.match(backend,/providerTruthState\(policy,evidence\.providerFreshness\)/);
 assert.match(backend,/providerPolicyState\(policy\)/);
 assert.doesNotMatch(ui,/fetch\(['"]https:\/\/api\.binance\.com|fetch\(['"]https:\/\/api\.exchange\.coinbase\.com/);
 
 assert.match(ui,/ensureProviderCoverageStyles\(\);/);
 assert.match(ui,/platform-readiness-provider-coverage\.css/);
});
test('the independent provider evidence section remains legible across mobile and themes',async()=>{
 const css=await readFile(new URL('../apps/web/public/assets/routes/platform-readiness-provider-coverage.css',import.meta.url),'utf8');
 assert.match(css,/font-size:15px/);
 assert.match(css,/font-size:12px/);
 assert.match(css,/@media\(max-width:650px\)/);
 assert.match(css,/prefers-reduced-motion/);
 assert.doesNotMatch(css,/font-size:[89]px|#[0-9a-fA-F]{3,8}/);
});
