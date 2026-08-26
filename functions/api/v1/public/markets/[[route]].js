import {HttpError,errorResponse,publicRuntimeConfigForRequest,responseJson} from '../../../../_lib/runtime.js';
import {providerCatalog} from '../../../../_lib/providers.js';

const MARKET_UNAVAILABLE_REASON='No rights-authorized internal crypto market-data provider is currently active. Qelly does not generate substitute prices or candles.';
const DISPLAY_BOUNDARY='TradingView may be used as an external human-readable display surface. Qelly does not ingest, scrape, persist or use widget values for analytics.';

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

export async function onRequest(context){
  const {request,env,params}=context;
  try{
    if(request.method.toUpperCase()!=='GET')return context.next();
    const runtime=publicRuntimeConfigForRequest(env,request.url);
    const route=segments(params.route);
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

    if(route[0]==='assets'&&route.length>=2){
      const assetId=decodeURIComponent(route[1]);
      if(route[2]==='candles'){
        return responseJson(request,env,{...common,assetId,interval:new URL(request.url).searchParams.get('interval')||null,points:[]},200,{cache:'no-store'});
      }
      throw new HttpError(503,'governed_market_observation_unavailable',MARKET_UNAVAILABLE_REASON,{assetId,truthState:'UNAVAILABLE'});
    }

    throw new HttpError(404,'public_market_route_not_found','Public market route not found');
  }catch(error){
    return errorResponse(request,env,error);
  }
}

export const __publicMarketTruthTest=Object.freeze({MARKET_UNAVAILABLE_REASON,DISPLAY_BOUNDARY,providerState,segments});
