import {errorResponse,responseJson} from '../../_lib/runtime.js';
import {effectivePublicRuntimeConfig} from '../../_lib/email-capability.js';
import {readinessSnapshot} from '../../_lib/readiness.js';

export async function onRequest(context){
  const {request,env}=context;
  try{
    if(request.method.toUpperCase()!=='GET')return context.next();
    const runtime=effectivePublicRuntimeConfig(env,request.url);
    return responseJson(request,env,readinessSnapshot(runtime),503);
  }catch(error){return errorResponse(request,env,error);}
}
