import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {buildUniversalSearch,__test as searchInternals} from '../functions/_lib/public-search.js';
import {isPublicApiContractRoute} from '../src/server/api-access-policy.mjs';

const ranking={version:'ranking-test-v1',candidates:[
  {id:'QI-CRYPTO-BTC',symbol:'BTC',name:'Bitcoin',rank:1,truthState:'live',provider:'Attributed test provider',observedAt:'2026-08-30T00:00:00.000Z',priceUsd:60000,change24hPct:1.2,scores:{balanced:88}},
  {id:'QI-CRYPTO-ETH',symbol:'ETH',name:'Ethereum',rank:2,truthState:'cached',provider:'Attributed test provider',observedAt:'2026-08-30T00:00:00.000Z',priceUsd:3000,change24hPct:-.4,scores:{balanced:74}}
]};

test('Universal Search has a broad purpose-distinct governed corpus',()=>{
  const result=buildUniversalSearch({assetRankings:ranking,limit:50});
  assert.equal(result.version,'qelly-universal-search-v2');
  assert.ok(result.corpus.features>=60);
  assert.equal(result.corpus.formulas,151);
  assert.ok(result.corpus.indicators>=50);
  assert.equal(result.corpus.assets,2);
  assert.equal(result.boundaries.privateWorkspaceContent,false);
  assert.equal(result.boundaries.generativeSynthesis,false);
  assert.equal(result.boundaries.execution,false);
  assert.equal(result.boundaries.fabricatedObservations,false);
});

test('exact IDs and names outrank metadata matches with stable explanations',()=>{
  const btc=buildUniversalSearch({q:'BTC',assetRankings:ranking});
  assert.equal(btc.items[0].id,'QI-CRYPTO-BTC');
  assert.match(btc.items[0].whyMatched,/prefix|exact/i);
  const position=buildUniversalSearch({q:'position size',types:'formula',assetRankings:ranking});
  assert.equal(position.items[0].id,'position-size');
  assert.match(position.items[0].whyMatched,/Exact (identifier|name) match/);
  const decision=buildUniversalSearch({q:'decision evidence',types:'feature',assetRankings:ranking});
  assert.equal(decision.items[0].id,'decision-provenance');
  assert.match(decision.items[0].whyMatched,/Every query term/);
});

test('short-token search avoids accidental substring matches',()=>{
  const result=buildUniversalSearch({q:'RSI',assetRankings:ranking});
  assert.equal(result.items[0].id,'rsi');
  assert.equal(result.items.some((item)=>item.id==='converter'),false);
});

test('type and access filters preserve the public/private destination boundary',()=>{
  const publicFeatures=buildUniversalSearch({q:'',types:'feature',access:'public',limit:50,assetRankings:ranking});
  assert.ok(publicFeatures.items.length>0);
  assert.ok(publicFeatures.items.every((item)=>item.type==='feature'&&item.access==='public'));
  const workspace=buildUniversalSearch({q:'secret rotation',types:'feature',access:'workspace',assetRankings:ranking});
  assert.equal(workspace.items[0].id,'secret-rotation');
  assert.equal(workspace.items[0].access,'workspace');
});

test('public search endpoint and route surface are wired without enabling suggestions or mutation',async()=>{
  assert.equal(isPublicApiContractRoute('/api/v1/search'),true);
  assert.equal(isPublicApiContractRoute('/api/v1/search/suggestions'),false);
  const [handler,app,route,registry,worker]=await Promise.all([
    readFile(new URL('../functions/api/v1/[[path]].js',import.meta.url),'utf8'),
    readFile(new URL('../apps/web/public/assets/app.js',import.meta.url),'utf8'),
    readFile(new URL('../apps/web/public/assets/routes/universal-search.mjs',import.meta.url),'utf8'),
    readFile(new URL('../apps/web/public/assets/route-registry.mjs',import.meta.url),'utf8'),
    readFile(new URL('../apps/web/public/qelly-service-worker.js',import.meta.url),'utf8')
  ]);
  assert.match(handler,/path==='search'&&readMethod\(method\)/);
  assert.match(handler,/buildUniversalSearch/);
  assert.match(handler,/const assetIntent=/);
  assert.match(app,/case 'search': await renderUniversalSearch/);
  assert.match(registry,/route:'search'.*public:true/);
  assert.match(route,/data-search-private-content="excluded"/);
  assert.match(route,/Search finds\. Rankings orders\. Discovery frames\./);
  assert.match(route,/Private workspace contents excluded/);
  assert.doesNotMatch(route,/method:'POST'/);
  assert.match(worker,/universal-search-v2\.css/);
  assert.ok(searchInternals.formulaItems.every((item)=>item.truthState==='deterministic'));
});
