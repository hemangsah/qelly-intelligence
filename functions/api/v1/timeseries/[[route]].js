import {HttpError,enforceRateLimit,errorResponse,resolveSession,responseJson,restRequest} from '../../../_lib/runtime.js';
import {marketDataSnapshot} from '../../../_lib/market-data-snapshot.js';

const historyLimit=(value)=>Math.max(2,Math.min(Number(value)||90,400));
const safeIdentifier=(value)=>{
  const text=decodeURIComponent(String(value||'')).trim();
  if(text.length<2||text.length>200)throw new HttpError(400,'timeseries_identifier_invalid','Time-series identifier is invalid');
  return text;
};

export async function onRequest(context){
  const {request,env}=context;
  try{
    if(request.method.toUpperCase()!=='GET')throw new HttpError(405,'method_not_allowed','Time-series endpoints are read-only');
    const session=await resolveSession(request,env,{required:true});
    const url=new URL(request.url);
    const routeName=Array.isArray(context.params?.route)?context.params.route.join('/'):String(context.params?.route||'');
    await enforceRateLimit(env,`user:${session.user.id}:timeseries:${routeName||'summary'}`,{limit:120});

    if(!routeName||routeName==='summary'){
      const snapshot=await marketDataSnapshot(env,session,{limit:200});
      const items=(snapshot.items||[]).filter((item)=>item.seriesKey).map((item)=>({
        canonicalKey:item.canonicalKey,
        symbol:item.symbol,
        displayName:item.displayName,
        assetClass:item.assetClass,
        venue:item.venue,
        seriesKey:item.seriesKey,
        metric:item.metric,
        interval:item.interval,
        unit:item.unit,
        truthState:item.truthState,
        observedAt:item.observedAt,
        value:item.value
      }));
      return responseJson(request,env,{
        instruments:Number(snapshot.dataPlane?.instrumentCount)||items.length,
        series:Number(snapshot.dataPlane?.seriesCount)||items.length,
        points:Number(snapshot.dataPlane?.pointCount)||0,
        supportedIntervals:['1d'],
        items,
        generatedAt:snapshot.generatedAt,
        truthBoundary:snapshot.truthBoundary,
        execution:false
      },200,{cookies:session.cookies,cache:'private, no-store'});
    }

    const interval=String(url.searchParams.get('interval')||'1d');
    if(interval!=='1d')throw new HttpError(400,'timeseries_interval_unavailable','The governed ECB reference-rate series currently supports the 1d reference interval only');
    const identifier=safeIdentifier(routeName);
    const result=await restRequest(env,session.accessToken,'rpc/qelly_timeseries_history',{
      method:'POST',
      body:{p_identifier:identifier,p_limit:historyLimit(url.searchParams.get('limit'))}
    });
    if(!result?.found)throw new HttpError(404,'timeseries_not_found','Governed time series was not found');
    return responseJson(request,env,result,200,{cookies:session.cookies,cache:'private, no-store'});
  }catch(error){return errorResponse(request,env,error);}
}

export const __timeseriesRouteTest=Object.freeze({historyLimit,safeIdentifier});
