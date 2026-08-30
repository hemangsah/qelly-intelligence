import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {buildAssetRankings} from '../functions/_lib/market-network.js';

const read=(relative)=>readFile(new URL(`../${relative}`,import.meta.url),'utf8');
const sources=()=>(
  {
    'alternative-me':{
      label:'Alternative.me',attribution:'Alternative.me',usage:'Attribution required',truthState:'live',observedAt:'2026-08-30T00:00:00Z',fetchedAt:'2026-08-30T00:01:00Z',
      data:{assets:[
        {rank:1,symbol:'BTC',name:'Bitcoin',priceUsd:65000,change24hPct:2,marketCapUsd:1_250_000_000_000,volume24hUsd:45_000_000_000,updatedAt:'2026-08-30T00:00:00Z'},
        {rank:2,symbol:'ETH',name:'Ethereum',priceUsd:2500,change24hPct:-1,marketCapUsd:300_000_000_000,volume24hUsd:30_000_000_000,updatedAt:'2026-08-30T00:00:00Z'},
        {rank:3,symbol:'SOL',name:'Solana',priceUsd:150,change24hPct:5,marketCapUsd:75_000_000_000,volume24hUsd:9_000_000_000,updatedAt:'2026-08-30T00:00:00Z'},
        {rank:4,symbol:'MISS',name:'Incomplete',priceUsd:1,change24hPct:1,marketCapUsd:null,volume24hUsd:10}
      ]}
    },
    hyperliquid:{label:'Hyperliquid',attribution:'Hyperliquid public API',usage:'Read-only context',truthState:'cached',observedAt:'2026-08-30T00:00:30Z',fetchedAt:'2026-08-30T00:01:00Z',data:[{symbol:'BTC',mid:65020},{symbol:'SOL',mid:150.5}]}
  }
);

test('Asset Rankings derives transparent within-sample scores, exclusions and source context',()=>{
  const result=buildAssetRankings(sources());
  assert.equal(result.version,'governed-candidate-ranking-v1');
  assert.equal(result.state,'available');
  assert.equal(result.candidates.length,3);
  assert.equal(result.exclusions.length,1);
  assert.match(result.exclusions[0].reason,/marketCapUsd/);
  assert.equal(result.readiness.crossSourceCandidates,2);
  assert.equal(result.methodology.defaultCriterion,'balanced');
  assert.deepEqual(result.methodology.defaultWeights,{momentum:.35,liquidity:.30,size:.20,coverage:.15});
  assert.equal(result.candidates.find((row)=>row.symbol==='ETH').scores.coverage,0);
  assert.equal(result.candidates.find((row)=>row.symbol==='BTC').scores.coverage,100);
  assert.equal(result.candidates.find((row)=>row.symbol==='SOL').scores.momentum,100);
  assert.equal(result.candidates.every((row,index)=>row.rank===index+1),true);
  assert.deepEqual(result.boundaries,{withinSampleOnly:true,crossAsset:false,personalizedRecommendation:false,execution:false,fabricatedFallback:false,externalWidgetValuesConsumed:false});
});

test('Asset Rankings fails closed without a usable attributed primary source',()=>{
  const result=buildAssetRankings({'alternative-me':{truthState:'unavailable',data:null},hyperliquid:{truthState:'live',data:[{symbol:'BTC',mid:1}]}});
  assert.equal(result.state,'unavailable');
  assert.equal(result.candidates.length,0);
  assert.equal(result.readiness.primaryReady,false);
  assert.equal(result.boundaries.fabricatedFallback,false);
});

test('Asset Rankings V2 owns candidate ordering, filters, evidence and shortlist handoff',async()=>{
  const [route,handler]=await Promise.all([read('apps/web/public/assets/routes/asset-rankings-premium.mjs'),read('functions/api/v1/[[path]].js')]);
  for(const phrase of ['Unique job · candidate narrowing','Choose what “rank higher” means','compare evidence','Research shortlist','Method audit','Source ledger','Evidence inspector'])assert.match(route,new RegExp(phrase,'i'));
  for(const marker of ['data-rank-criterion','data-rank-search','data-rank-direction','data-rank-context','data-rank-select','data-rank-inspect','data-action="build-shortlist"'])assert.match(route,new RegExp(marker));
  assert.match(route,/A research shortlist can contain up to five candidates/);
  assert.match(route,/not treated as spot-price confirmation or an executable spread/);
  assert.match(handler,/assetRankings:buildAssetRankings\(sources\)/);
});

test('Asset Rankings V2 is container-responsive and offline packaged',async()=>{
  const [route,css,worker]=await Promise.all([read('apps/web/public/assets/routes/asset-rankings-premium.mjs'),read('apps/web/public/assets/routes/asset-rankings-v2.css'),read('apps/web/public/qelly-service-worker.js')]);
  assert.match(route,/asset-rankings-v2\.css\?v=20260830-rankings2/);
  assert.match(css,/container-type:inline-size/);
  assert.match(css,/@container \(max-width:1100px\)/);
  assert.match(css,/@container \(max-width:760px\)/);
  assert.match(css,/@container \(max-width:460px\)/);
  assert.match(css,/\.q-ar-candidate-grid/);
  assert.match(css,/\.q-ar-inspector/);
  assert.doesNotMatch(css,/visibility\s*:\s*hidden/);
  assert.match(worker,/assets\/routes\/asset-rankings-v2\.css/);
});
