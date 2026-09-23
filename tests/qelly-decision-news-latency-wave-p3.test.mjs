import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {__decisionNewsLatencyTest} from '../functions/api/v1/decision-proven-graph.js';

const read=(path)=>readFile(new URL(`../${path}`,import.meta.url),'utf8');
const {NEWS_TIMEOUT_MS,fetchNews}=__decisionNewsLatencyTest;
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
