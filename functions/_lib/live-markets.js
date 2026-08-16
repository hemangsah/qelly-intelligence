import {providerCatalog,providerResult} from './providers.js';

const INTERVAL_SECONDS=Object.freeze({'1m':60,'5m':300,'15m':900,'30m':1800,'1h':3600,'4h':14400,'1d':86400});
const PROVIDER_UI=Object.freeze({
  binance:Object.freeze({name:'Binance Public Market Data',transport:['REST','WebSocket'],symbols:['BTCUSDT','ETHUSDT','BNBUSDT','SOLUSDT','XRPUSDT','ADAUSDT']}),
  coinbase:Object.freeze({name:'Coinbase Exchange Market Data',transport:['REST'],symbols:['BTC-USD','ETH-USD','SOL-USD','XRP-USD','ADA-USD']})
});

const clamp=(value,min,max)=>Math.max(min,Math.min(max,Number(value)||min));
const safeInterval=(value)=>Object.hasOwn(INTERVAL_SECONDS,String(value))?String(value):'1m';
const policyById=()=>new Map(providerCatalog().map(policy=>[policy.id,policy]));

function summarize(points){
  const first=points[0],last=points.at(-1);
  if(!first||!last)return {last:null,change:null,changePercent:null,high:null,low:null,volume:null};
  const change=last.close-first.open;
  const changePercent=first.open?(change/first.open)*100:null;
  return {last:last.close,change:Number.isFinite(change)?+change.toFixed(8):null,changePercent:Number.isFinite(changePercent)?+changePercent.toFixed(4):null,high:Math.max(...points.map(point=>point.high)),low:Math.min(...points.map(point=>point.low)),volume:+points.reduce((sum,point)=>sum+point.volume,0).toFixed(3)};
}

function unavailableResult({requestedProvider,symbol,interval,reason,termsState}={}){
  return {
    provider:requestedProvider||null,
    requestedProvider:requestedProvider||null,
    symbol:String(symbol||''),
    interval:safeInterval(interval),
    points:[],
    summary:summarize([]),
    source:{
      name:PROVIDER_UI[requestedProvider]?.name||requestedProvider||'No authorized provider',
      providerId:requestedProvider||null,
      attribution:null,
      mode:'unavailable',
      observedAt:null,
      fallbackReason:reason||'no_rights_authorized_market_provider',
      termsState:termsState||'unavailable',
      realtimeAuthorized:false
    },
    correlationId:crypto.randomUUID(),
    guardrails:{readOnly:true,publicMarketDataOnly:true,executionDisabled:true,live:false,fabricatedObservations:false}
  };
}

export function liveMarketCatalog(){
  const policies=policyById();
  const providers=['binance','coinbase'].map(id=>{
    const policy=policies.get(id);
    return {id,name:PROVIDER_UI[id].name,transport:[...PROVIDER_UI[id].transport],symbols:[...PROVIDER_UI[id].symbols],intervals:Object.keys(INTERVAL_SECONDS),enabled:Boolean(policy?.enabled),realtime:Boolean(policy?.enabled),realtimeAuthorized:Boolean(policy?.enabled),termsState:policy?.termsState||'unavailable',reason:policy?.reason||null,termsUrl:policy?.termsUrl||null};
  });
  return {
    chartRuntime:'external-display-separated-from-governed-data',
    externalDisplay:{provider:'TradingView',usage:'display-only',url:'https://www.tradingview.com/',consumedByAnalytics:false},
    liveModeEnabled:providers.some(provider=>provider.realtimeAuthorized),
    providers,
    guardrails:{publicMarketDataOnly:true,privateAccountEndpoints:false,trading:false,transfers:false,withdrawals:false,credentialsRequired:false,blockedProvidersNeverPresentedAsLive:true,fabricatedFallback:false}
  };
}

function normalizeProviderCandles(result,requestedProvider,symbol,interval){
  const rows=Array.isArray(result?.data?.candles)?result.data.candles:[];
  const points=rows.map(row=>({time:Math.floor(Date.parse(row.time)/1000),open:Number(row.open),high:Number(row.high),low:Number(row.low),close:Number(row.close),volume:Number(row.volume),closed:true})).filter(point=>Number.isFinite(point.time)&&Number.isFinite(point.open)&&Number.isFinite(point.high)&&Number.isFinite(point.low)&&Number.isFinite(point.close)&&Number.isFinite(point.volume));
  if(points.length<2)return null;
  const live=result.truthState==='live_provider';
  return {provider:requestedProvider,requestedProvider,symbol:String(symbol),interval:safeInterval(interval),points,summary:summarize(points),source:{name:PROVIDER_UI[requestedProvider]?.name||requestedProvider,providerId:result.provider,attribution:result.attribution||null,mode:live?'live-public':result.truthState==='cached_provider'?'cached-public':result.truthState==='stale_provider'?'stale-public':'unavailable',observedAt:result.observationTime||result.observedAt||null,fallbackReason:result.fallbackReason||null,termsState:result.termsState||null,realtimeAuthorized:live},correlationId:crypto.randomUUID(),guardrails:{readOnly:true,publicMarketDataOnly:true,executionDisabled:true,live,fabricatedObservations:false}};
}

export async function liveMarketCandles(context,{provider='binance',symbol='BTCUSDT',interval='1m',limit=240}={}){
  const requestedProvider=['binance','coinbase'].includes(String(provider))?String(provider):null;
  if(!requestedProvider)return unavailableResult({requestedProvider:String(provider||''),symbol,interval,reason:'provider_not_supported'});
  const policy=policyById().get(requestedProvider);
  if(!policy?.enabled)return unavailableResult({requestedProvider,symbol,interval,reason:policy?.reason||'provider_not_authorized_for_display',termsState:policy?.termsState||'unavailable'});
  const capability=await providerResult(context,requestedProvider,'candles',symbol,{interval:safeInterval(interval),limit:clamp(limit,30,1000)});
  const normalized=normalizeProviderCandles(capability,requestedProvider,symbol,interval);
  return normalized||unavailableResult({requestedProvider,symbol,interval,reason:capability?.fallbackReason||'provider_candles_unavailable',termsState:capability?.termsState||policy.termsState});
}

export async function liveMarketTicker(context,input={}){
  const result=await liveMarketCandles(context,{...input,limit:Math.min(Number(input.limit||120),240)});
  return {...result,points:undefined};
}

export function liveMarketStatus(){
  const catalog=liveMarketCatalog();
  return {enabled:catalog.liveModeEnabled,mode:catalog.liveModeEnabled?'rights-authorized-live':'unavailable-no-authorized-provider',providers:catalog.providers.map(({id,name,enabled,realtime,realtimeAuthorized,termsState,reason})=>({id,name,enabled,realtime,realtimeAuthorized,termsState,reason})),externalDisplay:catalog.externalDisplay,checkedAt:new Date().toISOString(),execution:false,fabricatedFallback:false};
}

export const __liveMarketTest=Object.freeze({summarize,safeInterval,unavailableResult});
