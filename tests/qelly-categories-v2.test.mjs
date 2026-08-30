import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {buildPublicCategories} from '../functions/_lib/public-categories.js';
import {isPublicApiContractRoute} from '../src/server/api-access-policy.mjs';

const read=(relative)=>readFile(new URL(`../${relative}`,import.meta.url),'utf8');
const ranking={
  state:'available',
  universe:{label:'Attributed test sample',candidateCount:6,truthState:'live',observedAt:'2026-08-30T00:00:00Z'},
  sourceLedger:[{id:'primary',label:'Attributed provider',role:'Primary observations',truthState:'live'}],
  candidates:[
    {id:'QI-CRYPTO-BTC',symbol:'BTC',name:'Bitcoin',change24hPct:2,marketCapUsd:1000,volume24hUsd:100,turnoverPct:10,contextMidUsd:100,truthState:'live'},
    {id:'QI-CRYPTO-ETH',symbol:'ETH',name:'Ethereum',change24hPct:-1,marketCapUsd:500,volume24hUsd:100,turnoverPct:20,contextMidUsd:50,truthState:'live'},
    {id:'QI-CRYPTO-SOL',symbol:'SOL',name:'Solana',change24hPct:3,marketCapUsd:200,volume24hUsd:50,turnoverPct:25,contextMidUsd:null,truthState:'live'},
    {id:'QI-CRYPTO-USDT',symbol:'USDT',name:'Tether',change24hPct:0,marketCapUsd:300,volume24hUsd:200,turnoverPct:66.67,contextMidUsd:null,truthState:'live'},
    {id:'QI-CRYPTO-XMR',symbol:'XMR',name:'Monero',change24hPct:5,marketCapUsd:80,volume24hUsd:8,turnoverPct:10,contextMidUsd:null,truthState:'live'},
    {id:'QI-CRYPTO-NEW',symbol:'NEW',name:'Unmapped asset',change24hPct:-2,marketCapUsd:20,volume24hUsd:2,turnoverPct:10,contextMidUsd:null,truthState:'live'}
  ]
};

test('Categories assigns every candidate exactly once and exposes purpose-led metrics',()=>{
  const result=buildPublicCategories(ranking);
  assert.equal(result.version,'governed-category-taxonomy-v1');
  assert.equal(result.state,'available');
  assert.equal(result.readiness.totalCandidates,6);
  assert.equal(result.readiness.classifiedCandidates,5);
  assert.equal(result.readiness.unclassifiedCandidates,1);
  assert.equal(result.categories.flatMap((category)=>category.members).length,6);
  assert.equal(new Set(result.categories.flatMap((category)=>category.members.map((row)=>row.id))).size,6);
  const platforms=result.categories.find((category)=>category.id==='smart-contract-platforms');
  assert.equal(platforms.metrics.memberCount,2);
  assert.equal(platforms.metrics.medianChange24hPct,1);
  assert.equal(platforms.metrics.breadthPct,50);
  assert.equal(platforms.metrics.marketValueUsd,700);
  assert.equal(platforms.metrics.volume24hUsd,150);
  assert.match(platforms.purpose,/programmable base-layer/i);
  assert.match(platforms.useCase,/ecosystem capacity/i);
  assert.deepEqual(result.boundaries,{currentSampleOnly:true,primaryRoleNotInvestmentSector:true,noForecast:true,noRecommendation:true,noExecution:true,fabricatedFallback:false});
});

test('Categories fails closed on market observations while retaining taxonomy definitions',()=>{
  const result=buildPublicCategories({state:'unavailable',universe:{truthState:'unavailable'},candidates:[],sourceLedger:[]});
  assert.equal(result.state,'unavailable');
  assert.ok(result.categories.length>=6);
  assert.equal(result.categories.every((category)=>category.metrics.memberCount===0),true);
  assert.equal(result.categories.every((category)=>category.metrics.medianChange24hPct===null),true);
  assert.equal(result.boundaries.fabricatedFallback,false);
});

test('Categories route, public endpoint and production finalizer are fully wired',async()=>{
  assert.equal(isPublicApiContractRoute('/api/v1/discovery/categories'),true);
  const [handler,app,route,registry,finalizer,worker,openapi]=await Promise.all([
    read('functions/api/v1/[[path]].js'),read('apps/web/public/assets/app.js'),read('apps/web/public/assets/routes/categories.mjs'),read('apps/web/public/assets/route-registry.mjs'),read('scripts/finalize-governed-discovery.mjs'),read('apps/web/public/qelly-service-worker.js'),read('packages/openapi/qelly.openapi.json').then(JSON.parse)
  ]);
  assert.match(handler,/path==='discovery\/categories'&&readMethod\(method\)/);
  assert.match(handler,/buildPublicCategories\(buildAssetRankings\(external\.sources\)\)/);
  assert.match(app,/case 'categories': await renderCategoriesWorkspace/);
  assert.match(registry,/route:'categories'.*public:true/);
  assert.doesNotMatch(finalizer,/renderGovernedUnavailable\(main,\{api,pageHead,stateBanner,escapeHtml,navigate,toast,state\},'categories'\)/);
  for(const phrase of ['Unique job · taxonomy-led exploration','Browse by purpose','Category comparison','Method audit','Source ledger','Primary role ≠ investment sector'])assert.match(route,new RegExp(phrase,'i'));
  for(const marker of ['data-category-search','data-category-coverage','data-category-lens','data-category-open','data-category-compare'])assert.match(route,new RegExp(marker));
  assert.doesNotMatch(route,/method:'POST'/);
  assert.match(worker,/assets\/routes\/categories-v2\.css/);
  assert.match(worker,/assets\/routes\/categories\.mjs/);
  assert.deepEqual(Object.keys(openapi.paths['/api/v1/discovery/categories'].get.responses),['200','429']);
});

test('Categories UI is container-responsive and does not hide content',async()=>{
  const [route,css]=await Promise.all([read('apps/web/public/assets/routes/categories.mjs'),read('apps/web/public/assets/routes/categories-v2.css')]);
  assert.match(route,/categories-v2\.css\?v=20260830-categories1/);
  assert.match(route,/data-categories-experience="taxonomy-exploration-v2"/);
  assert.match(css,/container-type:inline-size/);
  assert.match(css,/@container \(max-width:1100px\)/);
  assert.match(css,/@container \(max-width:760px\)/);
  assert.match(css,/@container \(max-width:460px\)/);
  assert.match(css,/\.q-ct-member-table/);
  assert.doesNotMatch(css,/visibility\s*:\s*hidden/);
});
