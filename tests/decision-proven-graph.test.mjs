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
  assert.match(first.confidence.calibration,/not a success probability/i);assert.equal(first.provenance.provider,'Hyperliquid');assert.equal(first.graph.textAlternative.length,first.graph.edges.length);
  assert.match(first.qellyView.action,/BUY|SELL|WAIT|NO TRADE/);assert.ok(first.market.currentState.label);
  if(first.qellyView.levels)assert.equal(first.qellyView.levels.targets.length,3);
});

test('selected chart range produces ranked, finite before-and-after evidence',()=>{
  const selection={start:candles[100].t,end:candles[125].t};
  const graph=buildDecisionProvenGraph(candles,{asset:'BTC',interval:'15m',horizonBars:16,now:candles.at(-1).t+900_000,selection});
  assert.equal(graph.selection.candles,26);assert.equal(graph.selection.evidence.length,4);
  assert.deepEqual(graph.selection.evidence.map(item=>item.rank),[1,2,3,4]);assert.ok(Number.isFinite(graph.selection.changePct));assert.ok(graph.selection.technicalComparison);assert.ok(Number.isFinite(graph.selection.technicalComparison.rsi14.change));
});

test('stale evidence fails closed to NO TRADE without synthetic levels',()=>{
  const graph=buildDecisionProvenGraph(candles,{interval:'15m',now:candles.at(-1).t+30*900_000});
  assert.equal(graph.truthState,'DEGRADED');assert.equal(graph.qellyView.action,'NO TRADE');assert.equal(graph.qellyView.levels,null);
});

test('Decision Proven Graph fails closed on insufficient provider evidence',()=>{
  assert.throws(()=>buildDecisionProvenGraph(candles.slice(0,20),{interval:'15m'}),/At least 80/);
});

test('public endpoint validates controls and returns cacheable provider-derived evidence',async()=>{
  const providerBodies=[];const now=candles.at(-1).t+900_000;
  const request=new Request('https://terminal.qellyintelligence.com/api/v1/decision-proven-graph?asset=BTC&interval=15m&horizon=4h');
  const response=await onRequest({request,env:{__fetch:async(url,options={})=>{
    if(String(url).includes('api.hyperliquid.xyz')){
      const body=JSON.parse(options.body);providerBodies.push(body);
      if(body.type==='metaAndAssetCtxs')return new Response(JSON.stringify([{universe:[{name:'BTC'}]},[{funding:'0.000125',openInterest:'1000',markPx:'80000',oraclePx:'79900',dayNtlVlm:'120000000',premium:'0.0002'}]]),{status:200,headers:{'content-type':'application/json'}});
      return new Response(JSON.stringify(candles),{status:200,headers:{'content-type':'application/json'}});
    }
    return new Response(JSON.stringify({articles:[]}),{status:200,headers:{'content-type':'application/json'}});
  }}});
  assert.equal(response.status,200);assert.match(response.headers.get('cache-control'),/stale-while-revalidate/);
  assert.ok(providerBodies.some(body=>body.type==='candleSnapshot'&&body.req.coin==='BTC'));
  assert.ok(providerBodies.some(body=>body.type==='metaAndAssetCtxs'));
  const body=await response.json();assert.equal(body.provenance.provider,'Hyperliquid');assert.equal(body.horizon,'4h');assert.ok(new Date(body.generatedAt).getTime()>0);assert.equal(body.multiTimeframe.state,'live');assert.ok(body.multiTimeframe.views.length>=4);
  assert.equal(body.evidence.derivatives.state,'live');assert.equal(body.evidence.derivatives.provider,'Hyperliquid');assert.equal(body.evidence.derivatives.currentOnly,true);assert.equal(body.evidence.derivatives.fundingPct,.0125);assert.equal(body.evidence.derivatives.openInterest,1000);assert.equal(body.evidence.derivatives.openInterestNotionalUsd,80_000_000);assert.equal(body.evidence.derivatives.markOracleBasisPct,.125156);
  assert.equal(body.evidence.liquidations.state,'unavailable');
  const invalid=await onRequest({request:new Request('https://terminal.qellyintelligence.com/api/v1/decision-proven-graph?asset=INVALID'),env:{}});assert.equal(invalid.status,400);
});

test('public route and source-to-model boundary are registered',async()=>{
  const [registry,route,endpoint]=await Promise.all([readFile(new URL('../apps/web/public/assets/route-registry.mjs',import.meta.url),'utf8'),readFile(new URL('../apps/web/public/assets/routes/decision-proven-graph.mjs',import.meta.url),'utf8'),readFile(new URL('../functions/api/v1/decision-proven-graph.js',import.meta.url),'utf8')]);
  assert.match(registry,/route:'decision-provenance'.*public:true/);assert.match(route,/Explain this move/);assert.match(route,/QELLY VIEW/);assert.match(route,/PAST/);assert.match(route,/FUTURE/);assert.match(route,/MULTI-TIMEFRAME/);assert.match(route,/DERIVATIVES CONTEXT/);assert.match(route,/Current funding/);assert.match(route,/Open interest/);assert.match(route,/Liquidations: unavailable, not inferred/);assert.match(route,/Methodology and sources/);assert.doesNotMatch(route,/<details class="q-dpg-audit" open/);assert.doesNotMatch(route,/Entitlement|Fingerprint|Endpoint/);assert.match(endpoint,/candleSnapshot/);assert.match(endpoint,/metaAndAssetCtxs/);assert.match(endpoint,/currentOnly:true/);assert.match(endpoint,/api\.gdeltproject\.org/);assert.doesNotMatch(endpoint,/TradingView/);
});



test('derivatives provider failure does not fabricate values or take Decision Intelligence offline',async()=>{
  const request=new Request('https://terminal.qellyintelligence.com/api/v1/decision-proven-graph?asset=BTC&interval=15m&horizon=4h');
  const response=await onRequest({request,env:{__fetch:async(url,options={})=>{
    if(String(url).includes('api.hyperliquid.xyz')){
      const body=JSON.parse(options.body);
      if(body.type==='metaAndAssetCtxs')return new Response(JSON.stringify({error:'down'}),{status:503,headers:{'content-type':'application/json'}});
      return new Response(JSON.stringify(candles),{status:200,headers:{'content-type':'application/json'}});
    }
    return new Response(JSON.stringify({articles:[]}),{status:200,headers:{'content-type':'application/json'}});
  }}});
  assert.equal(response.status,200);
  const body=await response.json();
  assert.equal(body.evidence.derivatives.state,'unavailable');
  assert.equal(body.evidence.derivatives.currentOnly,true);
  assert.match(body.evidence.derivatives.message,/not inferred/i);
  assert.equal(body.evidence.derivatives.fundingRate,undefined);
  assert.equal(body.evidence.liquidations.state,'unavailable');
});
