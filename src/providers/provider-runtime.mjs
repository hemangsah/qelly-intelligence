import crypto from 'node:crypto';
import { FixtureMarketAdapter } from './adapters/fixture-market-adapter.mjs';
import { TokenBucketLimiter } from '../security/rate-limiter.mjs';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const withTimeout = async (promise, ms) => {
  let timer;
  try { return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Object.assign(new Error('Provider deadline exceeded'),{code:'provider_timeout',retryable:true})),ms);})]); }
  finally { clearTimeout(timer); }
};

export class ProviderRuntime {
  constructor({ entitlementEngine, qualityEngine, auditLedger, now = () => Date.now() }) {
    this.entitlementEngine=entitlementEngine; this.qualityEngine=qualityEngine; this.auditLedger=auditLedger; this.now=now;
    this.providers=new Map(); this.cache=new Map(); this.inflight=new Map(); this.breakers=new Map(); this.bulkheads=new Map();
    this.limiter=new TokenBucketLimiter({capacity:120,refillPerSecond:2});
    this.register(new FixtureMarketAdapter({providerId:'qelly-fixture-primary',role:'primary',latencyMs:3,valueOffset:0}),{displayName:'Qelly Fixture Primary',selectionRole:'primary',credentialReference:null,maintenance:null,status:'enabled'});
    this.register(new FixtureMarketAdapter({providerId:'qelly-fixture-secondary',role:'secondary',latencyMs:6,valueOffset:0.001}),{displayName:'Qelly Fixture Secondary',selectionRole:'secondary',credentialReference:null,maintenance:null,status:'enabled'});
    this.register(new FixtureMarketAdapter({providerId:'qelly-fixture-validation',role:'validation',latencyMs:8,valueOffset:-0.001}),{displayName:'Qelly Fixture Validation',selectionRole:'validation',credentialReference:null,maintenance:null,status:'enabled'});
    for(const id of ['coingecko','coinbase-public','kraken-public','openfigi','licensed-equities']) this.providers.set(id,{providerId:id,displayName:id,status:'disabled',selectionRole:'planned',adapter:null,credentialReference:id==='licensed-equities'?'secretref://providers/licensed-equities/api-key':null,maintenance:null,deprecation:null,metrics:{requests:0,successes:0,failures:0,timeouts:0,cacheHits:0,costUnits:0,latencySamples:[]}});
  }

  register(adapter, config={}) {
    this.providers.set(adapter.providerId,{providerId:adapter.providerId,displayName:config.displayName??adapter.providerId,status:config.status??'enabled',selectionRole:config.selectionRole??'secondary',adapter,credentialReference:config.credentialReference??null,maintenance:config.maintenance??null,deprecation:config.deprecation??null,metrics:{requests:0,successes:0,failures:0,timeouts:0,cacheHits:0,costUnits:0,latencySamples:[]}});
  }

  registry() {
    return [...this.providers.values()].map((entry)=>({providerId:entry.providerId,displayName:entry.displayName,status:entry.status,selectionRole:entry.selectionRole,capabilities:entry.adapter?.capabilities()??[],credentialReference:entry.credentialReference,secretMaterialExposed:false,maintenance:entry.maintenance,deprecation:entry.deprecation,breaker:this.breakers.get(entry.providerId)??{state:'closed',failures:0},bulkhead:{active:this.bulkheads.get(entry.providerId)??0,limit:4},quality:this.#score(entry),metrics:{...entry.metrics,latencySamples:undefined}}));
  }

  #score(entry) {
    const samples=entry.metrics.latencySamples; const latency=samples.length?samples.reduce((a,b)=>a+b,0)/samples.length:0;
    const errorRate=entry.metrics.requests?entry.metrics.failures/entry.metrics.requests:0;
    const score=entry.status==='enabled'?Math.max(0,Math.min(100,100-errorRate*60-Math.min(latency/20,20))):0;
    return {score:Number(score.toFixed(1)),latencyMs:Number(latency.toFixed(1)),errorRate:Number(errorRate.toFixed(3)),freshnessClass:entry.status==='enabled'?'simulated':'unavailable'};
  }

  async execute({ capability, request, context, providerId=null, cacheTtlMs=30000, staleMs=120000 }) {
    const candidates=providerId?[this.providers.get(providerId)]:[...this.providers.values()].filter((entry)=>entry.status==='enabled'&&entry.adapter?.capabilities().includes(capability)).sort((a,b)=>['primary','secondary','validation'].indexOf(a.selectionRole)-['primary','secondary','validation'].indexOf(b.selectionRole));
    if(!candidates[0]) throw Object.assign(new Error('No enabled provider supports this capability'),{status:503,code:'provider_unavailable'});
    let lastError;
    for(const entry of candidates){
      try { return await this.#executeEntry(entry,{capability,request,context,cacheTtlMs,staleMs}); }
      catch(error){ lastError=error; }
    }
    throw lastError;
  }

  async #executeEntry(entry,{capability,request,context,cacheTtlMs,staleMs}) {
    const entitlement=this.entitlementEngine.evaluate({tenantId:context.tenantId,workspaceId:context.workspaceId,providerId:entry.providerId,capability,use:context.use??'display',entitlementClass:'development-fixture',territory:context.territory??'IN',userClass:'internal-user'});
    if(!entitlement.allowed) throw Object.assign(new Error(`Entitlement denied: ${entitlement.reasons.join(', ')}`),{status:403,code:'entitlement_denied',details:entitlement});
    const key=crypto.createHash('sha256').update(JSON.stringify({providerId:entry.providerId,capability,request,tenantId:context.tenantId,workspaceId:context.workspaceId,scenario:context.scenario??null,use:context.use??'display'})).digest('hex');
    const cached=this.cache.get(key); const now=this.now();
    if(cached&&cached.expiresAt>now){entry.metrics.cacheHits++;return {...structuredClone(cached.value),runtime:{...cached.value.runtime,cache:'hit'}};}
    if(this.inflight.has(key)) return this.inflight.get(key);
    const task=this.#perform(entry,{capability,request,context,entitlement}).then((value)=>{this.cache.set(key,{value,expiresAt:now+cacheTtlMs,staleUntil:now+staleMs});return value;}).catch((error)=>{
      if(cached&&cached.staleUntil>now) return {...structuredClone(cached.value),data:{...cached.value.data,freshnessClass:'stale',qualityFlags:[...(cached.value.data.qualityFlags??[]),'last-known-good-fallback']},runtime:{...cached.value.runtime,cache:'stale-last-known-good',fallbackReason:error.code??'provider-failure'}};
      throw error;
    }).finally(()=>this.inflight.delete(key));
    this.inflight.set(key,task); return task;
  }

  async #perform(entry,{capability,request,context,entitlement}) {
    const breaker=this.breakers.get(entry.providerId)??{state:'closed',failures:0,openedAt:0}; const now=this.now();
    if(breaker.state==='open'&&now-breaker.openedAt<30000) throw Object.assign(new Error('Provider circuit is open'),{status:503,code:'circuit_open',retryable:true});
    if(breaker.state==='open') breaker.state='half-open';
    const rate=this.limiter.consume(`${context.tenantId}:${entry.providerId}`,1,now); if(!rate.allowed) throw Object.assign(new Error('Provider quota exceeded'),{status:429,code:'provider_rate_limited',details:rate});
    const active=this.bulkheads.get(entry.providerId)??0; if(active>=4) throw Object.assign(new Error('Provider bulkhead is saturated'),{status:503,code:'provider_bulkhead_saturated',retryable:true});
    this.bulkheads.set(entry.providerId,active+1); entry.metrics.requests++;
    const started=this.now(); let lastError;
    try{
      for(let attempt=1;attempt<=2;attempt+=1){
        try{
          const data=await withTimeout(entry.adapter[capability](request,{...context,deadlineMs:context.deadlineMs??250,scenario:context.scenario??null}),context.deadlineMs??250);
          const latency=this.now()-started; entry.metrics.successes++; entry.metrics.costUnits+=Number(data?.costUnits??data?.metadata?.costUnits??1); entry.metrics.latencySamples.push(latency); if(entry.metrics.latencySamples.length>50)entry.metrics.latencySamples.shift();
          this.breakers.set(entry.providerId,{state:'closed',failures:0,openedAt:0});
          const quality=capability==='quote'?this.qualityEngine.validateQuote(data):{valid:true,flags:[],confidence:0.95};
          if(!quality.valid) this.qualityEngine.recordIncident({severity:'medium',providerId:entry.providerId,canonicalId:data.canonicalEntityId,flags:quality.flags,details:{capability}});
          return {data,entitlement,runtime:{providerId:entry.providerId,selectionRole:entry.selectionRole,attempt,latencyMs:latency,cache:'miss',quality,correlationId:context.correlationId,costUnits:Number(data?.costUnits??data?.metadata?.costUnits??1)}};
        }catch(error){ lastError=error; if(error.code==='provider_timeout')entry.metrics.timeouts++; if(!error.retryable||attempt===2)break; await sleep(10+attempt*7); }
      }
      entry.metrics.failures++; const failures=(breaker.failures??0)+1; this.breakers.set(entry.providerId,{state:failures>=3?'open':'closed',failures,openedAt:failures>=3?this.now():0});
      throw Object.assign(lastError??new Error('Provider request failed'),{status:lastError?.status??503,code:lastError?.code??'provider_failure'});
    }finally{this.bulkheads.set(entry.providerId,Math.max(0,(this.bulkheads.get(entry.providerId)??1)-1));}
  }
}
