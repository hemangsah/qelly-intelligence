import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {__decisionNewsLatencyTest} from '../functions/api/v1/decision-proven-graph.js';

const read=(path)=>readFile(new URL(`../${path}`,import.meta.url),'utf8');
const {NEWS_TIMEOUT_MS,NEWS_CACHE_FRESH_MS,NEWS_CACHE_STALE_MS,NEWS_CACHE_BUCKET_MS,fetchNews,fetchNewsContext,normalizedNewsWindow}=__decisionNewsLatencyTest;
const article={title:'Bitcoin market update',domain:'example.com',seendate:'20260923T160000Z',url:'https://example.com/article'};

test('Decision news accepts a successful precise query without fallback',async()=>{
  const calls=[];
  const result=await fetchNews(async(url,options)=>{
    calls.push({url:String(url),options});
    return new Response(JSON.stringify({articles:[article]}),{status:200,headers:{'content-type':'application/json'}});
  },'BTC',Date.now()-3_600_000,Date.now());
  assert.equal(calls.length,1);
  assert.equal(result.length,1);
  assert.equal(result[0].source,'example.com');
  assert.ok(calls[0].options.signal instanceof AbortSignal);
});

test('Decision news broadens only after a successful empty precise query',async()=>{
  const calls=[];
  const result=await fetchNews(async(url)=>{
    calls.push(String(url));
    if(calls.length===1)return new Response(JSON.stringify({articles:[]}),{status:200,headers:{'content-type':'application/json'}});
    return new Response(JSON.stringify({articles:[article]}),{status:200,headers:{'content-type':'application/json'}});
  },'BTC',Date.now()-3_600_000,Date.now());
  assert.equal(calls.length,2);
  assert.doesNotMatch(calls[0],/timespan=3days/);
  assert.match(calls[1],/timespan=3days/);
  assert.equal(result.length,1);
});

test('Decision news does not spend a second provider timeout after a failed precise request',async()=>{
  let calls=0;
  await assert.rejects(
    fetchNews(async()=>{calls++;throw new Error('provider timeout');},'BTC',Date.now()-3_600_000,Date.now()),
    /provider timeout/
  );
  assert.equal(calls,1);
});

test('Decision news latency contract overlaps optional news with core analysis and preserves scanner no-news mode',async()=>{
  const [source,scan]=await Promise.all([
    read('functions/api/v1/decision-proven-graph.js'),
    read('functions/api/v1/decision-scan.js')
  ]);
  assert.equal(NEWS_TIMEOUT_MS,2500);
  assert.match(source,/const NEWS_TIMEOUT_MS=2_500/);
  const newsPromise=source.indexOf('const newsPromise=includeNews');
  const mandatory=source.indexOf('const payload=await fetchCandles(fetchImpl,resolvedAsset,resolvedInterval,endTime)');
  const settle=source.indexOf('const {articles,state:newsState}=await newsPromise');
  assert.ok(newsPromise>=0&&mandatory>newsPromise&&settle>mandatory);
  assert.match(source,/if\(!response\.ok\)throw new Error\('News provider unavailable'\)/);
  assert.doesNotMatch(source,/for\(const fallback of \[false,true\]\)/);
  assert.match(scan,/includeNews:false/);
});

test('Decision news remains contextual evidence only and never alters execution or eligibility',async()=>{
  const source=await read('functions/api/v1/decision-proven-graph.js');
  assert.match(source,/news:\{state:newsState,provider:includeNews\?'GDELT':null,articles\}/);
  assert.match(source,/Recent news is evidence only and is not converted into a scheduled event-risk score/);
  assert.doesNotMatch(source,/newsState.*action|articles.*directionalEligible|news.*calibrationEligible/);
});


const memoryCache=()=>{
  const values=new Map();
  return {
    async match(request){const value=values.get(request.url);return value?new Response(value):undefined;},
    async put(request,response){values.set(request.url,await response.text());}
  };
};

test('Wave AN reuses a bounded fresh contextual-news cache without changing provider semantics',async()=>{
  const cache=memoryCache(),now=Date.parse('2026-09-24T23:00:00.000Z');
  let calls=0;
  const fetchImpl=async()=>{calls+=1;return new Response(JSON.stringify({articles:[article]}),{status:200,headers:{'content-type':'application/json'}});};
  const first=await fetchNewsContext(fetchImpl,'BTC',now-3_600_000,now,{cache,now});
  const second=await fetchNewsContext(fetchImpl,'BTC',now-3_600_000,now,{cache,now:now+1_000});
  assert.equal(calls,1);
  assert.equal(first.state,'live');
  assert.equal(first.cache.hit,false);
  assert.equal(second.state,'cached');
  assert.equal(second.cache.sourceState,'live');
  assert.equal(second.cache.hit,true);
  assert.equal(second.cache.stale,false);
  assert.ok(second.cache.ageMs<=1_000);
  assert.equal(NEWS_CACHE_FRESH_MS,300_000);
  assert.equal(NEWS_CACHE_STALE_MS,1_800_000);
  assert.equal(NEWS_CACHE_BUCKET_MS,300_000);
});

test('Wave AN coalesces simultaneous same-window news work into one provider request',async()=>{
  const cache=memoryCache(),now=Date.parse('2026-09-24T23:00:00.000Z');
  let calls=0,release;
  const gate=new Promise(resolve=>{release=resolve;});
  const fetchImpl=async()=>{
    calls+=1;
    await gate;
    return new Response(JSON.stringify({articles:[article]}),{status:200,headers:{'content-type':'application/json'}});
  };
  const first=fetchNewsContext(fetchImpl,'BTC',now-3_600_000,now,{cache,now});
  const second=fetchNewsContext(fetchImpl,'BTC',now-3_600_000,now,{cache,now});
  await Promise.resolve();
  release();
  const [left,right]=await Promise.all([first,second]);
  assert.equal(calls,1);
  assert.equal(left.articles.length,1);
  assert.equal(right.articles.length,1);
  assert.equal([left.cache.coalesced,right.cache.coalesced].filter(Boolean).length,1);
});

test('Wave AN uses labeled stale news only as a provider-failure fallback',async()=>{
  const cache=memoryCache(),now=Date.parse('2026-09-24T23:00:00.000Z');
  await fetchNewsContext(async()=>new Response(JSON.stringify({articles:[article]}),{status:200,headers:{'content-type':'application/json'}}),'BTC',now-3_600_000,now,{cache,now});
  const staleNow=now+NEWS_CACHE_FRESH_MS+1;
  const result=await fetchNewsContext(async()=>{throw new Error('provider down');},'BTC',now-3_600_000,now,{cache,now:staleNow});
  assert.equal(result.state,'stale');
  assert.equal(result.cache.hit,true);
  assert.equal(result.cache.stale,true);
  assert.match(result.fallbackReason,/stale_cache/);
});

test('Wave AN preserves exact selected-range news windows while bucketing current context only',()=>{
  const now=Date.parse('2026-09-24T23:03:17.000Z');
  const start=now-3_600_123;
  const exact=normalizedNewsWindow(start,now,0);
  const bucketed=normalizedNewsWindow(start,now,NEWS_CACHE_BUCKET_MS);
  assert.deepEqual(exact,{start,end:now,bucketMs:0});
  assert.equal(bucketed.start%NEWS_CACHE_BUCKET_MS,0);
  assert.equal(bucketed.end%NEWS_CACHE_BUCKET_MS,0);
  assert.ok(bucketed.end>bucketed.start);
});

test('Wave AN cache remains contextual evidence only and cannot alter Decision eligibility',async()=>{
  const source=await read('functions/api/v1/decision-proven-graph.js');
  assert.match(source,/News is contextual evidence only/);
  assert.match(source,/state:'stale'/);
  assert.match(source,/news_provider_unavailable_using_stale_cache/);
  assert.doesNotMatch(source,/newsCache.*directionalEligible|newsObservedAt.*action|fallbackReason.*calibrationEligible/);
  assert.match(source,/const newsPromise=includeNews/);
  assert.match(source,/const payload=await fetchCandles\(fetchImpl,resolvedAsset,resolvedInterval,endTime\)/);
});
