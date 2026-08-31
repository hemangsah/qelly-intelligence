import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {buildPublicAssetIntelligence} from '../functions/_lib/public-asset-intelligence.js';

const read=(path)=>readFile(new URL(`../${path}`,import.meta.url),'utf8');
const sources={
  'alternative-me':{truthState:'live',observedAt:'2026-08-31T09:00:00Z',label:'Alternative.me',attribution:'Alternative.me',data:{assets:[{symbol:'BTC',name:'Bitcoin',rank:1,priceUsd:112000,change24hPct:2.4,marketCapUsd:2200000000000,volume24hUsd:45000000000,updatedAt:'2026-08-31T09:00:00Z'}]}},
  hyperliquid:{truthState:'cached',observedAt:'2026-08-31T09:00:01Z',label:'Hyperliquid',attribution:'Hyperliquid',data:[{symbol:'BTC',mid:112050}]}
};

test('Asset Intelligence backend builds a truthful single-instrument diligence router',()=>{
  const result=buildPublicAssetIntelligence(sources,'BTC');
  assert.equal(result.version,'governed-asset-briefing-v2');
  assert.equal(result.state,'briefing-available');
  assert.equal(result.selected.id,'QI-CRYPTO-BTC');
  assert.equal(result.selected.observation.priceUsd,112000);
  assert.equal(result.selected.independentContext.valueUsd,112050);
  assert.equal(result.assets.length,10);
  assert.equal(result.evidenceTracks.length,6);
  assert.equal(result.lenses.length,5);
  assert.equal(result.handoffs.length,6);
  assert.equal(result.boundaries.identityCatalogIsObservation,false);
  assert.equal(result.boundaries.independentContextIsConfirmation,false);
  assert.equal(result.boundaries.personalizedRecommendation,false);
  assert.equal(result.boundaries.execution,false);
});

test('Asset Intelligence keeps observations empty when governed sources are absent',()=>{
  const result=buildPublicAssetIntelligence({},'ETH');
  assert.equal(result.selected.symbol,'ETH');
  assert.equal(result.selected.observation,null);
  assert.equal(result.selected.independentContext,null);
  assert.equal(result.summary.observedAssets,0);
  assert.equal(result.summary.independentContextAssets,0);
  assert.equal(result.evidenceTracks.find((item)=>item.id==='market').state,'unavailable');
  assert.equal(result.evidenceTracks.find((item)=>item.id==='identity').state,'available');
});

test('public Asset Intelligence API, route, access policy and release artifacts are wired',async()=>{
  const [handler,policy,app,registry,worker,openapi,evidence,capabilities,workflow]=await Promise.all([
    read('functions/api/v1/[[path]].js'),read('src/server/api-access-policy.mjs'),read('apps/web/public/assets/app.js'),read('apps/web/public/assets/route-registry.mjs'),read('apps/web/public/qelly-service-worker.js'),read('packages/openapi/qelly.openapi.json'),read('scripts/release-a5-evidence-server.mjs'),read('functions/_lib/capability-registry.js'),read('.github/workflows/browser-e2e.yml')
  ]);
  assert.match(handler,/path==='discovery\/asset-intelligence'&&readMethod\(method\)/);
  assert.match(handler,/buildPublicAssetIntelligence\(external\.sources,url\.searchParams\.get\('asset'\)/);
  assert.match(policy,/'\/api\/v1\/discovery\/asset-intelligence'/);
  assert.match(app,/renderAssetIntelligence=lazyRoute\('\.\/routes\/asset-intelligence\.mjs','renderAssetIntelligence'\)/);
  assert.match(registry,/route:'asset-intelligence'.*public:true/);
  assert.match(worker,/asset-intelligence-v2\.css/);
  assert.match(evidence,/url\.pathname==='\/api\/v1\/discovery\/asset-intelligence'/);
  assert.match(capabilities,/\['discovery\/asset-intelligence'\]/);
  assert.match(workflow,/asset-intelligence-v2\.css/);
  assert.deepEqual(Object.keys(JSON.parse(openapi).paths['/api/v1/discovery/asset-intelligence'].get.responses).sort(),['200','429']);
});

test('Asset Intelligence UI is purpose-distinct, interactive and responsive without hiding evidence',async()=>{
  const [source,css,responsiveScript,responsiveWorkflow]=await Promise.all([read('apps/web/public/assets/routes/asset-intelligence.mjs'),read('apps/web/public/assets/routes/asset-intelligence-v2.css'),read('scripts/release-v53-responsive-evidence.py'),read('.github/workflows/responsive-e2e.yml')]);
  for(const phrase of ['diligence-router-v2','Know what you know. Route what you still need.','Build a falsifiable instrument brief.','Six tracks, with every gap left visible.','One briefing, six non-overlapping handoffs.','No profile, observation, evidence or recommendation was substituted.'])assert.match(source,new RegExp(phrase));
  assert.match(source,/data-ai-asset/);assert.match(source,/data-ai-form/);assert.match(source,/data-ai-receipt/);assert.match(source,/data-ai-route/);
  assert.doesNotMatch(source,/QellyChartShell|QellyDataGrid|deterministic-fixture|Price fixture/);
  assert.match(css,/@container\(max-width:1180px\)/);assert.match(css,/@container\(max-width:620px\)/);assert.doesNotMatch(css,/visibility\s*:\s*hidden|display\s*:\s*none/);
  assert.match(responsiveScript,/REPRESENTATIVE_ROUTES=\[[\s\S]*'asset-intelligence'/);
  assert.match(responsiveWorkflow,/manifest\.routes\.includes\('asset-intelligence'\)/);
});
