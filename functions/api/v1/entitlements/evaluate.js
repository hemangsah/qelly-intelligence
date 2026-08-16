import {enforceRateLimit,errorResponse,jsonBody,requireCsrf,resolveSession,responseJson} from '../../../_lib/runtime.js';
import {evaluateEntitlement} from '../../../_lib/entitlement-policy.js';

export async function onRequest(context){
  const {request,env}=context;
  try{
    if(request.method.toUpperCase()!=='POST')return context.next();
    const session=await resolveSession(request,env,{required:true});
    await enforceRateLimit(env,`user:${session.user.id}:entitlements/evaluate`,{limit:90});
    await requireCsrf(request);
    const body=await jsonBody(request);
    return responseJson(request,env,{...evaluateEntitlement(body),providerId:String(body.providerId||''),capability:String(body.capability||''),use:String(body.use||''),evaluatedAt:new Date().toISOString(),execution:false},200,{cookies:session.cookies,cache:'private, no-store'});
  }catch(error){return errorResponse(request,env,error);}
}
