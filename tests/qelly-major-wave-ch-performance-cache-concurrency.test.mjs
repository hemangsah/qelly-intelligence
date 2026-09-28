import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {
  coalesceDecisionWork,decisionWorkKey,edgeCacheRequest,historicalRangeSettled,rangeEvidenceCacheKey,readEdgeJsonCache,writeEdgeJsonCache,
  DECISION_PERFORMANCE_CACHE_SCHEMA
} from '../functions/_lib/decision-performance-cache.js';

test('Wave CH coalesces identical in-flight work without changing the result',async()=>{
  let calls=0,release;
  const gate=new Promise(resolve=>{release=resolve;});
  const worker=async()=>{calls+=1;await gate;return {ok:true};};
  const key=decisionWorkKey('scan',{asset:'BTC',interval:'15m'});
  const first=coalesceDecisionWork(key,worker);
  const second=coalesceDecisionWork(key,worker);
  await Promise.resolve();
  assert.equal(calls,1);
  release();
  const [a,b]=await Promise.all([first,second]);
  assert.deepEqual(a.value,{ok:true});
  assert.deepEqual(b.value,{ok:true});
  assert.equal([a.coalesced,b.coalesced].filter(Boolean).length,1);
});

test('Wave CH only treats a range as settled after its full post-window has elapsed',()=>{
  const now=1_000_000_000,start=now-300_000,end=now-200_000;
  assert.equal(historicalRangeSettled(start,end,now,0),true);
  assert.equal(historicalRangeSettled(now-120_000,now-40_000,now,0),false);
  assert.equal(historicalRangeSettled(end,start,now,0),false);
});

test('Wave CH range cache key includes source version and bounded request identity',()=>{
  const a=rangeEvidenceCacheKey({asset:'btc',interval:'15m',horizon:'4h',start:1,end:2,timezone:'UTC',sourceVersion:'s1'});
  const b=rangeEvidenceCacheKey({asset:'btc',interval:'15m',horizon:'4h',start:1,end:2,timezone:'UTC',sourceVersion:'s2'});
  assert.notEqual(a,b);
  assert.match(a,/BTC/);
  assert.match(a,/sourceVersion=s1/);
});

test('Wave CH edge JSON cache validates both schema and full key',async()=>{
  const store=new Map();
  const cache={
    async match(request){return store.get(request.url)?.clone()||null;},
    async put(request,response){store.set(request.url,response.clone());}
  };
  const sourceRequest=new Request('https://terminal.qellyintelligence.com/api/v1/decision-range-evidence');
  const key='range|one',request=edgeCacheRequest(sourceRequest,key);
  assert.equal(await readEdgeJsonCache(cache,request,key),null);
  assert.equal(await writeEdgeJsonCache(cache,request,key,{value:7},{ttlSeconds:600}),true);
  const hit=await readEdgeJsonCache(cache,request,key);
  assert.deepEqual(hit.payload,{value:7});
  assert.equal(await readEdgeJsonCache(cache,request,key+'-collision'),null);
  const stored=await (await cache.match(request)).json();
  assert.equal(stored.schemaVersion,DECISION_PERFORMANCE_CACHE_SCHEMA);
});

test('Wave CH current Decision and scanner caches cannot serve stale-while-revalidate as live',async()=>{
  const [decision,scan]=await Promise.all([
    readFile(new URL('../functions/api/v1/decision-proven-graph.js',import.meta.url),'utf8'),
    readFile(new URL('../functions/api/v1/decision-scan.js',import.meta.url),'utf8')
  ]);
  assert.match(decision,/max-age=2, must-revalidate/);
  assert.match(scan,/max-age=2, must-revalidate/);
  assert.doesNotMatch(decision,/max-age=10, stale-while-revalidate=30/);
  assert.doesNotMatch(scan,/max-age=10, stale-while-revalidate=20/);
  assert.match(decision,/requestCoalescing/);
  assert.match(scan,/requestCoalescing/);
});

test('Wave CH exposes next-move compute latency independently',async()=>{
  const decision=await readFile(new URL('../functions/api/v1/decision-proven-graph.js',import.meta.url),'utf8');
  assert.match(decision,/latency\.measure\('nextMoveCompute'/);
});

test('Wave CH range evidence uses settled edge cache, in-flight coalescing and latency decomposition',async()=>{
  const range=await readFile(new URL('../functions/api/v1/decision-range-evidence.js',import.meta.url),'utf8');
  for(const token of ['RANGE_EVIDENCE_SOURCE_VERSION','historicalRangeSettled','readEdgeJsonCache','writeEdgeJsonCache','coalesceDecisionWork',"'decisionBase'","'rangeNews'","'rangeAssembly'"])assert.ok(range.includes(token),token);
  assert.match(range,/max-age=0, must-revalidate/);
});

test('Wave CH browser aborts superseded range and Decision network work and batches reloads',async()=>{
  const route=await readFile(new URL('../apps/web/public/assets/routes/decision-proven-graph.mjs',import.meta.url),'utf8');
  assert.match(route,/rangeEvidenceController=new AbortController\(\)/);
  assert.match(route,/decisionLoadController=new AbortController\(\)/);
  assert.match(route,/signal:controller\.signal/);
  assert.match(route,/clearTimeout\(scheduledLoadTimer\)/);
  assert.match(route,/setTimeout\(\(\)=>\{scheduledLoadTimer=0;void load\(\);\},16\)/);
  assert.match(route,/error\?\.name==='AbortError'/);
});


test('Wave CH abort telemetry only emits when a range request was actually active',async()=>{
  const route=await readFile(new URL('../apps/web/public/assets/routes/decision-proven-graph.mjs',import.meta.url),'utf8');
  assert.match(route,/const hadActiveRequest=Boolean\(rangeEvidenceController\)/);
  assert.match(route,/if\(hadActiveRequest\)emitRuntimeSignal/);
  assert.match(route,/if\(scheduledLoadTimer\)\{clearTimeout\(scheduledLoadTimer\);scheduledLoadTimer=0;\}/);
});
