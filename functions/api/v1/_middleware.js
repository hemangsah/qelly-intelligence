import {
  HttpError,
  bootstrapContext,
  correlationId,
  enforceRateLimit,
  errorResponse,
  requireOrigin,
  resolveSession,
  responseJson
} from '../../_lib/runtime.js';
import {effectivePublicRuntimeConfig} from '../../_lib/email-capability.js';
import {handleGovernance} from '../../_lib/governance.js';
import {safeBaseCurrency,safeTimezone} from '../../_lib/profile-preferences.js';
import {collectReadinessEvidence,readinessSnapshot} from '../../_lib/readiness.js';

const pathFor=(request)=>new URL(request.url).pathname.replace(/^\/api\/v1\/?/,'').replace(/\/$/,'');
const unsafeMethod=(method)=>!['GET','HEAD','OPTIONS'].includes(String(method||'').toUpperCase());
const authMutationRoute=(path,method)=>path.startsWith('auth/')&&unsafeMethod(method);
const governanceRoute=(path,method)=>method==='POST'&&(path==='cloud/opt-in'||path==='account/delete');
const registrationRoute=(path,method)=>path==='auth/register'&&method==='POST';

export async function onRequest(context){
  const {request,env}=context;
  const path=pathFor(request);
  const method=request.method.toUpperCase();
  const interceptReadiness=path==='readiness'&&method==='GET';
  const interceptGovernance=governanceRoute(path,method);
  const interceptRegistration=registrationRoute(path,method);
  const interceptAuthMutation=authMutationRoute(path,method);
  if(!interceptReadiness&&!interceptGovernance&&!interceptRegistration&&!interceptAuthMutation)return context.next();

  const started=Date.now();
  let response;
  try{
    // Unsafe browser mutations must carry an allowed Origin. requireOrigin is a no-op
    // for GET/HEAD/OPTIONS, so readiness remains unaffected while exact nested Auth
    // functions (register/recovery) cannot bypass the catch-all CSRF boundary.
    requireOrigin(request,env);
    if(interceptReadiness){
      const runtime=effectivePublicRuntimeConfig(env,request.url);
      const evidence=await collectReadinessEvidence(context,runtime);
      const snapshot=readinessSnapshot(runtime,evidence);
      response=responseJson(request,env,snapshot,snapshot.ready?200:503);
      return response;
    }

    if(interceptRegistration){
      const runtime=effectivePublicRuntimeConfig(env,request.url);
      if(runtime.capabilities.emailDelivery){
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

    if(interceptAuthMutation){
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

export const __middlewareTest=Object.freeze({pathFor,unsafeMethod,authMutationRoute,governanceRoute,registrationRoute,readinessSnapshot});
