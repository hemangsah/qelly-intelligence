import {fetchNewsContext} from './decision-proven-graph.js';
import {HttpError,enforceRateLimit,errorResponse,fetcher,responseJson} from '../../_lib/runtime.js';
import {buildDecisionNewsClusters} from '../../_lib/decision-news.js';

const ASSETS=new Set(['BTC','ETH','SOL','HYPE','XRP','DOGE']);
const MAX_WINDOW_MS=30*86_400_000;
const FUTURE_TOLERANCE_MS=5*60_000;
const ip=(request)=>request.headers.get('cf-connecting-ip')||request.headers.get('x-forwarded-for')?.split(',')[0]||'anonymous';
const finiteTime=(value)=>{const number=Number(value);return Number.isFinite(number)&&number>0?number:null;};

export async function onRequest({request,env}){
  try{
    if(request.method!=='GET')throw new HttpError(405,'method_not_allowed','Use GET for Decision news context');
    await enforceRateLimit(env,'decision-news-context:'+ip(request),{limit:30,windowMs:60_000});
    const url=new URL(request.url);
    const asset=String(url.searchParams.get('asset')||'BTC').toUpperCase();
    if(!ASSETS.has(asset))throw new HttpError(400,'unsupported_asset','Supported assets: BTC, ETH, SOL, HYPE, XRP, DOGE');
    const now=Date.now();
    const end=finiteTime(url.searchParams.get('end'))??now;
    const start=finiteTime(url.searchParams.get('start'))??end-72*3_600_000;
    if(!(start<end))throw new HttpError(400,'invalid_news_window','News context start must precede end');
    if(end>now+FUTURE_TOLERANCE_MS)throw new HttpError(400,'future_news_window','News context cannot request a future window');
    if(end-start>MAX_WINDOW_MS)throw new HttpError(400,'news_window_too_large','News context window exceeds the bounded research limit');
    const exact=url.searchParams.get('exact')==='1';
    let result;
    try{
      result=await fetchNewsContext(fetcher(env),asset,start,end,{bucketMs:exact?0:undefined});
    }catch(error){
      result={
        articles:[],
        state:'unavailable',
        fetchedAt:null,
        cache:{hit:false,stale:false,coalesced:false,ageMs:null,bucketMs:exact?0:300000},
        fallbackReason:String(error?.message||'News provider unavailable').slice(0,240)
      };
    }
    const clustering=buildDecisionNewsClusters(result.articles,{asset});
    return responseJson(request,env,{
      schemaVersion:'qelly.decision-news-context/1.1.0',
      asset,start,end,provider:'GDELT',
      ...result,
      clusters:clustering.clusters,
      clustering,
      eligibilityImpact:'none',
      boundary:'Post-Decision contextual enrichment only. Headline clusters are deterministic lexical audit metadata. This response cannot change QELLY VIEW, entry, invalidation, targets, R:R feasibility, calibration, or NO TRADE eligibility for the Decision snapshot that requested it.'
    },200,{cache:'public, max-age=60, stale-while-revalidate=300'});
  }catch(error){return errorResponse(request,env,error);}
}

export const __decisionNewsContextTest=Object.freeze({ASSETS,MAX_WINDOW_MS,FUTURE_TOLERANCE_MS,finiteTime});
