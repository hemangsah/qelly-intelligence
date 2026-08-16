import {bootstrapContext,correlationId,enforceRateLimit,errorResponse,requireOrigin,resolveSession} from '../../../_lib/runtime.js';
import {handleWatchlistRoot} from '../../../_lib/watchlists.js';

export async function onRequest(context){
  const {request,env}=context;
  const method=request.method.toUpperCase();
  const started=Date.now();
  let response;
  try{
    if(method==='OPTIONS')return context.next();
    if(!['GET','HEAD'].includes(method))requireOrigin(request,env);
    const session=await resolveSession(request,env,{required:true});
    await enforceRateLimit(env,`watchlists:${session.user.id}:root`,{limit:90});
    const qelly=await bootstrapContext(env,session);
    response=await handleWatchlistRoot(context,method,session,qelly);
    if(response)return response;
    return context.next();
  }catch(error){
    response=errorResponse(request,env,error);
    return response;
  }finally{
    try{console.log(JSON.stringify({event:'qelly_watchlist_root_request',correlationId:correlationId(request),method,path:new URL(request.url).pathname,status:response?.status??500,durationMs:Date.now()-started,bodyLogged:false}));}catch{}
  }
}
