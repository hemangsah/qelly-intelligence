import {errorResponse,responseJson} from '../../../_lib/runtime.js';
import {effectivePublicRuntimeConfig} from '../../../_lib/email-capability.js';
import {collectReadinessEvidence} from '../../../_lib/readiness.js';
import {providerCatalog} from '../../../_lib/providers.js';
import {platformReadinessSnapshot} from '../../../_lib/platform-readiness.js';

export async function onRequest(context){
  const {request,env}=context;
  try{
    if(request.method.toUpperCase()!=='GET')return context.next();
    const runtime=effectivePublicRuntimeConfig(env,request.url);
    const evidence=await collectReadinessEvidence(context,runtime);
    const snapshot=platformReadinessSnapshot(runtime,evidence,providerCatalog());
    return responseJson(request,env,snapshot,200,{cache:'no-store'});
  }catch(error){
    return errorResponse(request,env,error);
  }
}
