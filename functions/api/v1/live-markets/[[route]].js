import {HttpError,bootstrapContext,enforceRateLimit,errorResponse,responseJson,resolveSession} from '../../../_lib/runtime.js';
import {liveMarketCandles,liveMarketCatalog,liveMarketStatus,liveMarketTicker} from '../../../_lib/live-markets.js';

export async function route(context){
  const {request,env}=context;
  const method=request.method.toUpperCase();
  if(method!=='GET')throw new HttpError(405,'method_not_allowed','Live market compatibility endpoints are read-only');

  const session=await resolveSession(request,env,{required:true});
  await bootstrapContext(env,session);
  const url=new URL(request.url);
  const routeName=Array.isArray(context.params?.route)?context.params.route.join('/'):String(context.params?.route||'');
  await enforceRateLimit(env,`live-market:${session.user.id}:${routeName}`,{limit:120});

  const options={
    provider:url.searchParams.get('provider')||'fixture',
    symbol:url.searchParams.get('symbol')||'BTCUSDT',
    interval:url.searchParams.get('interval')||'1m',
    limit:url.searchParams.get('limit')||240,
    mode:url.searchParams.get('mode')||'auto'
  };

  if(routeName==='catalog')return responseJson(request,env,liveMarketCatalog(),200,{cookies:session.cookies,cache:'private, no-store'});
  if(routeName==='status')return responseJson(request,env,liveMarketStatus(),200,{cookies:session.cookies,cache:'private, no-store'});
  if(routeName==='candles'){
    const result=await liveMarketCandles(context,options);
    return responseJson(request,env,result,200,{cookies:session.cookies,cache:'private, no-store',headers:{'X-Qelly-Data-Mode':result.source.mode}});
  }
  if(routeName==='ticker'){
    const result=await liveMarketTicker(context,options);
    return responseJson(request,env,result,200,{cookies:session.cookies,cache:'private, no-store',headers:{'X-Qelly-Data-Mode':result.source.mode}});
  }
  throw new HttpError(404,'live_market_route_not_found','Live market endpoint was not found');
}

export async function onRequest(context){
  try{return await route(context);}catch(error){return errorResponse(context.request,context.env,error);}
}
