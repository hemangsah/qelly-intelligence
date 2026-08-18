import {CSRF_COOKIE,bootstrapContext,cookie,enforceRateLimit,errorResponse,parseCookies,resolveSession,responseJson} from '../../_lib/runtime.js';
import {buildPublicConfigPayload} from '../../_lib/config-payload.js';
import {readUiPreferenceRow,uiPreferencesEnvelope} from '../../_lib/ui-preferences.js';

export async function onRequest(context){
  const {request,env}=context;
  try{
    if(request.method.toUpperCase()!=='GET')return context.next();
    const session=await resolveSession(request,env);
    const rateKey=session
      ?`user:${session.user.id}:bootstrap`
      :`public-bootstrap:${request.headers.get('CF-Connecting-IP')||'unknown'}`;
    await enforceRateLimit(env,rateKey,{limit:60});

    const csrf=parseCookies(request)[CSRF_COOKIE]||crypto.randomUUID().replaceAll('-','');
    let qelly=null;
    let preferences=null;
    if(session){
      qelly=await bootstrapContext(env,session);
      const preferenceRow=await readUiPreferenceRow(env,session,qelly.workspace.workspaceId);
      preferences=uiPreferencesEnvelope(preferenceRow);
    }

    const authenticated=Boolean(session);
    return responseJson(request,env,{
      schemaVersion:1,
      generatedAt:new Date().toISOString(),
      config:buildPublicConfigPayload(env,request.url,session,csrf),
      context:qelly,
      preferences
    },200,{
      cookies:[...(session?.cookies||[]),...(authenticated?[cookie(CSRF_COOKIE,csrf,{httpOnly:false,maxAge:60*60*8,sameSite:'Strict'})]:[])],
      cache:'no-store'
    });
  }catch(error){return errorResponse(request,env,error);}
}
