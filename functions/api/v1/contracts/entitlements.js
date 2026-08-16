import {enforceRateLimit,errorResponse,resolveSession,responseJson} from '../../../_lib/runtime.js';
import {entitlementContract} from '../../../_lib/entitlement-policy.js';

export async function onRequest(context){
  const {request,env}=context;
  try{
    if(request.method.toUpperCase()!=='GET')return context.next();
    const session=await resolveSession(request,env,{required:true});
    await enforceRateLimit(env,`user:${session.user.id}:contracts/entitlements`,{limit:90});
    return responseJson(request,env,{...entitlementContract(),generatedAt:new Date().toISOString(),execution:false},200,{cookies:session.cookies,cache:'private, no-store'});
  }catch(error){return errorResponse(request,env,error);}
}
