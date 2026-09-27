import {buildDecisionIntelligence,fetchNewsContext} from './decision-proven-graph.js';
import {buildDecisionRangeEvidence} from '../../_lib/decision-range-evidence.js';
import {buildDecisionHistoricalNewsTimeline} from '../../_lib/decision-range-timeline.js';
import {buildDecisionRangeFlowParticipation} from '../../_lib/decision-range-flow.js';
import {buildDecisionNewsClusters} from '../../_lib/decision-news.js';
import {HttpError,enforceRateLimit,errorResponse,fetcher,responseJson} from '../../_lib/runtime.js';

const ASSETS=new Set(['BTC','ETH','SOL','HYPE','XRP','DOGE']);
const INTERVALS=new Set(['1m','5m','15m','30m','1h','4h','1d']);
const MAX_RANGE_MS=90*86_400_000;
const FUTURE_TOLERANCE_MS=5*60_000;
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

export async function onRequest({request,env}){
  try{
    if(request.method!=='GET')throw new HttpError(405,'method_not_allowed','Use GET for selected-range evidence');
    await enforceRateLimit(env,'decision-range-evidence:'+ip(request),{limit:12,windowMs:60_000});
    const url=new URL(request.url),now=Date.now();
    const asset=String(url.searchParams.get('asset')||'BTC').toUpperCase();
    const interval=String(url.searchParams.get('interval')||'15m');
    const horizon=String(url.searchParams.get('horizon')||'4h');
    const start=finiteTime(url.searchParams.get('rangeStart')??url.searchParams.get('start'));
    const end=finiteTime(url.searchParams.get('rangeEnd')??url.searchParams.get('end'));
    if(!ASSETS.has(asset))throw new HttpError(400,'unsupported_asset','Supported range-evidence assets: BTC, ETH, SOL, HYPE, XRP, DOGE');
    if(!INTERVALS.has(interval))throw new HttpError(400,'unsupported_interval','Unsupported selected-range interval');
    if(start===null||end===null||!(start<end))throw new HttpError(400,'invalid_range','rangeStart and rangeEnd must define a valid historical interval');
    if(end-start>MAX_RANGE_MS)throw new HttpError(400,'range_too_large','Selected range exceeds the 90-day research bound');
    if(end>now+FUTURE_TOLERANCE_MS)throw new HttpError(400,'future_range','Selected range cannot extend into the future');

    const base=await buildDecisionIntelligence(env,{asset,interval,horizon,selection:{start,end},includeNews:false,now});
    if(!base.selection)throw new HttpError(422,'unsupported_history','The connected candle history does not cover this exact selected range; QELLY will not substitute a nearby range.');
    const provisional=buildDecisionRangeEvidence({graph:base,evidence:{...base.evidence,news:{state:'not-requested',provider:'GDELT',articles:[]}},assetClass:'crypto',venue:'Hyperliquid',timezone:url.searchParams.get('timezone')||'UTC'});
    const preStart=Date.parse(provisional.request?.preWindow?.start||''),preEnd=Date.parse(provisional.request?.preWindow?.end||'');
    const postStart=Date.parse(provisional.request?.postWindow?.start||''),postEnd=Date.parse(provisional.request?.postWindow?.end||'');
    const fetchImpl=fetcher(env);
    const [beforeNews,duringNews,afterNews]=await Promise.all([
      fetchHistoricalNewsWindow(fetchImpl,asset,preStart,preEnd,now),
      fetchHistoricalNewsWindow(fetchImpl,asset,start,Math.min(end,now),now),
      fetchHistoricalNewsWindow(fetchImpl,asset,postStart,postEnd,now,{coverageState:postEnd>now?'PARTIAL_TO_NOW':'COMPLETE'})
    ]);
    const clustering=buildDecisionNewsClusters(duringNews.articles,{asset});
    const evidence={...base.evidence,news:{
      state:duringNews.state,provider:'GDELT',articles:duringNews.articles,clusters:clustering.clusters,clustering,
      observedAt:duringNews.fetchedAt??null,cache:duringNews.cache??null,fallbackReason:duringNews.fallbackReason??null,
      boundary:'Exact selected-range news context. Retrieval uses explicit historical start/end timestamps with recent-news fallback disabled; current news outside this window is not injected; recent-news fallback is disabled for exact historical ranges.'
    }};
    const flowParticipation=buildDecisionRangeFlowParticipation({graph:base,evidence});
    const rangeEvidenceBase=buildDecisionRangeEvidence({graph:base,evidence,assetClass:'crypto',venue:'Hyperliquid',timezone:url.searchParams.get('timezone')||'UTC'});
    const evidenceFamilies=(rangeEvidenceBase.evidenceFamilies||[]).map(item=>item.id==='flow-participation'?{...item,state:flowParticipation.state,source:flowParticipation.source,data:flowParticipation,limitations:[flowParticipation.boundary]}:item);
    const coverage=(rangeEvidenceBase.coverage||[]).map(item=>item.id==='flow-participation'?{...item,state:flowParticipation.state,available:flowParticipation.state==='PARTIAL'||flowParticipation.state==='AVAILABLE'}:item);
    const withFlow={...rangeEvidenceBase,evidenceFamilies,coverage,flowParticipation};
    const timeline=buildDecisionHistoricalNewsTimeline({asset,rangeEvidence:withFlow,newsBuckets:{before:beforeNews,during:duringNews,after:afterNews}});
    const rangeEvidence={...withFlow,timeline};
    return responseJson(request,env,{
      schemaVersion:'qelly.decision-range-evidence-response/1.2.0',
      asset,assetClass:'crypto',interval,horizon,selectionId:rangeEvidence.request?.selectionId||null,
      rangeStart:new Date(start).toISOString(),rangeEnd:new Date(end).toISOString(),
      selectedMove:base.selection,rangeEvidence,timeline,flowParticipation,
      boundary:'Research-only historical evidence. This endpoint does not change current QELLY VIEW, setup eligibility, probability calibration or execution state. Timeline chronology is association-only and never proof of causation.'
    },200,{cache:'public, max-age=30, stale-while-revalidate=60'});
  }catch(error){return errorResponse(request,env,error);}
}

export const __decisionRangeEvidenceEndpointTest=Object.freeze({ASSETS,INTERVALS,MAX_RANGE_MS,FUTURE_TOLERANCE_MS,finiteTime,fetchHistoricalNewsWindow});
