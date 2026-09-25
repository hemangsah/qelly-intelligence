import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {
  DECISION_PROVIDER_RESILIENCE,
  resilientJsonRequest,
  providerFailureHealth,
  providerResiliencePublicSummary
} from '../functions/_lib/decision-provider-resilience.js';
import {__decisionNewsLatencyTest} from '../functions/api/v1/decision-proven-graph.js';
import {compactDecisionToolReceipt} from '../functions/_lib/qelly-chat-tools.js';

const read=(path)=>readFile(new URL('../'+path,import.meta.url),'utf8');

test('Wave AO provider policies are explicit and preserve existing news/ECB cache boundaries',()=>{
  const p=DECISION_PROVIDER_RESILIENCE;
  assert.deepEqual(Object.keys(p),[
    'hyperliquidCandles','hyperliquidLiquidity','hyperliquidDerivatives','hyperliquidFunding','gdeltNews','ecbMacro'
  ]);
  assert.equal(p.hyperliquidCandles.critical,true);
  assert.equal(p.hyperliquidCandles.timeoutMs,8000);
  assert.equal(p.hyperliquidCandles.maxAttempts,2);
  assert.deepEqual(p.hyperliquidCandles.retryHttpStatuses,[429,500,502,503,504]);
  assert.equal(p.hyperliquidLiquidity.eligibilityImpact,'gate_only_when_live');
  assert.equal(p.hyperliquidDerivatives.eligibilityImpact,'risk_context_only');
  assert.equal(p.gdeltNews.maxAttempts,1);
  assert.equal(p.gdeltNews.cacheFreshMs,5*60_000);
  assert.equal(p.gdeltNews.cacheStaleMs,30*60_000);
  assert.equal(p.ecbMacro.cacheFreshMs,60*60_000);
  assert.equal(p.ecbMacro.cacheStaleMs,48*60*60_000);
  assert.equal(__decisionNewsLatencyTest.NEWS_TIMEOUT_MS,p.gdeltNews.timeoutMs);
  assert.equal(__decisionNewsLatencyTest.NEWS_CACHE_FRESH_MS,p.gdeltNews.cacheFreshMs);
  assert.equal(__decisionNewsLatencyTest.NEWS_CACHE_STALE_MS,p.gdeltNews.cacheStaleMs);
});

test('Wave AO retries one fast transient HTTP failure and records the retry',async()=>{
  let calls=0,sleeps=0;
  const result=await resilientJsonRequest(async()=>{
    calls+=1;
    if(calls===1)return new Response('busy',{status:503});
    return new Response(JSON.stringify({ok:true}),{status:200,headers:{'content-type':'application/json'}});
  },'https://example.invalid/provider',{
    policyKey:'hyperliquidLiquidity',
    sleep:async(ms)=>{sleeps+=1;assert.equal(ms,100);}
  });
  assert.equal(calls,2);
  assert.equal(sleeps,1);
  assert.deepEqual(result.data,{ok:true});
  assert.equal(result.health.attempts,2);
  assert.equal(result.health.retried,true);
});

test('Wave AO does not retry non-transient HTTP failures',async()=>{
  let calls=0;
  await assert.rejects(
    resilientJsonRequest(async()=>{calls+=1;return new Response('bad',{status:400});},'https://example.invalid/provider',{
      policyKey:'hyperliquidCandles',sleep:async()=>{throw new Error('sleep should not run');}
    }),
    error=>error?.code==='provider_http_400'&&error?.details?.attempts===1
  );
  assert.equal(calls,1);
});

test('Wave AO does not double a timeout-bound tail with a retry',async()=>{
  let calls=0;
  const timeout=new Error('timeout');timeout.name='AbortError';
  await assert.rejects(
    resilientJsonRequest(async()=>{calls+=1;throw timeout;},'https://example.invalid/provider',{
      policyKey:'hyperliquidCandles',sleep:async()=>{throw new Error('sleep should not run');}
    }),
    error=>error?.code==='provider_timeout'&&error?.details?.attempts===1&&error?.retryable===false
  );
  assert.equal(calls,1);
});

test('Wave AO invalid JSON fails explicitly without retry or substitute data',async()=>{
  let calls=0;
  await assert.rejects(
    resilientJsonRequest(async()=>{calls+=1;return new Response('{',{status:200,headers:{'content-type':'application/json'}});},'https://example.invalid/provider',{
      policyKey:'hyperliquidDerivatives',sleep:async()=>{throw new Error('sleep should not run');}
    }),
    error=>error?.code==='provider_invalid_response'&&error?.details?.attempts===1
  );
  assert.equal(calls,1);
});

test('Wave AO optional provider failure health is explicit and does not claim freshness',()=>{
  const error=Object.assign(new Error('failed'),{code:'provider_http_503',details:{attempts:2}});
  const health=providerFailureHealth(error,'hyperliquidLiquidity');
  assert.equal(health.state,'unavailable');
  assert.equal(health.attempts,2);
  assert.equal(health.retried,true);
  assert.equal(health.critical,false);
});

test('Wave AO public resilience summary defines degradation and rejects unjustified per-isolate circuit breaking',()=>{
  const summary=providerResiliencePublicSummary({
    liquidity:{state:'unavailable',resilience:{state:'unavailable',reason:'provider_timeout'}},
    derivatives:{state:'live',resilience:{state:'live',attempts:1}},
    news:{state:'stale',cache:{hit:true,stale:true},fallbackReason:'news_provider_unavailable_using_stale_cache'},
    macro:{state:'available',provider:'ecb-reference-rates',freshness:'daily-working-day-reference',cache:{hit:true,stale:false}}
  });
  assert.equal(summary.schemaVersion,'qelly.decision-provider-resilience/1.0.0');
  assert.equal(summary.circuitBreaker.state,'not_enabled');
  assert.match(summary.circuitBreaker.reason,/shared persistent provider-health coordinator/i);
  assert.match(summary.boundary,/never substitutes unrelated evidence/i);
  assert.match(summary.boundary,/cannot be relabeled fresh/i);
  assert.equal(summary.observed.news.state,'stale');
});

test('Wave AO Decision integration preserves mandatory ordering and existing scientific gates',async()=>{
  const source=await read('functions/api/v1/decision-proven-graph.js');
  assert.match(source,/resilientJsonRequest\(fetchImpl,HYPERLIQUID_INFO_URL/);
  assert.match(source,/policyKey:'hyperliquidCandles'/);
  assert.match(source,/policyKey:'hyperliquidLiquidity'/);
  assert.match(source,/policyKey:'hyperliquidDerivatives'/);
  assert.match(source,/policyKey:'hyperliquidFunding'/);
  assert.match(source,/const NEWS_TIMEOUT_MS=2_500/);
  assert.match(source,/const payload=await fetchCandles\(fetchImpl,resolvedAsset,resolvedInterval,endTime\)/);
  assert.match(source,/const \[timeframeSupport,derivativesCurrent,liquidity,fundingRows,benchmarkPayload\]=await Promise\.all/);
  assert.match(source,/assembleTimeframes\(graph,timeframeSupport\)/);
  assert.match(source,/providerResiliencePublicSummary/);
  assert.doesNotMatch(source,/fallback.*Binance|fallback.*Coinbase|substitut.*provider/i);
});

test('Wave AO Decision Copilot receipt carries authoritative resilience metadata without a second engine',()=>{
  const providerResilience=providerResiliencePublicSummary({
    liquidity:{state:'live',resilience:{state:'live',attempts:1}},
    derivatives:{state:'live',resilience:{state:'live',attempts:1}},
    news:{state:'pending'},
    macro:{state:'available',provider:'ecb-reference-rates',freshness:'daily-working-day-reference'}
  });
  const result={
    asset:'BTC',interval:'15m',horizon:'4h',truthState:'LIVE',freshness:{state:'LIVE'},observedAt:'2026-09-25T07:00:00Z',
    market:{lastPrice:83870,currentState:{}},qellyView:{action:'WAIT',confidence:.6,evidenceGate:{}},
    confidence:{},quant:{calibration:{state:'WEAK_CALIBRATION',eligible:false}},tradeResearch:{status:'NO_TRADE',matrix:[],targets:[]},
    evidence:{news:{state:'pending'},liquidity:{state:'live'},derivatives:{state:'live'},crossAsset:{state:'available'},macro:{state:'available'},eventRisk:{state:'unavailable'}},
    multiTimeframe:{views:[],agreement:{}},historicalAnalogs:{},contradictionAnalysis:{},pastPresentFuture:{},providerResilience
  };
  const receipt=compactDecisionToolReceipt(result);
  assert.equal(receipt.data.providerResilience.schemaVersion,'qelly.decision-provider-resilience/1.0.0');
  assert.equal(receipt.data.providerResilience.circuitBreaker.state,'not_enabled');
  assert.match(receipt.limitations.join(' '),/does not create a second Decision engine/i);
});
