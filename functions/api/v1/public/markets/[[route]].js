import {normalizeCandles,DECISION_INTERVALS} from '../../../../_lib/decision-proven-graph.js';
import {HttpError,enforceRateLimit,errorResponse,fetcher,publicRuntimeConfigForRequest,responseJson} from '../../../../_lib/runtime.js';
import {providerCatalog} from '../../../../_lib/providers.js';

const MARKET_UNAVAILABLE_REASON='Current governed market coverage is unavailable for this diagnostic surface.';
const DISPLAY_BOUNDARY='TradingView may be used as an external human-readable display surface. Qelly does not ingest, scrape, persist or use widget values for analytics.';
const HYPERLIQUID_URL='https://api.hyperliquid.xyz/info';
const HYPERLIQUID_DOCS='https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/info-endpoint';
const LIVE_INTERVALS=new Set(['15m','1h','4h','1d']);
const LIVE_ASSETS=Object.freeze([
  {canonicalId:'QI-CRYPTO-BTC',symbol:'BTC',name:'Bitcoin',category:'Layer 1'},
  {canonicalId:'QI-CRYPTO-ETH',symbol:'ETH',name:'Ethereum',category:'Smart-contract platforms'},
  {canonicalId:'QI-CRYPTO-SOL',symbol:'SOL',name:'Solana',category:'Smart-contract platforms'},
  {canonicalId:'QI-CRYPTO-XRP',symbol:'XRP',name:'XRP',category:'Payments'},
  {canonicalId:'QI-CRYPTO-HYPE',symbol:'HYPE',name:'Hyperliquid',category:'Exchange ecosystems'},
  {canonicalId:'QI-CRYPTO-DOGE',symbol:'DOGE',name:'Dogecoin',category:'Meme assets'}
]);
const LIVE_ASSET_MAP=new Map(LIVE_ASSETS.flatMap((asset)=>[
  [asset.canonicalId.toUpperCase(),asset],
  [asset.symbol.toUpperCase(),asset]
]));
const segments=(value)=>Array.isArray(value)?value.map(String):String(value||'').split('/').filter(Boolean);
const providerState=()=>providerCatalog().map((provider)=>({
  id:provider.id,
  enabled:Boolean(provider.enabled),
  capabilities:[...(provider.capabilities||[])],
  termsState:provider.termsState||null,
  reason:provider.reason||null,
  termsUrl:provider.termsUrl||null,
  truthState:provider.enabled?(provider.id==='ecb'?'DELAYED_REFERENCE':'LIVE'):'UNAVAILABLE'
}));
const boundary=(runtime)=>({
  generatedAt:new Date().toISOString(),
  releaseSha:runtime.releaseSha,
  environment:runtime.environment,
  truthState:'UNAVAILABLE',
  mode:'governed-only',
  reason:MARKET_UNAVAILABLE_REASON,
  providers:providerState(),
  externalDisplay:{provider:'TradingView',usage:'display-only',boundary:DISPLAY_BOUNDARY,url:'https://www.tradingview.com/'},
  externalResearch:[
    {name:'Forex Factory',usage:'external-research',url:'https://www.forexfactory.com/calendar'},
    {name:'European Central Bank',usage:'official-reference-source',url:'https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html/index.en.html'}
  ],
  guardrails:{readOnly:true,execution:false,fabricatedObservations:false,externalDisplayConsumedByAnalytics:false}
});
const ip=(request)=>request.headers.get('cf-connecting-ip')||request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()||'anonymous';
const round=(value,digits=6)=>Number.isFinite(Number(value))?Number(Number(value).toFixed(digits)):null;
const boundedInteger=(value,{min,max,fallback})=>{
  const parsed=Number.parseInt(String(value??''),10);
  return Number.isFinite(parsed)?Math.max(min,Math.min(max,parsed)):fallback;
};
function liveAsset(value){
  const decoded=decodeURIComponent(String(value||'')).trim().toUpperCase();
  const asset=LIVE_ASSET_MAP.get(decoded);
  if(!asset)throw new HttpError(404,'asset_not_supported','This asset is not currently available on the public Asset Dossier.',{details:{supported:LIVE_ASSETS.map((item)=>item.canonicalId)}});
  return asset;
}
function freshnessFor(observedAt,intervalMs,now){
  const ageMs=Math.max(0,now-observedAt);
  if(ageMs<=intervalMs*2)return {state:'live',truthState:'LIVE',ageMs,degraded:false,confidence:.96};
  if(ageMs<=intervalMs*6)return {state:'delayed',truthState:'DELAYED',ageMs,degraded:true,confidence:.82};
  if(ageMs<=intervalMs*24)return {state:'stale',truthState:'STALE',ageMs,degraded:true,confidence:.62};
  throw new HttpError(503,'provider_stale','Current market observations are too old to display. Retry shortly.',{retryable:true});
}
async function fetchLiveCandles(env,asset,{interval='1h',limit=168,now=Date.now()}={}){
  if(!LIVE_INTERVALS.has(interval))throw new HttpError(400,'unsupported_interval','Choose a supported chart interval.',{details:{allowed:[...LIVE_INTERVALS]}});
  const intervalMs=DECISION_INTERVALS[interval];
  const boundedLimit=boundedInteger(limit,{min:24,max:240,fallback:168});
  let response;
  try{
    response=await fetcher(env)(HYPERLIQUID_URL,{
      method:'POST',
      headers:{'content-type':'application/json','user-agent':'QELLY-Intelligence/public-asset-dossier'},
      body:JSON.stringify({type:'candleSnapshot',req:{coin:asset.symbol,interval,startTime:now-intervalMs*(boundedLimit+4),endTime:now}}),
      signal:AbortSignal.timeout(8_000)
    });
  }catch{
    throw new HttpError(503,'provider_unavailable','Current market observations are temporarily unavailable. Retry shortly.',{retryable:true});
  }
  if(!response.ok)throw new HttpError(503,'provider_unavailable','Current market observations are temporarily unavailable. Retry shortly.',{details:{status:response.status},retryable:true});
  let raw;
  try{raw=await response.json();}catch{throw new HttpError(503,'provider_invalid_response','Current market observations returned an invalid response. Retry shortly.',{retryable:true});}
  const candles=normalizeCandles(raw).slice(-boundedLimit);
  if(candles.length<24)throw new HttpError(503,'insufficient_provider_data','Current market history is insufficient for this view. Retry shortly.',{retryable:true});
  const freshness=freshnessFor(candles.at(-1).time,intervalMs,now);
  return {candles,freshness,interval,boundedLimit,now};
}
function publicSource(asset,live){
  const observedAt=new Date(live.candles.at(-1).time).toISOString();
  return {
    provider:'hyperliquid-public',
    providerName:'Hyperliquid',
    sourceUrl:HYPERLIQUID_DOCS,
    attribution:'Hyperliquid public candle data',
    observationTime:observedAt,
    ingestionTime:new Date(live.now).toISOString(),
    freshness:live.freshness.state,
    qualityState:live.freshness.truthState==='LIVE'?'live-public':'stale-last-known-good',
    confidence:live.freshness.confidence,
    cacheState:'provider-direct',
    degraded:live.freshness.degraded,
    fallbackReason:live.freshness.degraded?'The latest provider observation is not fully current.':null,
    entitlement:'public-read',
    asset:asset.symbol
  };
}
function assetObservation(asset,live){
  const candles=live.candles;
  const recent=candles.slice(-24);
  const last=candles.at(-1);
  const prior=candles.at(-25)??candles[0];
  const open24h=Number(prior?.close??recent[0]?.open);
  const price=Number(last.close);
  const high24h=Math.max(...recent.map((item)=>item.high));
  const low24h=Math.min(...recent.map((item)=>item.low));
  const volume24h=recent.reduce((sum,item)=>sum+item.volume,0);
  return {
    canonicalId:asset.canonicalId,
    symbol:asset.symbol,
    providerSymbol:asset.symbol,
    name:asset.name,
    assetClass:'crypto',
    category:asset.category,
    currency:'USD',
    price:round(price,6),
    change24h:open24h>0?round((price/open24h-1)*100,4):null,
    open24h:round(open24h,6),
    high24h:round(high24h,6),
    low24h:round(low24h,6),
    volume24h:round(volume24h,4),
    quoteVolume24h:null,
    marketCap:null,
    marketCapDefinition:'Market capitalization is not supplied by this candle source.',
    source:publicSource(asset,live),
    definitions:{
      price:'Most recent validated public candle close.',
      change24h:'Change from the approximately 24-hour prior hourly close.',
      volume24h:'Sum of provider-reported base volume across the latest 24 hourly candles.',
      marketCap:'Unavailable from this source.'
    },
    actions:{compare:'available-public',evidence:'available-public'},
    generatedAt:new Date(live.now).toISOString(),
    state:live.freshness.truthState.toLowerCase(),
    fabricatedFallback:false
  };
}
function candleEnvelope(runtime,asset,live){
  const source=publicSource(asset,live);
  return {
    schemaVersion:'qelly.public-market-candles/2.0.0',
    generatedAt:new Date(live.now).toISOString(),
    releaseSha:runtime.releaseSha,
    environment:runtime.environment,
    truthState:live.freshness.truthState,
    mode:'live-public',
    assetId:asset.canonicalId,
    symbol:asset.symbol,
    interval:live.interval,
    points:live.candles.map((item)=>({
      time:Math.floor(item.time/1000),
      open:item.open,
      high:item.high,
      low:item.low,
      close:item.close,
      volume:item.volume,
      trades:item.trades
    })),
    source:{
      provider:source.providerName,
      attribution:source.attribution,
      observedAt:source.observationTime,
      mode:'live-public',
      freshness:source.freshness,
      sourceUrl:source.sourceUrl
    },
    guardrails:{readOnly:true,execution:false,fabricatedObservations:false},
    fabricatedFallback:false
  };
}

export async function onRequest(context){
  const {request,env={},params}=context;
  try{
    if(request.method.toUpperCase()!=='GET')return context.next();
    const runtime=publicRuntimeConfigForRequest(env,request.url);
    const route=segments(params.route);

    if(route[0]==='assets'&&route.length>=2){
      await enforceRateLimit(env,'public-asset-dossier:'+ip(request),{limit:30,windowMs:60_000});
      const asset=liveAsset(route[1]);
      if(route[2]==='candles'){
        const url=new URL(request.url);
        const interval=url.searchParams.get('interval')||'1h';
        const limit=boundedInteger(url.searchParams.get('limit'),{min:24,max:240,fallback:168});
        const live=await fetchLiveCandles(env,asset,{interval,limit});
        return responseJson(request,env,candleEnvelope(runtime,asset,live),200,{cache:'public, max-age=10, stale-while-revalidate=20'});
      }
      if(route.length===2){
        const live=await fetchLiveCandles(env,asset,{interval:'1h',limit:48});
        return responseJson(request,env,assetObservation(asset,live),200,{cache:'public, max-age=10, stale-while-revalidate=20'});
      }
    }

    const common=boundary(runtime);
    if(route.length===0||route[0]==='overview'){
      return responseJson(request,env,{
        ...common,
        kpis:{authorizedInternalCryptoFeeds:common.providers.filter((provider)=>provider.enabled&&provider.id!=='ecb').length,approvedReferenceFeeds:common.providers.filter((provider)=>provider.enabled&&provider.id==='ecb').length},
        items:[]
      },200,{cache:'no-store'});
    }
    if(route[0]==='assets'&&route.length===1){
      return responseJson(request,env,{...common,total:0,items:[]},200,{cache:'no-store'});
    }
    throw new HttpError(404,'public_market_route_not_found','Public market route not found');
  }catch(error){
    return errorResponse(request,env,error);
  }
}

export const __publicMarketTruthTest=Object.freeze({
  MARKET_UNAVAILABLE_REASON,DISPLAY_BOUNDARY,providerState,segments,LIVE_ASSETS,liveAsset,freshnessFor,assetObservation,candleEnvelope
});
