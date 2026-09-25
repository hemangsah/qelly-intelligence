import {HttpError} from './runtime.js';

const policy=(value)=>Object.freeze({
  ...value,
  retryHttpStatuses:Object.freeze([...(value.retryHttpStatuses||[])])
});

export const DECISION_PROVIDER_RESILIENCE=Object.freeze({
  hyperliquidCandles:policy({
    provider:'Hyperliquid',capability:'candles',critical:true,timeoutMs:8_000,maxAttempts:2,
    retryHttpStatuses:[429,500,502,503,504],backoffMs:125,freshnessRule:'interval-relative',
    degradedState:'UNAVAILABLE',fallback:'none',eligibilityImpact:'critical_market_input'
  }),
  hyperliquidLiquidity:policy({
    provider:'Hyperliquid',capability:'l2-book',critical:false,timeoutMs:5_000,maxAttempts:2,
    retryHttpStatuses:[429,500,502,503,504],backoffMs:100,freshnessRule:'point-in-time',
    degradedState:'UNAVAILABLE',fallback:'none',eligibilityImpact:'gate_only_when_live'
  }),
  hyperliquidDerivatives:policy({
    provider:'Hyperliquid',capability:'perpetual-context',critical:false,timeoutMs:8_000,maxAttempts:2,
    retryHttpStatuses:[429,500,502,503,504],backoffMs:125,freshnessRule:'point-in-time',
    degradedState:'UNAVAILABLE',fallback:'none',eligibilityImpact:'risk_context_only'
  }),
  hyperliquidFunding:policy({
    provider:'Hyperliquid',capability:'funding-history',critical:false,timeoutMs:6_000,maxAttempts:2,
    retryHttpStatuses:[429,500,502,503,504],backoffMs:100,freshnessRule:'bounded_72h_history',
    degradedState:'UNAVAILABLE',fallback:'none',eligibilityImpact:'risk_context_only'
  }),
  gdeltNews:policy({
    provider:'GDELT',capability:'news-context',critical:false,timeoutMs:2_500,maxAttempts:1,
    retryHttpStatuses:[],backoffMs:0,freshnessRule:'5m-fresh-30m-stale',
    cacheFreshMs:5*60_000,cacheStaleMs:30*60_000,
    degradedState:'UNAVAILABLE',fallback:'stale_context_only',eligibilityImpact:'none'
  }),
  ecbMacro:policy({
    provider:'ECB',capability:'fx-reference-rates',critical:false,timeoutMs:6_000,maxAttempts:1,
    retryHttpStatuses:[],backoffMs:0,freshnessRule:'daily-working-day-reference',
    cacheFreshMs:60*60_000,cacheStaleMs:48*60*60_000,
    degradedState:'STALE_OR_UNAVAILABLE',fallback:'stale_delayed_reference',eligibilityImpact:'context_only'
  })
});

const wait=(ms)=>new Promise(resolve=>setTimeout(resolve,ms));
const safeError=(error)=>String(error?.message||'Provider request failed').slice(0,240);

export const providerResiliencePolicy=(key)=>{
  const value=DECISION_PROVIDER_RESILIENCE[key];
  if(!value)throw new HttpError(500,'provider_policy_missing','Decision provider resilience policy is missing');
  return value;
};

export async function resilientJsonRequest(fetchImpl,url,{policyKey,init={},sleep=wait}={}){
  const policy=providerResiliencePolicy(policyKey);
  if(typeof fetchImpl!=='function')throw new HttpError(503,'provider_fetch_unavailable','Provider fetch runtime is unavailable');
  let attempt=0;
  while(attempt<policy.maxAttempts){
    attempt+=1;
    let response;
    try{
      response=await fetchImpl(url,{...init,signal:AbortSignal.timeout(policy.timeoutMs)});
    }catch(error){
      if(error?.name==='AbortError'||error?.name==='TimeoutError'){
        throw new HttpError(503,'provider_timeout',policy.provider+' '+policy.capability+' timed out',{
          details:{provider:policy.provider,capability:policy.capability,policyKey,attempts:attempt,timeoutMs:policy.timeoutMs,failure:'timeout'},
          retryable:false
        });
      }
      throw new HttpError(503,'provider_request_failed',safeError(error),{
        details:{provider:policy.provider,capability:policy.capability,policyKey,attempts:attempt,timeoutMs:policy.timeoutMs,failure:'network'},
        retryable:false
      });
    }
    if(!response.ok){
      const retryable=policy.retryHttpStatuses.includes(Number(response.status));
      if(retryable&&attempt<policy.maxAttempts){
        await sleep(policy.backoffMs*attempt);
        continue;
      }
      throw new HttpError(503,'provider_http_'+response.status,policy.provider+' '+policy.capability+' request failed ('+response.status+')',{
        details:{provider:policy.provider,capability:policy.capability,policyKey,attempts:attempt,timeoutMs:policy.timeoutMs,httpStatus:response.status,failure:'http'},
        retryable:false
      });
    }
    let data;
    try{data=await response.json();}
    catch{
      throw new HttpError(503,'provider_invalid_response',policy.provider+' '+policy.capability+' returned invalid JSON',{
        details:{provider:policy.provider,capability:policy.capability,policyKey,attempts:attempt,timeoutMs:policy.timeoutMs,failure:'invalid_json'},
        retryable:false
      });
    }
    return {
      data,
      health:{
        state:'live',provider:policy.provider,capability:policy.capability,policyKey,
        attempts:attempt,retried:attempt>1,timeoutMs:policy.timeoutMs,critical:policy.critical
      }
    };
  }
  throw new HttpError(503,'provider_request_failed','Provider request failed');
}

export const providerFailureHealth=(error,policyKey)=>{
  const policy=providerResiliencePolicy(policyKey);
  const details=error?.details||{};
  return {
    state:'unavailable',provider:policy.provider,capability:policy.capability,policyKey,
    attempts:Number(details.attempts)||1,retried:Number(details.attempts)>1,timeoutMs:policy.timeoutMs,
    critical:policy.critical,reason:String(error?.code||details.failure||'provider_request_failed').slice(0,120)
  };
};

const publicPolicy=(value)=>({
  provider:value.provider,capability:value.capability,critical:value.critical,timeoutMs:value.timeoutMs,maxAttempts:value.maxAttempts,
  retryHttpStatuses:[...value.retryHttpStatuses],backoffMs:value.backoffMs,freshnessRule:value.freshnessRule,
  degradedState:value.degradedState,fallback:value.fallback,eligibilityImpact:value.eligibilityImpact,
  ...(Number.isFinite(value.cacheFreshMs)?{cacheFreshMs:value.cacheFreshMs}:{}),
  ...(Number.isFinite(value.cacheStaleMs)?{cacheStaleMs:value.cacheStaleMs}:{})
});

export const providerResiliencePublicSummary=({liquidity=null,derivatives=null,news=null,macro=null}={})=>({
  schemaVersion:'qelly.decision-provider-resilience/1.0.0',
  policies:Object.fromEntries(Object.entries(DECISION_PROVIDER_RESILIENCE).map(([key,value])=>[key,publicPolicy(value)])),
  observed:{
    liquidity:{state:String(liquidity?.state||'unavailable'),health:liquidity?.resilience||null},
    derivatives:{state:String(derivatives?.state||'unavailable'),health:derivatives?.resilience||null},
    news:{state:String(news?.state||'unavailable'),cache:news?.cache||null,fallbackReason:news?.fallbackReason||null},
    macro:{state:String(macro?.state||'unavailable'),provider:macro?.provider||null,freshness:macro?.freshness||null,cache:macro?.cache||null,fallbackReason:macro?.fallbackReason||null}
  },
  circuitBreaker:{
    state:'not_enabled',
    reason:'No shared persistent provider-health coordinator is connected. A per-isolate breaker could produce inconsistent availability, so QELLY uses bounded timeouts, explicit retries and fail-closed/degraded states instead.'
  },
  boundary:'Provider resilience never substitutes unrelated evidence. Critical market-data failure fails closed; optional provider failure is labeled unavailable/stale according to its explicit policy and cannot be relabeled fresh.'
});

export const __decisionProviderResilienceTest=Object.freeze({publicPolicy});
