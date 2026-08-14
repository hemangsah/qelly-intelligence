import {errorResponse,responseJson} from '../../_lib/runtime.js';
import {effectivePublicRuntimeConfig} from '../../_lib/email-capability.js';
import {collectReadinessEvidence,readinessSnapshot} from '../../_lib/readiness.js';

export async function onRequest(context){
  const {request,env}=context;
  try{
    if(request.method.toUpperCase()!=='GET')return context.next();
    const runtime=effectivePublicRuntimeConfig(env,request.url);
    const evidence=await collectReadinessEvidence(context,runtime);
    const snapshot=readinessSnapshot(runtime,evidence);
    return responseJson(request,env,snapshot,snapshot.ready?200:503);
  }catch(error){return errorResponse(request,env,error);}
}
