import {buildDecisionProvenGraph,DECISION_INTERVALS} from '../../_lib/decision-proven-graph.js';
import {HttpError,enforceRateLimit,errorResponse,fetcher,jsonBody,responseJson} from '../../_lib/runtime.js';

const ASSETS=Object.freeze(['BTC','ETH','SOL','HYPE','XRP','DOGE']);
const ASSET_SET=new Set(ASSETS);
const INTERVAL='1h';
const POINTS=120;
const FORMULAS=Object.freeze({
  momentum_quality:Object.freeze({
    id:'momentum_quality',
    label:'Momentum quality',
    description:'24-hour price change scaled by realized volatility.',
    direction:'desc',
    calculate:({change24hPct,realizedVolatilityPct})=>change24hPct/Math.max(realizedVolatilityPct,1)
  }),
  trend_efficiency:Object.freeze({
    id:'trend_efficiency',
    label:'Trend efficiency',
    description:'Per-bar trend slope scaled by current ATR.',
    direction:'desc',
    calculate:({trendPerBarPct,atrPct})=>trendPerBarPct/Math.max(atrPct,.01)
  }),
  rsi_impulse:Object.freeze({
    id:'rsi_impulse',
    label:'RSI impulse',
    description:'RSI distance from neutral, signed from -1 to +1.',
    direction:'desc',
    calculate:({rsi14})=>(rsi14-50)/50
  })
});
const ip=(request)=>request.headers.get('cf-connecting-ip')||request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()||'anonymous';
const round=(value,digits=6)=>Number.isFinite(value)?Number(value.toFixed(digits)):null;

function publicCatalog(){
  return {
    schemaVersion:'qelly.formula-screener/1.0.0',
    state:'ready',
    assets:ASSETS,
    formulas:Object.values(FORMULAS).map(({calculate,...formula})=>formula),
    source:{provider:'Hyperliquid',market:'public candle data',interval:INTERVAL},
    boundaries:{customExpressions:false,arbitraryCode:false,arbitrarySql:false,providerProxy:false,privilegedState:false}
  };
}

function normalizeRequest(body){
  if(body?.expression!=null||body?.formulas!=null||body?.formulaFilters!=null)throw new HttpError(400,'custom_expression_not_supported','Choose one of the supported Formula Screener metrics.');
  const formulaId=String(body?.formula||'momentum_quality');
  const formula=FORMULAS[formulaId];
  if(!formula)throw new HttpError(400,'unsupported_formula','Choose a supported Formula Screener metric.',{details:{allowed:Object.keys(FORMULAS)}});
  const requested=body?.assets==null?ASSETS:body.assets;
  if(!Array.isArray(requested)||requested.length<1||requested.length>ASSETS.length)throw new HttpError(400,'invalid_assets','Choose between 1 and 6 supported assets.');
  const assets=[...new Set(requested.map(value=>String(value).trim().toUpperCase()))];
  const unsupported=assets.filter(asset=>!ASSET_SET.has(asset));
  if(unsupported.length)throw new HttpError(400,'unsupported_asset','One or more assets are not supported.',{details:{unsupported,allowed:ASSETS}});
  return {formula,assets};
}

async function fetchCandles(fetchImpl,asset,endTime){
  let response;
  try{
    response=await fetchImpl('https://api.hyperliquid.xyz/info',{
      method:'POST',
      headers:{'content-type':'application/json','user-agent':'QELLY-Intelligence/formula-screener'},
      body:JSON.stringify({type:'candleSnapshot',req:{coin:asset,interval:INTERVAL,startTime:endTime-DECISION_INTERVALS[INTERVAL]*POINTS,endTime}}),
      signal:AbortSignal.timeout(8_000)
    });
  }catch(error){
    throw new HttpError(503,'provider_unavailable','Live Formula Screener data is temporarily unavailable.',{details:{asset},retryable:true});
  }
  if(!response.ok)throw new HttpError(503,'provider_unavailable','Live Formula Screener data is temporarily unavailable.',{details:{asset,status:response.status},retryable:true});
  try{return await response.json();}
  catch{throw new HttpError(503,'provider_invalid_response','Live Formula Screener data returned an invalid response.',{details:{asset},retryable:true});}
}

function metricsFor(graph){
  const candles=graph.market?.candles||[];
  const last=Number(candles.at(-1)?.close);
  const base=Number(candles.at(-25)?.close??candles[0]?.close);
  const change24hPct=Number.isFinite(last)&&Number.isFinite(base)&&base>0?(last/base-1)*100:null;
  return {
    lastPrice:Number.isFinite(last)?last:null,
    change24hPct,
    realizedVolatilityPct:Number(graph.metrics?.realizedVolatilityPct),
    atrPct:Number(graph.metrics?.atrPct),
    trendPerBarPct:Number(graph.metrics?.trendPerBarPct),
    rsi14:Number(graph.metrics?.rsi14)
  };
}

async function evaluateAsset(fetchImpl,asset,formula,endTime){
  const payload=await fetchCandles(fetchImpl,asset,endTime);
  let graph;
  try{graph=buildDecisionProvenGraph(payload,{asset,interval:INTERVAL,horizonBars:4,now:endTime});}
  catch(error){throw new HttpError(503,'insufficient_provider_data','Live Formula Screener data is insufficient for this asset.',{details:{asset},retryable:true});}
  const metrics=metricsFor(graph);
  if(!Object.values(metrics).every(Number.isFinite))throw new HttpError(503,'insufficient_provider_data','Live Formula Screener data is incomplete for this asset.',{details:{asset},retryable:true});
  return {
    asset,
    formula:formula.id,
    value:round(formula.calculate(metrics)),
    metrics:{
      lastPrice:round(metrics.lastPrice,4),
      change24hPct:round(metrics.change24hPct,4),
      realizedVolatilityPct:round(metrics.realizedVolatilityPct,4),
      atrPct:round(metrics.atrPct,4),
      trendPerBarPct:round(metrics.trendPerBarPct,6),
      rsi14:round(metrics.rsi14,2)
    },
    source:{provider:'Hyperliquid',observedAt:graph.observedAt},
    freshness:{state:String(graph.truthState||'DEGRADED').toLowerCase(),ageMs:graph.freshness?.ageMs??null},
    state:'available'
  };
}

export async function runFormulaScreen(env,request={}){
  return runScreen(env,normalizeRequest(request));
}

async function runScreen(env,{formula,assets}){
  const fetchImpl=fetcher(env);
  const endTime=Date.now();
  const settled=await Promise.allSettled(assets.map(asset=>evaluateAsset(fetchImpl,asset,formula,endTime)));
  const rows=settled.map((result,index)=>{
    if(result.status==='fulfilled')return result.value;
    return {
      asset:assets[index],
      formula:formula.id,
      value:null,
      metrics:null,
      source:{provider:'Hyperliquid',observedAt:null},
      freshness:{state:'unavailable',ageMs:null},
      state:'unavailable'
    };
  });
  const available=rows.filter(row=>row.state==='available');
  if(!available.length)throw new HttpError(503,'provider_unavailable','Live Formula Screener data is temporarily unavailable. Retry shortly.',{retryable:true});
  rows.sort((left,right)=>{
    if(left.value==null)return 1;
    if(right.value==null)return -1;
    return formula.direction==='asc'?left.value-right.value:right.value-left.value;
  });
  return {
    schemaVersion:'qelly.formula-screener/1.0.0',
    generatedAt:new Date(endTime).toISOString(),
    state:available.length===rows.length?'live':'partial',
    formula:{id:formula.id,label:formula.label,description:formula.description,direction:formula.direction},
    source:{provider:'Hyperliquid',market:'public candle data',interval:INTERVAL},
    rows,
    available:available.length,
    requested:rows.length,
    fabricatedFallback:false
  };
}

export async function onRequest({request,env={}}){
  try{
    if(!['GET','POST'].includes(request.method))throw new HttpError(405,'method_not_allowed','Use GET for the public catalog or POST to evaluate a formula.');
    await enforceRateLimit(env,'public-formula-screener:'+ip(request),{limit:20,windowMs:60_000});
    if(request.method==='GET')return responseJson(request,env,publicCatalog(),200,{cache:'public, max-age=60, stale-while-revalidate=300'});
    const body=await jsonBody(request,8_192);
    return responseJson(request,env,await runFormulaScreen(env,body),200,{cache:'public, max-age=5, stale-while-revalidate=15'});
  }catch(error){return errorResponse(request,env,error);}
}

export const __test=Object.freeze({ASSETS,FORMULAS,publicCatalog,normalizeRequest,metricsFor,evaluateAsset,runScreen});
