import {bootstrapContext,correlationId,enforceRateLimit,errorResponse,resolveSession} from '../../../_lib/runtime.js';
import {handlePortfolioRead} from '../../../_lib/portfolio-cloud.js';

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
    if(!['GET','HEAD'].includes(method))return context.next();
    const session=await resolveSession(request,env,{required:true});
    await enforceRateLimit(env,`portfolio:${session.user.id}:${relative||'root'}`,{limit:90});
    const qelly=await bootstrapContext(env,session);
    response=await handlePortfolioRead(context,relative,session,qelly);
    return response;
  }catch(error){
    response=errorResponse(request,env,error);
    return response;
  }finally{
    try{console.log(JSON.stringify({event:'qelly_portfolio_read_request',correlationId:correlationId(request),method,path:new URL(request.url).pathname,status:response?.status??500,durationMs:Date.now()-started,bodyLogged:false}));}catch{}
  }
}

export const __portfolioRouteTest=Object.freeze({routePath});
