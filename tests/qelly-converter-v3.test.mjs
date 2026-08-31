import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {buildPublicConverter} from '../functions/_lib/public-converter.js';

const read=(path)=>readFile(new URL(`../${path}`,import.meta.url),'utf8');
const provider={truthState:'cached_provider',observationTime:'2026-08-28T16:00:00Z',ingestionTime:'2026-08-31T08:00:00Z',freshness:'daily-working-day-reference',quality:'official-central-bank-reference',attribution:'European Central Bank euro foreign exchange reference rates',license:'attribution required',data:{base:'EUR',rates:{USD:1.16,INR:110,GBP:.86,INVALID:-2,ETH:0}}};

test('Converter backend exposes one governed observation without creating quotes',()=>{
  const result=buildPublicConverter(provider);
  assert.equal(result.version,'governed-fx-converter-v3');
  assert.equal(result.state,'reference-workbench-available');
  assert.equal(result.summary.currenciesAvailable,4);
  assert.equal(result.summary.routesAvailable,12);
  assert.equal(result.summary.calculatedQuotes,0);
  assert.deepEqual(result.currencies.map((item)=>item.code),['EUR','GBP','INR','USD']);
  assert.equal(result.observation.truthState,'cached-reference');
  assert.equal(result.method.formula,'amount ÷ source-per-EUR × target-per-EUR');
  assert.equal(result.boundaries.syntheticRates,false);
  assert.equal(result.boundaries.tradableQuote,false);
  assert.equal(result.boundaries.execution,false);
  assert.equal(result.boundaries.userDeclaredCosts,true);
});

test('Converter backend fails closed when the approved observation is absent',()=>{
  const result=buildPublicConverter({truthState:'unavailable',data:null});
  assert.equal(result.state,'unavailable');
  assert.equal(result.currencies.length,0);
  assert.equal(result.summary.currenciesAvailable,0);
  assert.equal(result.summary.routesAvailable,0);
  assert.equal(result.observation.observedAt,null);
});

test('public Converter API, evidence runtime and lazy route are wired',async()=>{
  const [handler,policy,app,registry,finalizer,worker,openapi,evidence]=await Promise.all([read('functions/api/v1/[[path]].js'),read('src/server/api-access-policy.mjs'),read('apps/web/public/assets/app.js'),read('apps/web/public/assets/route-registry.mjs'),read('scripts/finalize-governed-discovery.mjs'),read('apps/web/public/qelly-service-worker.js'),read('packages/openapi/qelly.openapi.json'),read('scripts/release-a5-evidence-server.mjs')]);
  assert.match(handler,/path==='discovery\/converter'&&readMethod\(method\)/);
  assert.match(handler,/providerResult\(context,'ecb','fx-reference-rates','EUR',\{\}\)/);
  assert.match(handler,/buildPublicConverter\(ecb\)/);
  assert.match(policy,/'\/api\/v1\/discovery\/converter'/);
  assert.match(app,/renderConverterWorkspace=lazyRoute\('\.\/routes\/converter\.mjs','renderConverterWorkspace'\)/);
  assert.match(app,/case 'converter': await renderConverterWorkspace/);
  assert.match(registry,/route:'converter'.*public:true/);
  assert.doesNotMatch(finalizer,/renderGovernedConverterV2/);
  assert.match(worker,/converter-v3\.css/);
  assert.match(worker,/converter\.mjs/);
  assert.match(evidence,/url\.pathname==='\/api\/v1\/discovery\/converter'[\s\S]*buildPublicConverter\(evidenceEcb\(\)\)/);
  assert.deepEqual(Object.keys(JSON.parse(openapi).paths['/api/v1/discovery/converter'].get.responses).sort(),['200','429']);
});

test('Converter UI is purpose-distinct, cost-transparent and responsive',async()=>{
  const [source,css]=await Promise.all([read('apps/web/public/assets/routes/converter.mjs'),read('apps/web/public/assets/routes/converter-v3.css')]);
  for(const phrase of ['reference-workbench-v3','Know the reference. Declare the costs. Keep the difference visible.','Separate the reference result from the cost layer.','Reconstruction receipt','Same assumptions at three amounts','No rate or conversion result was substituted'])assert.match(source,new RegExp(phrase));
  assert.match(source,/gross=amount\*cross/);
  assert.match(source,/spreadCost=gross\*spread\/10000/);
  assert.match(source,/feeCost=afterSpread\*fee\/10000/);
  assert.match(source,/data-converter-swap/);
  assert.match(source,/data-converter-preset/);
  assert.match(css,/@container\(max-width:1180px\)/);
  assert.match(css,/@container\(max-width:620px\)/);
  assert.doesNotMatch(css,/visibility\s*:\s*hidden/);
});
