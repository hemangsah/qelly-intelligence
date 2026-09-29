import {buildDecisionIntelligence,fetchNewsContext} from './decision-proven-graph.js';
import {buildDecisionRangeEvidence} from '../../_lib/decision-range-evidence.js';
import {buildDecisionHistoricalNewsTimeline} from '../../_lib/decision-range-timeline.js';
import {buildDecisionRangeFlowParticipation} from '../../_lib/decision-range-flow.js';
import {buildDecisionNewsClusters} from '../../_lib/decision-news.js';
import {HttpError,enforceRateLimit,errorResponse,fetcher,responseJson} from '../../_lib/runtime.js';
import {createDecisionLatencyTrace} from '../../_lib/decision-latency.js';
import {coalesceDecisionWork,decisionWorkKey,edgeCacheRequest,historicalRangeSettled,rangeEvidenceCacheKey,readEdgeJsonCache,writeEdgeJsonCache,DECISION_PERFORMANCE_CACHE_SCHEMA} from '../../_lib/decision-performance-cache.js';

const ASSETS=new Set(['BTC','ETH','SOL','HYPE','XRP','DOGE']);
const INTERVALS=new Set(['1m','3m','5m','15m','30m','1h','2h','4h','1d']);
const MAX_RANGE_MS=90*86_400_000;
const FUTURE_TOLERANCE_MS=5*60_000;
const RANGE_EVIDENCE_SOURCE_VERSION='qelly.range-evidence.sources/2026-09-29.2';
const SETTLED_RANGE_EDGE_TTL_SECONDS=21_600;
const ip=(request)=>request.headers.get('cf-connecting-ip')||request.headers.get('x-forwarded-for')?.split(',')[0]||'anonymous';
const finiteTime=(value)=>{const number=Number(value);return Number.isFinite(number)&&number>0?number:null;};
const emptyNews=(state,window,reason=null,coverageState='COMPLETE')=>({articles:[],state,fetchedAt:null,cache:{hit:false,stale:false,coalesced:false,ageMs:null,bucketMs:0},fallbackReason:reason,window,coverageState,exactWindow:true});
const isoWindow=(start,end)=>({start:new Date(start).toISOString(),end:new Date(end).toISOString()});

async function fetchHistoricalNewsWindow(fetchImpl,asset,start,end,now,{coverageState='COMPLETE'}={}){
  if(!Number.isFinite(start)||!Number.isFinite(end)||!(start<end))return emptyNews('not-available',isoWindow(Math.max(0,start||0),Math.max(1,end||1)),'historical_window_not_available',coverageState);
  if(start>=now)return emptyNews('not-available',isoWindow(start,end),'historical_window_has_not_occurred_yet','NOT_OCCURRED_YET');
  const boundedEnd=Math.min(end,now);
  const window=isoWindow(start,boundedEnd);
  if(!(start<boundedEnd))return emptyNews('not-available',window,'historical_window_has_not_occurred_yet','NOT_OCCURRED_YET');
  try{
    const result=await fetchNewsContext(fetchImpl,asset,start,boundedEnd,{bucketMs:0,exactWindow:true});
    return {...result,window,coverageState:end>now?'PARTIAL_TO_NOW':coverageState,exactWindow:true};
  }catch(error){
    return emptyNews('unavailable',window,String(error?.message||'Historical news provider unavailable').slice(0,240),end>now?'PARTIAL_TO_NOW':coverageState);
  }
}

async function buildRangeEvidencePayload({env,asset,interval,horizon,start,end,timezone,now,latency}){
  const base=await latency.time('decisionBase',()=>buildDecisionIntelligence(env,{asset,interval,horizon,selection:{start,end},includeNews:false,now}));
  if(!base.selection)throw new HttpError(422,'unsupported_history','The connected candle history does not cover this exact selected range; QELLY will not substitute a nearby range.');
  const provisional=latency.measure('provisionalRange',()=>buildDecisionRangeEvidence({graph:base,evidence:{...base.evidence,news:{state:'not-requested',provider:'GDELT',articles:[]}},assetClass:'crypto',venue:'Hyperliquid',timezone}));
  const preStart=Date.parse(provisional.request?.preWindow?.start||''),preEnd=Date.parse(provisional.request?.preWindow?.end||'');
  const postStart=Date.parse(provisional.request?.postWindow?.start||''),postEnd=Date.parse(provisional.request?.postWindow?.end||'');
  const fetchImpl=fetcher(env);
  const [beforeNews,duringNews,afterNews]=await latency.time('rangeNews',()=>Promise.all([
    fetchHistoricalNewsWindow(fetchImpl,asset,preStart,preEnd,now),
    fetchHistoricalNewsWindow(fetchImpl,asset,start,Math.min(end,now),now),
    fetchHistoricalNewsWindow(fetchImpl,asset,postStart,postEnd,now,{coverageState:postEnd>now?'PARTIAL_TO_NOW':'COMPLETE'})
  ]));
  return latency.measure('rangeAssembly',()=>{
    const clustering=buildDecisionNewsClusters(duringNews.articles,{asset});
    const evidence={...base.evidence,news:{
      state:duringNews.state,provider:'GDELT',articles:duringNews.articles,clusters:clustering.clusters,clustering,
      observedAt:duringNews.fetchedAt??null,cache:duringNews.cache??null,fallbackReason:duringNews.fallbackReason??null,
      boundary:'Exact selected-range news context. Retrieval uses explicit historical start/end timestamps with recent-news fallback disabled; current news outside this window is not injected; recent-news fallback is disabled for exact historical ranges.'
    }};
    const flowParticipation=buildDecisionRangeFlowParticipation({graph:base,evidence});
    const rangeEvidenceBase=buildDecisionRangeEvidence({graph:base,evidence,assetClass:'crypto',venue:'Hyperliquid',timezone});
    const evidenceFamilies=(rangeEvidenceBase.evidenceFamilies||[]).map(item=>item.id==='flow-participation'?{...item,state:flowParticipation.state,source:flowParticipation.source,data:flowParticipation,limitations:[flowParticipation.boundary]}:item);
    const coverage=(rangeEvidenceBase.coverage||[]).map(item=>item.id==='flow-participation'?{...item,state:flowParticipation.state,available:flowParticipation.state==='PARTIAL'||flowParticipation.state==='AVAILABLE'}:item);
    const withFlow={...rangeEvidenceBase,evidenceFamilies,coverage,flowParticipation};
    const timeline=buildDecisionHistoricalNewsTimeline({asset,rangeEvidence:withFlow,newsBuckets:{before:beforeNews,during:duringNews,after:afterNews}});
    const rangeEvidence={...withFlow,timeline};
    return {
      schemaVersion:'qelly.decision-range-evidence-response/1.3.0',
      asset,assetClass:'crypto',interval,horizon,selectionId:rangeEvidence.request?.selectionId||null,
      rangeStart:new Date(start).toISOString(),rangeEnd:new Date(end).toISOString(),
      selectedMove:base.selection,rangeEvidence,timeline,flowParticipation,
      selectedRangeCrossAsset:base.evidence?.selectedCrossAssetAnalysis||base.selectedRangeCrossAsset||null,
      rangeReplay:base.rangeReplay||null,
      selectedRangeSimilarMoves:base.selectedRangeSimilarMoves||null,
      boundary:'Research-only historical evidence. This endpoint does not change current QELLY VIEW, setup eligibility, probability calibration or execution state. Timeline chronology is association-only and never proof of causation.'
    };
  });
}

export async function onRequest({request,env}){
  try{
    if(request.method!=='GET')throw new HttpError(405,'method_not_allowed','Use GET for selected-range evidence');
    await enforceRateLimit(env,'decision-range-evidence:'+ip(request),{limit:12,windowMs:60_000});
    const url=new URL(request.url),now=Date.now();
    const asset=String(url.searchParams.get('asset')||'BTC').toUpperCase();
    const interval=String(url.searchParams.get('interval')||'15m');
    const horizon=String(url.searchParams.get('horizon')||'4h');
    const timezone=String(url.searchParams.get('timezone')||'UTC').slice(0,80);
    const start=finiteTime(url.searchParams.get('rangeStart')??url.searchParams.get('start'));
    const end=finiteTime(url.searchParams.get('rangeEnd')??url.searchParams.get('end'));
    if(!ASSETS.has(asset))throw new HttpError(400,'unsupported_asset','Supported range-evidence assets: BTC, ETH, SOL, HYPE, XRP, DOGE');
    if(!INTERVALS.has(interval))throw new HttpError(400,'unsupported_interval','Unsupported selected-range interval');
    if(start===null||end===null||!(start<end))throw new HttpError(400,'invalid_range','rangeStart and rangeEnd must define a valid historical interval');
    if(end-start>MAX_RANGE_MS)throw new HttpError(400,'range_too_large','Selected range exceeds the 90-day research bound');
    if(end>now+FUTURE_TOLERANCE_MS)throw new HttpError(400,'future_range','Selected range cannot extend into the future');

    const latency=createDecisionLatencyTrace();
    const settledHistorical=historicalRangeSettled(start,end,now,FUTURE_TOLERANCE_MS);
    const cacheKey=rangeEvidenceCacheKey({asset,interval,horizon,start,end,timezone,sourceVersion:RANGE_EVIDENCE_SOURCE_VERSION});
    const cacheRequest=edgeCacheRequest(request,cacheKey);
    const edgeCache=globalThis.caches?.default;
    if(settledHistorical){
      const cached=await latency.time('edgeCacheRead',()=>readEdgeJsonCache(edgeCache,cacheRequest,cacheKey));
      if(cached?.payload){
        const payload={...cached.payload,performance:latency.snapshot({
          cache:{schemaVersion:DECISION_PERFORMANCE_CACHE_SCHEMA,state:'HIT',settledHistorical:true,sourceVersion:RANGE_EVIDENCE_SOURCE_VERSION,storedAt:cached.storedAt,ttlSeconds:SETTLED_RANGE_EDGE_TTL_SECONDS},
          coalescing:{coalesced:false,capacityBypass:false}
        })};
        return responseJson(request,env,payload,200,{cache:'public, max-age=300, s-maxage='+SETTLED_RANGE_EDGE_TTL_SECONDS});
      }
    }

    const workKey=decisionWorkKey('range-evidence-work',{asset,interval,horizon,start,end,timezone,sourceVersion:RANGE_EVIDENCE_SOURCE_VERSION});
    const work=await coalesceDecisionWork(workKey,()=>buildRangeEvidencePayload({env,asset,interval,horizon,start,end,timezone,now,latency}),{maxInflight:32});
    const core=work.value;
    if(settledHistorical)await latency.time('edgeCacheWrite',()=>writeEdgeJsonCache(edgeCache,cacheRequest,cacheKey,core,{ttlSeconds:SETTLED_RANGE_EDGE_TTL_SECONDS}));
    const payload={...core,performance:latency.snapshot({
      cache:{schemaVersion:DECISION_PERFORMANCE_CACHE_SCHEMA,state:'MISS',settledHistorical,sourceVersion:RANGE_EVIDENCE_SOURCE_VERSION,storedAt:null,ttlSeconds:settledHistorical?SETTLED_RANGE_EDGE_TTL_SECONDS:0},
      coalescing:{coalesced:work.coalesced,capacityBypass:work.capacityBypass,activeAtJoin:work.activeAtJoin}
    })};
    const cacheHeader=settledHistorical?'public, max-age=300, s-maxage='+SETTLED_RANGE_EDGE_TTL_SECONDS:'public, max-age=0, must-revalidate';
    return responseJson(request,env,payload,200,{cache:cacheHeader});
  }catch(error){return errorResponse(request,env,error);}
}

export const __decisionRangeEvidenceEndpointTest=Object.freeze({ASSETS,INTERVALS,MAX_RANGE_MS,FUTURE_TOLERANCE_MS,RANGE_EVIDENCE_SOURCE_VERSION,SETTLED_RANGE_EDGE_TTL_SECONDS,finiteTime,fetchHistoricalNewsWindow,buildRangeEvidencePayload});
