import {buildDecisionProvenGraph,DECISION_INTERVALS} from '../../_lib/decision-proven-graph.js';
import {HttpError,enforceRateLimit,errorResponse,fetcher,responseJson} from '../../_lib/runtime.js';

const ASSETS=new Set(['BTC','ETH','SOL','HYPE','XRP','DOGE']);
const HORIZONS=Object.freeze({'1h':3_600_000,'4h':14_400_000,'12h':43_200_000,'1d':86_400_000,'3d':259_200_000,'7d':604_800_000});
const TIMEFRAMES=Object.freeze(['15m','1h','4h','1d']);
const NEWS_TERMS=Object.freeze({BTC:'Bitcoin OR BTC',ETH:'Ethereum OR Ether',SOL:'Solana',HYPE:'Hyperliquid',XRP:'XRP OR Ripple',DOGE:'Dogecoin OR DOGE'});
const ip=(request)=>request.headers.get('cf-connecting-ip')||request.headers.get('x-forwarded-for')?.split(',')[0]||'anonymous';
const gdeltTime=(time)=>new Date(time).toISOString().replace(/\D/g,'').slice(0,14);
const safeUrl=(value)=>{try{const url=new URL(value);return url.protocol==='https:'||url.protocol==='http:'?url.href:null;}catch{return null;}};

async function fetchCandles(fetchImpl,asset,interval,endTime,points=500){
  const response=await fetchImpl('https://api.hyperliquid.xyz/info',{method:'POST',headers:{'content-type':'application/json','user-agent':'QELLY-Intelligence/decision-intelligence'},body:JSON.stringify({type:'candleSnapshot',req:{coin:asset,interval,startTime:endTime-DECISION_INTERVALS[interval]*points,endTime}}),signal:AbortSignal.timeout(8_000)});
  if(!response.ok)throw new HttpError(503,'provider_unavailable','Live market data is unavailable',{retryable:true});
  try{return await response.json();}catch{throw new HttpError(503,'provider_invalid_response','Live market data returned an invalid response',{retryable:true});}
}

const newsUrl=(asset,start,end,{fallback=false}={})=>{const url=new URL('https://api.gdeltproject.org/api/v2/doc/doc');url.searchParams.set('query','('+NEWS_TERMS[asset]+') sourcelang:english');url.searchParams.set('mode','artlist');url.searchParams.set('format','json');url.searchParams.set('maxrecords','12');url.searchParams.set('sort','HybridRel');if(fallback)url.searchParams.set('timespan','3days');else{url.searchParams.set('startdatetime',gdeltTime(Math.max(end-72*3_600_000,start)));url.searchParams.set('enddatetime',gdeltTime(end));}return url.href;};
const normalizeArticles=(payload)=>(Array.isArray(payload?.articles)?payload.articles:[]).map(article=>({title:String(article?.title||'').trim().slice(0,240),source:String(article?.domain||'').trim().slice(0,100),publishedAt:String(article?.seendate||''),url:safeUrl(article?.url)})).filter(article=>article.title&&article.url).slice(0,8);
async function fetchNews(fetchImpl,asset,start,end){
  for(const fallback of [false,true]){try{const response=await fetchImpl(newsUrl(asset,start,end,{fallback}),{headers:{accept:'application/json','user-agent':'QELLY-Intelligence/decision-intelligence'},signal:AbortSignal.timeout(4_000)});if(!response.ok)continue;const articles=normalizeArticles(await response.json());if(articles.length||fallback)return articles;}catch{}}
  throw new Error('News provider unavailable');
}

const timeframeSummary=(graph)=>({interval:graph.interval,truthState:graph.truthState,marketState:graph.market.currentState,metrics:{rsi14:graph.metrics.rsi14,atrPct:graph.metrics.atrPct,trendPerBarPct:graph.metrics.trendPerBarPct},probabilities:graph.forecast.probabilities,qellyView:{action:graph.qellyView.action,confidence:graph.qellyView.confidence,label:graph.qellyView.label}});
async function fetchTimeframes(fetchImpl,asset,endTime,selectedInterval){
  const intervals=[...new Set([selectedInterval,...TIMEFRAMES])];
  const settled=await Promise.allSettled(intervals.map(async interval=>timeframeSummary(buildDecisionProvenGraph(await fetchCandles(fetchImpl,asset,interval,endTime,240),{asset,interval,horizonBars:16,now:endTime}))));
  const views=settled.filter(item=>item.status==='fulfilled').map(item=>item.value);const directional=views.filter(item=>item.qellyView.action==='BUY'||item.qellyView.action==='SELL');const buys=directional.filter(item=>item.qellyView.action==='BUY').length,sells=directional.length-buys;
  return {state:views.length>=3?'live':views.length?'partial':'unavailable',views,agreement:{direction:buys>sells?'BUY':sells>buys?'SELL':'MIXED',aligned:Math.max(buys,sells),directional:directional.length,total:views.length}};
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
    const endTime=Date.now();const selectionStart=Number(url.searchParams.get('selectionStart'));const selectionEnd=Number(url.searchParams.get('selectionEnd'));let selection=null;
    if(url.searchParams.has('selectionStart')||url.searchParams.has('selectionEnd')){if(!Number.isFinite(selectionStart)||!Number.isFinite(selectionEnd)||selectionStart>=selectionEnd||selectionEnd-selectionStart>90*86_400_000)throw new HttpError(400,'invalid_selection','Select a valid chart range of 90 days or less');selection={start:selectionStart,end:selectionEnd};}
    const fetchImpl=fetcher(env);const [payload,multiTimeframe]=await Promise.all([fetchCandles(fetchImpl,asset,interval,endTime),fetchTimeframes(fetchImpl,asset,endTime,interval)]);
    let graph;try{graph=buildDecisionProvenGraph(payload,{asset,interval,horizonBars,now:endTime,selection});}catch(error){throw new HttpError(503,'insufficient_provider_data',error.message,{retryable:true});}
    const newsStart=selection?.start??endTime-24*3_600_000;const newsEnd=Math.min(selection?.end??endTime,endTime);let articles=[];let newsState='unavailable';
    try{articles=await fetchNews(fetchImpl,asset,newsStart,newsEnd);newsState=articles.length?'live':'no-matches';}catch{}
    return responseJson(request,env,{...graph,horizon,multiTimeframe,evidence:{news:{state:newsState,provider:'GDELT',articles},liquidations:{state:'unavailable',message:'Verified liquidation evidence is not available for this view, so it is not inferred.'}}},200,{cache:'public, max-age=10, stale-while-revalidate=30'});
  }catch(error){return errorResponse(request,env,error);}
}
