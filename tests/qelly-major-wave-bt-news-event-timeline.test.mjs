import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {buildDecisionHistoricalNewsTimeline,__decisionRangeTimelineTest} from '../functions/_lib/decision-range-timeline.js';
import {decisionNewsArticleMetadata} from '../functions/_lib/decision-news.js';
import {fetchNewsContext,__decisionNewsLatencyTest} from '../functions/api/v1/decision-proven-graph.js';

const read=(path)=>readFile(new URL('../'+path,import.meta.url),'utf8');
const start=1_800_000_000_000,end=start+3_600_000,duration=end-start;
const rangeEvidence={request:{rangeStart:new Date(start).toISOString(),rangeEnd:new Date(end).toISOString(),preWindow:{start:new Date(start-duration).toISOString(),end:new Date(start).toISOString()},postWindow:{start:new Date(end).toISOString(),end:new Date(end+duration).toISOString()}}};
const article=(title,time,source='example.com',url='https://example.com/a')=>({title,source,publishedAt:new Date(time).toISOString(),url});
const bucket=(windowStart,windowEnd,articles)=>({state:'live',coverageState:'COMPLETE',exactWindow:true,window:{start:new Date(windowStart).toISOString(),end:new Date(windowEnd).toISOString()},articles});

test('Wave BT exact historical news URL uses the full requested window and never a recent-timespan fallback',()=>{
  const exact=new URL(__decisionNewsLatencyTest.newsUrl('BTC',start,end,{exactWindow:true}));
  assert.equal(exact.searchParams.get('startdatetime'),new Date(start).toISOString().replace(/\D/g,'').slice(0,14));
  assert.equal(exact.searchParams.get('enddatetime'),new Date(end).toISOString().replace(/\D/g,'').slice(0,14));
  assert.equal(exact.searchParams.get('timespan'),null);
  const recentFallback=new URL(__decisionNewsLatencyTest.newsUrl('BTC',start,end,{fallback:true}));
  assert.equal(recentFallback.searchParams.get('timespan'),'3days');
});

test('Wave BT exact-window no-match path makes one provider request and does not fall back to current news',async()=>{
  let calls=0;
  const fetchImpl=async()=>{calls++;return new Response(JSON.stringify({articles:[]}),{status:200,headers:{'content-type':'application/json'}});};
  const result=await fetchNewsContext(fetchImpl,'BTC',start,end,{cache:null,bucketMs:0,exactWindow:true,now:end+1});
  assert.equal(calls,1);
  assert.equal(result.state,'no-matches');
  assert.deepEqual(result.articles,[]);
});

test('Wave BT buckets source-backed articles strictly by timestamp and rejects contamination',()=>{
  const timeline=buildDecisionHistoricalNewsTimeline({asset:'BTC',rangeEvidence,newsBuckets:{
    before:bucket(start-duration,start,[article('Bitcoin policy update',start-1_000,'before.example','https://before.example/a')]),
    during:bucket(start,end,[article('Bitcoin ETF inflow update',start+10_000,'during.example','https://during.example/a'),article('Bitcoin old unrelated timestamp',start-duration-10_000,'bad.example','https://bad.example/a')]),
    after:bucket(end,end+duration,[article('Bitcoin market update',end+10_000,'after.example','https://after.example/a')])
  }});
  assert.equal(timeline.state,'AVAILABLE');
  assert.equal(timeline.buckets.BEFORE.length,1);
  assert.equal(timeline.buckets.DURING.length,1);
  assert.equal(timeline.buckets.AFTER.length,1);
  assert.equal(timeline.filteredOutOfWindow,1);
  assert.equal(timeline.items.length,3);
  assert.ok(timeline.items.every(item=>item.associationConfidence?.meaning.includes('not confidence that it caused')));
  assert.match(timeline.boundary,/timing does not prove causation/i);
});

test('Wave BT directness, directional relevance and association confidence remain descriptive metadata',()=>{
  const meta=decisionNewsArticleMetadata({title:'Bitcoin ETF inflow rises after approval'},{asset:'BTC'});
  assert.equal(meta.directAssetMention,true);
  assert.equal(meta.directionalRelevance,'UPSIDE_CONTEXT');
  assert.match(meta.boundary,/not sentiment, market-impact proof, causality/i);
  const confidence=__decisionRangeTimelineTest.associationConfidence({bucket:'DURING',direct:true,sourceCount:2,topics:['ETF_INSTITUTIONAL']});
  assert.equal(confidence.label,'HIGH');
  assert.match(confidence.meaning,/not confidence that it caused/i);
});

test('Wave BT range endpoint fetches BEFORE DURING AFTER with exactWindow and exposes timeline',async()=>{
  const endpoint=await read('functions/api/v1/decision-range-evidence.js');
  assert.match(endpoint,/Promise\.all\(\[/);
  assert.ok((endpoint.match(/fetchHistoricalNewsWindow\(/g)||[]).length>=4);
  assert.match(endpoint,/exactWindow:true/);
  assert.match(endpoint,/current news outside this window is not injected/);
  assert.match(endpoint,/buildDecisionHistoricalNewsTimeline/);
  assert.match(endpoint,/timeline/);
});

test('Wave BT Decision UI loads the exact range endpoint and renders a responsive source-linked timeline',async()=>{
  const [route,css,e2e]=await Promise.all([
    read('apps/web/public/assets/routes/decision-proven-graph.mjs'),
    read('apps/web/public/assets/qelly-decision-proven-graph.css'),
    read('scripts/qelly-decision-range-selection-e2e.mjs')
  ]);
  for(const phrase of ['WHAT CAUSED THIS MOVE? · HISTORICAL NEWS / EVENT TIMELINE','Chronology first, causality unclaimed','BEFORE','DURING','AFTER'])assert.ok(route.includes(phrase),phrase);
  assert.match(route,/\/api\/v1\/decision-range-evidence\?/);
  assert.match(route,/q-dpg-range-timeline/);
  assert.match(route,/escapeHtml\(item\.event\)/);
  assert.match(route,/rel="noopener"/);
  assert.match(css,/\.q-dpg-range-timeline__buckets/);
  assert.match(css,/@media\(max-width:820px\).*q-dpg-range-timeline__buckets/s);
  assert.match(e2e,/data-dpg-range-timeline/);
  assert.match(e2e,/injectedImageCount/);
});

test('Wave BT compact GDELT timestamps remain parseable for historical bucketing',()=>{
  assert.equal(__decisionRangeTimelineTest.compactTime('20260925T070000Z'),Date.parse('2026-09-25T07:00:00Z'));
});
