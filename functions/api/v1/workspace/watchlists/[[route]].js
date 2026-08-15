import {bootstrapContext,correlationId,enforceRateLimit,errorResponse,requireOrigin,resolveSession} from '../../../../_lib/runtime.js';
import {handleWatchlistNested} from '../../../../_lib/watchlists.js';

const routePath=(context)=>{
  const value=context.params?.route;
  return (Array.isArray(value)?value.join('/'):String(value||'')).replace(/^\/+|\/+$/g,'');
};

export async function onRequest(context){
  const {request,env}=context;
  const method=request.method.toUpperCase();
  const relative=routePath(context);
  const started=Date.now();
  let response;
  try{
    if(method==='OPTIONS')return context.next();
    if(!['GET','HEAD'].includes(method))requireOrigin(request,env);
    const session=await resolveSession(request,env,{required:true});
    await enforceRateLimit(env,`watchlists:${session.user.id}:${relative||'nested'}`,{limit:120});
    const qelly=await bootstrapContext(env,session);
    response=await handleWatchlistNested(context,relative,method,session,qelly);
    if(response)return response;
    return context.next();
  }catch(error){
    response=errorResponse(request,env,error);
    return response;
  }finally{
    try{console.log(JSON.stringify({event:'qelly_watchlist_nested_request',correlationId:correlationId(request),method,path:new URL(request.url).pathname,status:response?.status??500,durationMs:Date.now()-started,bodyLogged:false}));}catch{}
  }
}

export const __watchlistRouteTest=Object.freeze({routePath});
