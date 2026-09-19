import {buildDecisionProvenGraph,DECISION_INTERVALS} from '../../_lib/decision-proven-graph.js';
import {HttpError,enforceRateLimit,errorResponse,fetcher,responseJson} from '../../_lib/runtime.js';

const ASSETS=new Set(['BTC','ETH','SOL','HYPE','XRP','DOGE']);
const HORIZONS=Object.freeze({'1h':3_600_000,'4h':14_400_000,'12h':43_200_000,'1d':86_400_000,'3d':259_200_000,'7d':604_800_000});
const NEWS_TERMS=Object.freeze({BTC:'Bitcoin OR BTC',ETH:'Ethereum OR Ether',SOL:'Solana',HYPE:'Hyperliquid',XRP:'XRP OR Ripple',DOGE:'Dogecoin OR DOGE'});
const ip=(request)=>request.headers.get('cf-connecting-ip')||request.headers.get('x-forwarded-for')?.split(',')[0]||'anonymous';
const gdeltTime=(time)=>new Date(time).toISOString().replace(/\D/g,'').slice(0,14);
const safeUrl=(value)=>{try{const url=new URL(value);return url.protocol==='https:'||url.protocol==='http:'?url.href:null;}catch{return null;}};

async function fetchNews(fetchImpl,asset,start,end){
  const boundedStart=Math.max(end-72*3_600_000,start);const query='('+NEWS_TERMS[asset]+') sourcelang:english';
  const url=new URL('https://api.gdeltproject.org/api/v2/doc/doc');url.searchParams.set('query',query);url.searchParams.set('mode','artlist');url.searchParams.set('format','json');url.searchParams.set('maxrecords','12');url.searchParams.set('sort','HybridRel');url.searchParams.set('startdatetime',gdeltTime(boundedStart));url.searchParams.set('enddatetime',gdeltTime(end));
  const response=await fetchImpl(url.href,{headers:{accept:'application/json','user-agent':'QELLY-Intelligence/decision-intelligence'},signal:AbortSignal.timeout(5_000)});
  if(!response.ok)throw new Error('News provider unavailable');const payload=await response.json();
  return (Array.isArray(payload?.articles)?payload.articles:[]).map(article=>({title:String(article?.title||'').trim().slice(0,240),source:String(article?.domain||'').trim().slice(0,100),publishedAt:String(article?.seendate||''),url:safeUrl(article?.url)})).filter(article=>article.title&&article.url).slice(0,8);
}

export async function onRequest({request,env}){
  try{
    if(request.method!=='GET')throw new HttpError(405,'method_not_allowed','Use GET for public Decision Intelligence');
    await enforceRateLimit(env,'decision-proven-graph:'+ip(request),{limit:30,windowMs:60_000});
    const url=new URL(request.url);const asset=String(url.searchParams.get('asset')||'BTC').toUpperCase();const interval=url.searchParams.get('interval')||'15m';const horizon=url.searchParams.get('horizon')||'4h';
    if(!ASSETS.has(asset))throw new HttpError(400,'unsupported_asset','Supported assets: BTC, ETH, SOL, HYPE, XRP, DOGE');
    if(!DECISION_INTERVALS[interval])throw new HttpError(400,'unsupported_interval','Unsupported candle interval');
    if(!HORIZONS[horizon])throw new HttpError(400,'unsupported_horizon','Supported horizons: 1h, 4h, 12h, 1d, 3d, 7d');
    const horizonBars=Math.ceil(HORIZONS[horizon]/DECISION_INTERVALS[interval]);if(horizonBars<2||horizonBars>168)throw new HttpError(400,'incompatible_horizon','Choose a horizon at least two bars long and no more than 168 bars');
    const endTime=Date.now();const startTime=endTime-DECISION_INTERVALS[interval]*500;
    const selectionStart=Number(url.searchParams.get('selectionStart'));const selectionEnd=Number(url.searchParams.get('selectionEnd'));let selection=null;
    if(url.searchParams.has('selectionStart')||url.searchParams.has('selectionEnd')){if(!Number.isFinite(selectionStart)||!Number.isFinite(selectionEnd)||selectionStart>=selectionEnd||selectionEnd-selectionStart>90*86_400_000)throw new HttpError(400,'invalid_selection','Select a valid chart range of 90 days or less');selection={start:selectionStart,end:selectionEnd};}
    const fetchImpl=fetcher(env);const candleResponse=await fetchImpl('https://api.hyperliquid.xyz/info',{method:'POST',headers:{'content-type':'application/json','user-agent':'QELLY-Intelligence/decision-intelligence'},body:JSON.stringify({type:'candleSnapshot',req:{coin:asset,interval,startTime,endTime}}),signal:AbortSignal.timeout(8_000)});
    if(!candleResponse.ok)throw new HttpError(503,'provider_unavailable','Live market data is unavailable',{retryable:true});
    let payload;try{payload=await candleResponse.json();}catch{throw new HttpError(503,'provider_invalid_response','Live market data returned an invalid response',{retryable:true});}
    let graph;try{graph=buildDecisionProvenGraph(payload,{asset,interval,horizonBars,now:endTime,selection});}catch(error){throw new HttpError(503,'insufficient_provider_data',error.message,{retryable:true});}
    const newsStart=selection?.start??endTime-24*3_600_000;const newsEnd=Math.min(selection?.end??endTime,endTime);let articles=[];let newsState='unavailable';
    try{articles=await fetchNews(fetchImpl,asset,newsStart,newsEnd);newsState=articles.length?'live':'no-matches';}catch{}
    return responseJson(request,env,{...graph,horizon,evidence:{news:{state:newsState,provider:'GDELT',articles},liquidations:{state:'unavailable',message:'Verified liquidation evidence is not available for this view, so it is not inferred.'}}},200,{cache:'public, max-age=10, stale-while-revalidate=30'});
  }catch(error){return errorResponse(request,env,error);}
}
