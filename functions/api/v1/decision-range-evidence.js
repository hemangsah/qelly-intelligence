import {buildDecisionIntelligence,fetchNewsContext} from './decision-proven-graph.js';
import {buildDecisionRangeEvidence} from '../../_lib/decision-range-evidence.js';
import {buildDecisionNewsClusters} from '../../_lib/decision-news.js';
import {HttpError,enforceRateLimit,errorResponse,fetcher,responseJson} from '../../_lib/runtime.js';

const ASSETS=new Set(['BTC','ETH','SOL','HYPE','XRP','DOGE']);
const INTERVALS=new Set(['1m','5m','15m','30m','1h','4h','1d']);
const MAX_RANGE_MS=90*86_400_000;
const FUTURE_TOLERANCE_MS=5*60_000;
const ip=(request)=>request.headers.get('cf-connecting-ip')||request.headers.get('x-forwarded-for')?.split(',')[0]||'anonymous';
const finiteTime=(value)=>{const number=Number(value);return Number.isFinite(number)&&number>0?number:null;};

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
    let news;
    try{
      news=await fetchNewsContext(fetcher(env),asset,start,end,{bucketMs:0});
    }catch(error){
      news={articles:[],state:'unavailable',fetchedAt:null,cache:{hit:false,stale:false,coalesced:false,ageMs:null,bucketMs:0},fallbackReason:String(error?.message||'Range news provider unavailable').slice(0,240)};
    }
    const clustering=buildDecisionNewsClusters(news.articles,{asset});
    const evidence={...base.evidence,news:{
      state:news.state,provider:'GDELT',articles:news.articles,clusters:clustering.clusters,clustering,
      observedAt:news.fetchedAt??null,cache:news.cache??null,fallbackReason:news.fallbackReason??null,
      boundary:'Exact selected-range news context. Retrieval is time-bounded to rangeStart/rangeEnd; current news outside this window is not injected.'
    }};
    const rangeEvidence=buildDecisionRangeEvidence({graph:base,evidence,assetClass:'crypto',venue:'Hyperliquid',timezone:url.searchParams.get('timezone')||'UTC'});
    return responseJson(request,env,{
      schemaVersion:'qelly.decision-range-evidence-response/1.0.0',
      asset,assetClass:'crypto',interval,horizon,selectionId:rangeEvidence.request?.selectionId||null,
      rangeStart:new Date(start).toISOString(),rangeEnd:new Date(end).toISOString(),
      selectedMove:base.selection,rangeEvidence,
      boundary:'Research-only historical evidence. This endpoint does not change current QELLY VIEW, setup eligibility, probability calibration or execution state.'
    },200,{cache:'public, max-age=30, stale-while-revalidate=60'});
  }catch(error){return errorResponse(request,env,error);}
}

export const __decisionRangeEvidenceEndpointTest=Object.freeze({ASSETS,INTERVALS,MAX_RANGE_MS,FUTURE_TOLERANCE_MS,finiteTime});
