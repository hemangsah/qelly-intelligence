import {CSRF_COOKIE,cookie,errorResponse,parseCookies,resolveSession,responseJson} from '../../_lib/runtime.js';
import {buildPublicConfigPayload} from '../../_lib/config-payload.js';

export async function onRequest(context){
  const {request,env}=context;
  try{
    if(request.method.toUpperCase()!=='GET')return context.next();
    const session=await resolveSession(request,env);
    const csrf=parseCookies(request)[CSRF_COOKIE]||crypto.randomUUID().replaceAll('-','');
    const authenticated=Boolean(session);
    return responseJson(request,env,buildPublicConfigPayload(env,request.url,session,csrf),200,{
      cookies:[...(session?.cookies||[]),...(authenticated?[cookie(CSRF_COOKIE,csrf,{httpOnly:false,maxAge:60*60*8,sameSite:'Strict'})]:[])]
    });
  }catch(error){return errorResponse(request,env,error);}
}
