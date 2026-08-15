import {providerCatalog,providerResult} from './providers.js';

const INTERVAL_SECONDS=Object.freeze({'1m':60,'5m':300,'15m':900,'30m':1800,'1h':3600,'4h':14400,'1d':86400});
const FIXTURE_PRICES=Object.freeze({BTCUSDT:78000,ETHUSDT:4100,BNBUSDT:760,SOLUSDT:210,XRPUSDT:3.2,ADAUSDT:1.1});
const FIXTURE_SYMBOLS=Object.freeze(Object.keys(FIXTURE_PRICES));
const PROVIDER_UI=Object.freeze({
  binance:Object.freeze({name:'Binance Public Market Data',transport:['REST','WebSocket'],symbols:['BTCUSDT','ETHUSDT','BNBUSDT','SOLUSDT','XRPUSDT','ADAUSDT']}),
  coinbase:Object.freeze({name:'Coinbase Exchange Market Data',transport:['REST'],symbols:['BTC-USD','ETH-USD','SOL-USD','XRP-USD','ADA-USD']}),
  fixture:Object.freeze({name:'Qelly Governed Demonstration',transport:['deterministic local'],symbols:FIXTURE_SYMBOLS})
});

const clamp=(value,min,max)=>Math.max(min,Math.min(max,Number(value)||min));
const safeInterval=(value)=>Object.hasOwn(INTERVAL_SECONDS,String(value))?String(value):'1m';
const baseSymbol=(value)=>String(value||'BTCUSDT').toUpperCase().replace(/[^A-Z0-9_-]/g,'').replace(/^B-/,'').replace('_','').replace('-USD','USDT');
const seedFor=(value)=>[...String(value)].reduce((acc,ch)=>((acc*31)+ch.charCodeAt(0))>>>0,2166136261);
const randomFactory=(seed)=>{let state=seed||1;return()=>{state=(state*1664525+1013904223)>>>0;return state/4294967296;};};

function fixtureCandles({symbol='BTCUSDT',interval='1m',limit=240}={}){
  const canonical=baseSymbol(symbol);
  const seconds=INTERVAL_SECONDS[safeInterval(interval)];
  const finalLimit=clamp(limit,30,1000);
  const bucket=Math.floor(Date.now()/(seconds*1000*finalLimit));
  const random=randomFactory(seedFor(`${canonical}:${interval}:${bucket}`));
  let close=FIXTURE_PRICES[canonical]||100;
  const now=Math.floor(Date.now()/1000/seconds)*seconds;
  const points=[];
  for(let i=finalLimit-1;i>=0;i--){
    const time=now-(i*seconds);
    const volatility=canonical.startsWith('BTC')?.004:canonical.startsWith('ETH')?.006:.009;
    const open=close;
    close=Math.max(.0001,open*(1+((random()-.485)*volatility)));
    const high=Math.max(open,close)*(1+(random()*volatility*.65));
    const low=Math.min(open,close)*(1-(random()*volatility*.65));
    const volume=(500+(random()*9500))*(canonical.startsWith('BTC')?1:4);
    points.push({time,open:+open.toFixed(8),high:+high.toFixed(8),low:+low.toFixed(8),close:+close.toFixed(8),volume:+volume.toFixed(3),closed:i>0});
  }
  return points;
}

function summarize(points){
  const first=points[0],last=points.at(-1);
  if(!first||!last)return {last:null,change:null,changePercent:null,high:null,low:null,volume:null};
  const change=last.close-first.open;
  const changePercent=first.open?(change/first.open)*100:0;
  return {last:last.close,change:+change.toFixed(8),changePercent:+changePercent.toFixed(4),high:Math.max(...points.map(point=>point.high)),low:Math.min(...points.map(point=>point.low)),volume:+points.reduce((sum,point)=>sum+point.volume,0).toFixed(3)};
}

const policyById=()=>new Map(providerCatalog().map(policy=>[policy.id,policy]));

export function liveMarketCatalog(){
  const policies=policyById();
  const providers=['fixture','binance','coinbase'].map(id=>{
    if(id==='fixture')return {id,name:PROVIDER_UI.fixture.name,transport:[...PROVIDER_UI.fixture.transport],symbols:[...PROVIDER_UI.fixture.symbols],intervals:Object.keys(INTERVAL_SECONDS),enabled:true,realtime:false,realtimeAuthorized:false,termsState:'governed_demonstration',reason:null};
    const policy=policies.get(id);
    return {id,name:PROVIDER_UI[id].name,transport:[...PROVIDER_UI[id].transport],symbols:[...PROVIDER_UI[id].symbols],intervals:Object.keys(INTERVAL_SECONDS),enabled:Boolean(policy?.enabled),realtime:Boolean(policy?.enabled),realtimeAuthorized:Boolean(policy?.enabled),termsState:policy?.termsState||'unavailable',reason:policy?.reason||null,termsUrl:policy?.termsUrl||null};
  });
  return {brandChart:'Qelly First-Party SVG renderer',chartRuntime:'first-party-only',thirdPartyRuntimeScripts:false,liveModeEnabled:providers.some(provider=>provider.id!=='fixture'&&provider.realtimeAuthorized),providers,guardrails:{publicMarketDataOnly:true,privateAccountEndpoints:false,trading:false,transfers:false,withdrawals:false,credentialsRequired:false,blockedProvidersNeverPresentedAsLive:true}};
}

function fixtureResult({requestedProvider='fixture',symbol='BTCUSDT',interval='1m',limit=240,fallbackReason=null,termsState=null}={}){
  const finalInterval=safeInterval(interval);
  const points=fixtureCandles({symbol,interval:finalInterval,limit});
  return {provider:'fixture',requestedProvider,symbol:baseSymbol(symbol),interval:finalInterval,points,summary:summarize(points),source:{name:PROVIDER_UI.fixture.name,providerId:'qelly-governed-demo',attribution:'Qelly deterministic demonstration · not live',mode:'simulated-demo',observedAt:new Date().toISOString(),fallbackReason,termsState,realtimeAuthorized:false},correlationId:crypto.randomUUID(),guardrails:{readOnly:true,publicMarketDataOnly:true,executionDisabled:true,live:false}};
}

function normalizeProviderCandles(result,requestedProvider,symbol,interval){
  const rows=Array.isArray(result?.data?.candles)?result.data.candles:[];
  const points=rows.map(row=>({time:Math.floor(Date.parse(row.time)/1000),open:Number(row.open),high:Number(row.high),low:Number(row.low),close:Number(row.close),volume:Number(row.volume),closed:true})).filter(point=>Number.isFinite(point.time)&&Number.isFinite(point.close));
  if(points.length<2)return null;
  const live=result.truthState==='live_provider';
  return {provider:requestedProvider,requestedProvider,symbol:String(symbol),interval:safeInterval(interval),points,summary:summarize(points),source:{name:PROVIDER_UI[requestedProvider]?.name||requestedProvider,providerId:result.provider,attribution:result.attribution||null,mode:live?'live-public':result.truthState==='cached_provider'?'cached-public':result.truthState==='stale_provider'?'stale-public':'unavailable',observedAt:result.observationTime||result.observedAt||null,fallbackReason:result.fallbackReason||null,termsState:result.termsState||null,realtimeAuthorized:live},correlationId:crypto.randomUUID(),guardrails:{readOnly:true,publicMarketDataOnly:true,executionDisabled:true,live}};
}

export async function liveMarketCandles(context,{provider='fixture',symbol='BTCUSDT',interval='1m',limit=240,mode='auto'}={}){
  const requestedProvider=['fixture','binance','coinbase'].includes(String(provider))?String(provider):'fixture';
  if(requestedProvider==='fixture')return fixtureResult({requestedProvider,symbol,interval,limit});
  const policy=policyById().get(requestedProvider);
  if(!policy?.enabled){
    return fixtureResult({requestedProvider,symbol,interval,limit,fallbackReason:policy?.reason||'provider_not_authorized_for_display',termsState:policy?.termsState||'unavailable'});
  }
  if(mode==='fixture')return fixtureResult({requestedProvider,symbol,interval,limit,fallbackReason:'fixture_mode_requested',termsState:policy.termsState});
  const capability=await providerResult(context,requestedProvider,'candles',symbol,{interval:safeInterval(interval),limit:clamp(limit,30,1000)});
  const normalized=normalizeProviderCandles(capability,requestedProvider,symbol,interval);
  return normalized||fixtureResult({requestedProvider,symbol,interval,limit,fallbackReason:capability?.fallbackReason||'provider_candles_unavailable',termsState:capability?.termsState||policy.termsState});
}

export async function liveMarketTicker(context,input={}){
  const result=await liveMarketCandles(context,{...input,limit:Math.min(Number(input.limit||120),240)});
  return {...result,points:undefined};
}

export function liveMarketStatus(){
  const catalog=liveMarketCatalog();
  return {enabled:catalog.liveModeEnabled,mode:catalog.liveModeEnabled?'rights-authorized-live':'governed-demo-fallback',providers:catalog.providers.map(({id,name,enabled,realtime,realtimeAuthorized,termsState,reason})=>({id,name,enabled,realtime,realtimeAuthorized,termsState,reason})),checkedAt:new Date().toISOString(),execution:false};
}

export const __liveMarketTest=Object.freeze({fixtureCandles,summarize,baseSymbol,safeInterval});
