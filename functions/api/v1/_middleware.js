import {
  HttpError,
  bootstrapContext,
  correlationId,
  enforceRateLimit,
  errorResponse,
  requireOrigin,
  resolveSession
} from '../../_lib/runtime.js';
import {effectivePublicRuntimeConfig} from '../../_lib/email-capability.js';
import {handleGovernance} from '../../_lib/governance.js';
import {safeBaseCurrency,safeTimezone} from '../../_lib/profile-preferences.js';

const GITHUB_PUBLIC_MIRROR_ORIGIN='https://hemangsah.github.io';
const pathFor=(request)=>new URL(request.url).pathname.replace(/^\/api\/v1\/?/,'').replace(/\/$/,'');
const unsafeMethod=(method)=>!['GET','HEAD','OPTIONS'].includes(String(method||'').toUpperCase());
const authMutationRoute=(path,method)=>path.startsWith('auth/')&&unsafeMethod(method);
const governanceRoute=(path,method)=>method==='POST'&&(path==='cloud/opt-in'||path==='account/delete');
const registrationRoute=(path,method)=>path==='auth/register'&&method==='POST';
const mirrorRequest=(request)=>request.headers.get('origin')===GITHUB_PUBLIC_MIRROR_ORIGIN;
const mirrorSafeMethod=(method)=>['GET','HEAD','OPTIONS'].includes(String(method||'').toUpperCase());
const mirrorCorsHeaders=()=>({
  'Access-Control-Allow-Origin':GITHUB_PUBLIC_MIRROR_ORIGIN,
  'Access-Control-Allow-Credentials':'true',
  'Access-Control-Allow-Methods':'GET,HEAD,OPTIONS',
  'Access-Control-Allow-Headers':'Content-Type,X-Correlation-Id',
  'Access-Control-Max-Age':'600',
  'Cross-Origin-Resource-Policy':'cross-origin',
  'Vary':'Origin'
});
const withoutOrigin=(request)=>{
  const headers=new Headers(request.headers);
  headers.delete('origin');
  return new Request(request,{headers});
};
const withMirrorCors=(response)=>{
  const headers=new Headers(response.headers);
  for(const [key,value] of Object.entries(mirrorCorsHeaders()))headers.set(key,value);
  return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
};

export async function onRequest(context){
  const {request,env}=context;
  const path=pathFor(request);
  const method=request.method.toUpperCase();

  // GitHub Pages is a public, read-only mirror. It may read the canonical
  // Cloudflare API but never becomes a trusted mutation origin. Stripping
  // Origin before downstream public GET handling avoids broadening the core
  // write allowlist; response CORS is added only on the way back to the mirror.
  if(mirrorRequest(request)){
    if(!mirrorSafeMethod(method)){
      return errorResponse(request,env,new HttpError(403,'github_mirror_read_only','GitHub Pages is a read-only public mirror. Sign in and private workspace changes must use the canonical Cloudflare terminal.'));
    }
    if(method==='OPTIONS')return new Response(null,{status:204,headers:mirrorCorsHeaders()});
    const response=await context.next(withoutOrigin(request));
    return withMirrorCors(response);
  }

  const interceptGovernance=governanceRoute(path,method);
  const interceptRegistration=registrationRoute(path,method);
  const interceptAuthMutation=authMutationRoute(path,method);
  if(!interceptGovernance&&!interceptRegistration&&!interceptAuthMutation)return context.next();

  const started=Date.now();
  let response;
  try{
    // Unsafe browser mutations must carry an allowed Origin. Operational GET routes,
    // including /readiness, are owned by their dedicated Pages Functions and pass
    // through this middleware without being shadowed here.
    requireOrigin(request,env);

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

export const __middlewareTest=Object.freeze({
  GITHUB_PUBLIC_MIRROR_ORIGIN,
  pathFor,
  unsafeMethod,
  authMutationRoute,
  governanceRoute,
  registrationRoute,
  mirrorRequest,
  mirrorSafeMethod,
  mirrorCorsHeaders
});
