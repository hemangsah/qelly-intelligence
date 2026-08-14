import {errorResponse,responseJson} from '../../_lib/runtime.js';
import {effectivePublicRuntimeConfig} from '../../_lib/email-capability.js';

export async function onRequest(context){
  const {request,env}=context;
  try{
    if(request.method.toUpperCase()!=='GET')return context.next();
    const runtime=effectivePublicRuntimeConfig(env,request.url);
    return responseJson(request,env,{
      status:'ok',
      scope:'process-and-static-runtime',
      releaseSha:runtime.releaseSha,
      deterministicLocal:true,
      authenticationConfigured:runtime.capabilities.authentication,
      emailDeliveryConfigured:runtime.capabilities.emailDelivery,
      cloudSyncConfigured:runtime.capabilities.cloudSync,
      liveProvidersConfigured:runtime.capabilities.liveProviders,
      providerRights:'restricted',
      trading:false,
      custody:false,
      transfers:false
    });
  }catch(error){return errorResponse(request,env,error);}
}
