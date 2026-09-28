const DEFAULT_MAX_INFLIGHT=64;
const activeWork=new Map();
const finite=(value)=>Number.isFinite(Number(value))?Number(value):null;
const clean=(value)=>String(value??'').replace(/[\r\n|]/g,'_').slice(0,240);

export const DECISION_PERFORMANCE_CACHE_SCHEMA='qelly.decision-performance-cache/1.0.0';

export const decisionWorkKey=(namespace,fields={},version='v1')=>{
  const pairs=Object.keys(fields).sort().map((key)=>key+'='+clean(fields[key]));
  return clean(namespace)+'|'+clean(version)+'|'+pairs.join('&');
};

export const stableKeyHash=(value)=>{
  let hash=2166136261;
  for(const char of String(value||'')){hash^=char.charCodeAt(0);hash=Math.imul(hash,16777619);}
  return (hash>>>0).toString(16).padStart(8,'0');
};

export async function coalesceDecisionWork(key,task,{maxInflight=DEFAULT_MAX_INFLIGHT}={}){
  const normalized=String(key||'');
  const existing=activeWork.get(normalized);
  if(existing)return {value:await existing,coalesced:true,capacityBypass:false,activeAtJoin:activeWork.size};
  if(activeWork.size>=Math.max(1,Number(maxInflight)||DEFAULT_MAX_INFLIGHT)){
    return {value:await task(),coalesced:false,capacityBypass:true,activeAtJoin:activeWork.size};
  }
  const promise=Promise.resolve().then(task);
  activeWork.set(normalized,promise);
  try{return {value:await promise,coalesced:false,capacityBypass:false,activeAtJoin:activeWork.size};}
  finally{if(activeWork.get(normalized)===promise)activeWork.delete(normalized);}
}

export const historicalRangeSettled=(start,end,now=Date.now(),toleranceMs=5*60_000)=>{
  const a=finite(start),b=finite(end),clock=finite(now),tolerance=Math.max(0,finite(toleranceMs)??0);
  if(a===null||b===null||clock===null||!(a<b))return false;
  const duration=b-a,postWindowEnd=b+duration;
  return postWindowEnd<=clock-tolerance;
};

export const rangeEvidenceCacheKey=({asset,interval,horizon,start,end,timezone='UTC',sourceVersion='v1'}={})=>decisionWorkKey('range-evidence',{
  asset:String(asset||'').toUpperCase(),interval,horizon,start,end,timezone,sourceVersion
},'settled-v1');

export const edgeCacheRequest=(request,key)=>{
  const url=new URL(request.url);
  url.pathname='/__qelly_internal_cache/decision-range-evidence/'+stableKeyHash(key);
  url.search='';
  return new Request(url.toString(),{method:'GET'});
};

export async function readEdgeJsonCache(cache,request,key){
  if(!cache?.match)return null;
  const response=await cache.match(request);
  if(!response)return null;
  const record=await response.json().catch(()=>null);
  if(!record||record.schemaVersion!==DECISION_PERFORMANCE_CACHE_SCHEMA||record.key!==key)return null;
  return {payload:record.payload,storedAt:record.storedAt||null};
}

export async function writeEdgeJsonCache(cache,request,key,payload,{ttlSeconds=21_600}={}){
  if(!cache?.put)return false;
  const ttl=Math.max(60,Math.floor(Number(ttlSeconds)||21_600));
  const record={schemaVersion:DECISION_PERFORMANCE_CACHE_SCHEMA,key,storedAt:new Date().toISOString(),payload};
  const response=new Response(JSON.stringify(record),{headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'public, max-age='+ttl}});
  await cache.put(request,response);
  return true;
}

export const decisionPerformanceCacheSnapshot=()=>({
  schemaVersion:DECISION_PERFORMANCE_CACHE_SCHEMA,
  activeInflight:activeWork.size,
  maxInflight:DEFAULT_MAX_INFLIGHT,
  boundary:'In-flight work is process-local and bounded. Edge caching is used only for fully settled historical range evidence; current Decision/scan results are never served with stale-while-revalidate.'
});

export const __decisionPerformanceCacheTest=Object.freeze({DEFAULT_MAX_INFLIGHT,clean,activeWork});
