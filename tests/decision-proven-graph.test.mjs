import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {buildDecisionProvenGraph,normalizeCandles} from '../functions/_lib/decision-proven-graph.js';
import {onRequest} from '../functions/api/v1/decision-proven-graph.js';

const start=Date.now()-180*900_000;
const candles=Array.from({length:180},(_,index)=>{const close=100+index*.08+Math.sin(index/5)*2;return {t:start+index*900_000,o:String(close-.15),h:String(close+1),l:String(close-1),c:String(close),v:String(1000+index),n:20+index};});

test('normalization rejects malformed rows, sorts and deduplicates timestamps',()=>{
  const result=normalizeCandles([candles[2],{...candles[1],c:'NaN'},candles[0],candles[2],candles[1]]);
  assert.deepEqual(result.map(item=>item.time),[candles[0].t,candles[1].t,candles[2].t]);
  assert.ok(result.every(item=>Object.values(item).every(Number.isFinite)));
});

test('Decision Proven Graph is deterministic, finite and probability-safe',()=>{
  const options={asset:'BTC',interval:'15m',horizonBars:16,now:candles.at(-1).t+900_000};
  const first=buildDecisionProvenGraph(candles,options);const second=buildDecisionProvenGraph(candles,options);
  assert.deepEqual(first,second);assert.equal(first.truthState,'LIVE');assert.equal(first.execution,false);
  const probabilities=Object.values(first.forecast.probabilities);assert.ok(probabilities.every(value=>value>=0&&value<=1));assert.ok(Math.abs(probabilities.reduce((a,b)=>a+b,0)-1)<.0001);
  for(const point of first.forecast.fan)assert.ok(point.p05<=point.p25&&point.p25<=point.p50&&point.p50<=point.p75&&point.p75<=point.p95);
  assert.ok(Object.values(first.metrics).every(value=>value===null||Number.isFinite(value)));
  assert.match(first.confidence.calibration,/not yet measured/i);assert.equal(first.provenance.provider,'Hyperliquid');assert.equal(first.graph.textAlternative.length,first.graph.edges.length);
});

test('Decision Proven Graph fails closed on insufficient provider evidence',()=>{
  assert.throws(()=>buildDecisionProvenGraph(candles.slice(0,20),{interval:'15m'}),/At least 80/);
});

test('public endpoint validates controls and returns cacheable provider-derived evidence',async()=>{
  let providerBody=null;const now=candles.at(-1).t+900_000;
  const request=new Request('https://terminal.qellyintelligence.com/api/v1/decision-proven-graph?asset=BTC&interval=15m&horizon=4h');
  const response=await onRequest({request,env:{__fetch:async(_url,options)=>{providerBody=JSON.parse(options.body);return new Response(JSON.stringify(candles),{status:200,headers:{'content-type':'application/json'}});}}});
  assert.equal(response.status,200);assert.match(response.headers.get('cache-control'),/stale-while-revalidate/);assert.equal(providerBody.type,'candleSnapshot');assert.equal(providerBody.req.coin,'BTC');
  const body=await response.json();assert.equal(body.provenance.provider,'Hyperliquid');assert.equal(body.horizon,'4h');assert.ok(new Date(body.generatedAt).getTime()>0);
  const invalid=await onRequest({request:new Request('https://terminal.qellyintelligence.com/api/v1/decision-proven-graph?asset=INVALID'),env:{}});assert.equal(invalid.status,400);
});

test('public route and source-to-model boundary are registered',async()=>{
  const [registry,route,endpoint]=await Promise.all([readFile(new URL('../apps/web/public/assets/route-registry.mjs',import.meta.url),'utf8'),readFile(new URL('../apps/web/public/assets/routes/decision-proven-graph.mjs',import.meta.url),'utf8'),readFile(new URL('../functions/api/v1/decision-proven-graph.js',import.meta.url),'utf8')]);
  assert.match(registry,/route:'decision-provenance'.*public:true/);assert.match(route,/PAST · OBSERVED/);assert.match(route,/FUTURE · MODELLED/);assert.match(route,/considered-not-executed/);assert.match(endpoint,/candleSnapshot/);assert.doesNotMatch(endpoint,/TradingView/);
});

