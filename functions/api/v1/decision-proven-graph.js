import {buildDecisionProvenGraph,DECISION_INTERVALS} from '../../_lib/decision-proven-graph.js';
import {HttpError,enforceRateLimit,errorResponse,fetcher,responseJson} from '../../_lib/runtime.js';

const ASSETS=new Set(['BTC','ETH','SOL','HYPE','XRP','DOGE']);
const HORIZONS=Object.freeze({'1h':3_600_000,'4h':14_400_000,'12h':43_200_000,'1d':86_400_000,'3d':259_200_000,'7d':604_800_000});
const ip=(request)=>request.headers.get('cf-connecting-ip')||request.headers.get('x-forwarded-for')?.split(',')[0]||'anonymous';

export async function onRequest({request,env}){
  try{
    if(request.method!=='GET')throw new HttpError(405,'method_not_allowed','Use GET for the public Decision Proven Graph');
    await enforceRateLimit(env,`decision-proven-graph:${ip(request)}`,{limit:30,windowMs:60_000});
    const url=new URL(request.url);const asset=String(url.searchParams.get('asset')||'BTC').toUpperCase();const interval=url.searchParams.get('interval')||'15m';const horizon=url.searchParams.get('horizon')||'4h';
    if(!ASSETS.has(asset))throw new HttpError(400,'unsupported_asset','Supported assets: BTC, ETH, SOL, HYPE, XRP, DOGE');
    if(!DECISION_INTERVALS[interval])throw new HttpError(400,'unsupported_interval','Unsupported candle interval');
    if(!HORIZONS[horizon])throw new HttpError(400,'unsupported_horizon','Supported horizons: 1h, 4h, 12h, 1d, 3d, 7d');
    const horizonBars=Math.ceil(HORIZONS[horizon]/DECISION_INTERVALS[interval]);if(horizonBars<2||horizonBars>168)throw new HttpError(400,'incompatible_horizon','Choose a horizon at least two bars long and no more than 168 bars');
    const endTime=Date.now();const startTime=endTime-DECISION_INTERVALS[interval]*500;
    const response=await fetcher(env)('https://api.hyperliquid.xyz/info',{method:'POST',headers:{'content-type':'application/json','user-agent':'QELLY-Intelligence/decision-proven-graph'},body:JSON.stringify({type:'candleSnapshot',req:{coin:asset,interval,startTime,endTime}}),signal:AbortSignal.timeout(8_000)});
    if(!response.ok)throw new HttpError(503,'provider_unavailable','Hyperliquid candle service is unavailable',{retryable:true});
    let payload;try{payload=await response.json();}catch{throw new HttpError(503,'provider_invalid_response','Provider returned invalid data',{retryable:true});}
    let graph;try{graph=buildDecisionProvenGraph(payload,{asset,interval,horizonBars,now:endTime});}catch(error){throw new HttpError(503,'insufficient_provider_data',error.message,{retryable:true});}
    return responseJson(request,env,{...graph,horizon},200,{cache:'public, max-age=10, stale-while-revalidate=30'});
  }catch(error){return errorResponse(request,env,error);}
}

