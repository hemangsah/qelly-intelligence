import {
  HttpError,
  bootstrapContext,
  correlationId,
  enforceRateLimit,
  errorResponse,
  publicRuntimeConfig,
  requireOrigin,
  resolveSession,
  responseJson
} from '../../_lib/runtime.js';
import {handleGovernance} from '../../_lib/governance.js';
import {safeBaseCurrency,safeTimezone} from '../../_lib/profile-preferences.js';
import {readinessSnapshot} from '../../_lib/readiness.js';

const pathFor=(request)=>new URL(request.url).pathname.replace(/^\/api\/v1\/?/,'').replace(/\/$/,'');
const governanceRoute=(path,method)=>method==='POST'&&(path==='cloud/opt-in'||path==='account/delete');
const transactionalEmailRoute=(path,method)=>method==='POST'&&(path==='auth/register'||path==='auth/recovery/request');

export async function onRequest(context){
  const {request,env}=context;
  const path=pathFor(request);
  const method=request.method.toUpperCase();
  const interceptReadiness=path==='readiness'&&method==='GET';
  const interceptGovernance=governanceRoute(path,method);
  const interceptEmail=transactionalEmailRoute(path,method);
  if(!interceptReadiness&&!interceptGovernance&&!interceptEmail)return context.next();

  const started=Date.now();
  let response;
  try{
    if(request.headers.get('origin'))requireOrigin(request,env);
    const runtime=publicRuntimeConfig(env,request.url);
    if(interceptReadiness){
      response=responseJson(request,env,readinessSnapshot(runtime),503);
      return response;
    }

    if(interceptEmail){
      if(!runtime.capabilities.emailDelivery){
        throw new HttpError(503,'email_delivery_unavailable','Registration and recovery are unavailable until transactional email delivery passes the production canary',{retryable:false});
      }
      if(path==='auth/register'){
        const body=await request.clone().json().catch(()=>{throw new HttpError(400,'invalid_json','Request body must be valid JSON');});
        if(!body?.baseCurrency||!body?.timezone){
          throw new HttpError(400,'profile_preferences_required','Base currency and timezone are required');
        }
        safeBaseCurrency(body.baseCurrency);
        safeTimezone(body.timezone);
      }
      response=await context.next();
      return response;
    }

    const session=await resolveSession(request,env,{required:true});
    await enforceRateLimit(env,`user:${session.user.id}:${path}`);
    const qelly=await bootstrapContext(env,session);
    response=await handleGovernance(context,path,method,session,qelly);
    if(response)return response;
    response=await context.next();
    return response;
  }catch(error){
    response=errorResponse(request,env,error);
    return response;
  }finally{
    try{
      console.log(JSON.stringify({
        event:'qelly_api_v1_middleware_request',
        correlationId:correlationId(request),
        method,
        path:new URL(request.url).pathname,
        status:response?.status??500,
        durationMs:Date.now()-started,
        bodyLogged:false
      }));
    }catch{}
  }
}

export const __middlewareTest=Object.freeze({pathFor,governanceRoute,transactionalEmailRoute,readinessSnapshot});
