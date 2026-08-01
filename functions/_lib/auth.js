import {CSRF_COOKIE,HttpError,bootstrapContext,cleanText,cookie,clearSessionCookies,enforceRateLimit,hashKey,jsonBody,parseCookies,publicRuntimeConfig,randomToken,refreshSession,requireCsrf,responseJson,resolveSession,safeEmail,strongPassword,supabaseRequest,tokenCookies,verifyAccess} from './runtime.js';

export async function handleAuth(context,path,method){
  const {request,env}=context;
  if(path==='auth/register'&&method==='POST'){
    const body=await jsonBody(request),email=safeEmail(body.email),password=strongPassword(body.password);await enforceRateLimit(env,`auth-register:${await hashKey(email)}`);
    const config=publicRuntimeConfig(env,request.url),redirect=`${config.publicSiteUrl}/auth/callback.html`,payload=await supabaseRequest(env,`/auth/v1/signup?redirect_to=${encodeURIComponent(redirect)}`,{method:'POST',body:{email,password,data:{display_name:cleanText(body.displayName,80),organization_name:cleanText(body.organizationName,100),workspace_name:cleanText(body.workspaceName||body.organizationName||'My Qelly Workspace',100),base_currency:cleanText(body.baseCurrency||'USD',8),timezone:cleanText(body.timezone||'Asia/Kolkata',64)}}});
    const providerSession=payload?.session||payload,hasSession=Boolean(providerSession?.access_token&&providerSession?.refresh_token);let qelly=null;
    if(hasSession){const verified=await verifyAccess(env,providerSession.access_token);qelly=await bootstrapContext(env,{...verified,accessToken:providerSession.access_token,refreshToken:providerSession.refresh_token});}
    return responseJson(request,env,{accepted:true,verificationRequired:!hasSession,user:payload?.user?{id:payload.user.id,email:payload.user.email}:null,context:qelly},hasSession?201:202,{cookies:hasSession?tokenCookies(providerSession):[]});
  }
  if(path==='auth/login'&&method==='POST'){
    const body=await jsonBody(request),email=safeEmail(body.email),password=String(body.password||'');await enforceRateLimit(env,`auth-login:${await hashKey(email)}`);
    const providerSession=await supabaseRequest(env,'/auth/v1/token?grant_type=password',{method:'POST',body:{email,password}});
    if(!providerSession?.access_token||!providerSession?.refresh_token)throw new HttpError(401,'login_failed','Login failed');
    const verified=await verifyAccess(env,providerSession.access_token),qelly=await bootstrapContext(env,{...verified,accessToken:providerSession.access_token,refreshToken:providerSession.refresh_token});
    return responseJson(request,env,{authenticated:true,context:qelly},200,{cookies:tokenCookies(providerSession)});
  }
  if(path==='auth/session'&&method==='POST'){
    const body=await jsonBody(request),accessToken=String(body.accessToken||body.access_token||''),refreshToken=String(body.refreshToken||body.refresh_token||'');
    if(!accessToken||!refreshToken)throw new HttpError(400,'session_tokens_required','Auth callback session tokens are required');
    const verified=await verifyAccess(env,accessToken),qelly=await bootstrapContext(env,{...verified,accessToken,refreshToken}),csrf=randomToken();
    return responseJson(request,env,{authenticated:true,context:qelly,flow:cleanText(body.type||'callback',32),csrf:{header:'X-Qelly-CSRF',token:csrf}},200,{cookies:[...tokenCookies({access_token:accessToken,refresh_token:refreshToken,expires_in:Number(body.expiresIn||body.expires_in)||3600}),cookie(CSRF_COOKIE,csrf,{httpOnly:false,maxAge:60*60*8,sameSite:'Strict'})]});
  }
  if(path==='auth/status'&&method==='GET'){
    const session=await resolveSession(request,env);return session?responseJson(request,env,{authenticated:true,context:await bootstrapContext(env,session)},200,{cookies:session.cookies}):responseJson(request,env,{authenticated:false,context:null});
  }
  if(path==='auth/refresh'&&method==='POST'){
    await requireCsrf(request);const providerSession=await refreshSession(env,parseCookies(request).qelly_sb_refresh),verified=await verifyAccess(env,providerSession.access_token);
    return responseJson(request,env,{authenticated:true,context:await bootstrapContext(env,{...verified,accessToken:providerSession.access_token,refreshToken:providerSession.refresh_token})},200,{cookies:tokenCookies(providerSession)});
  }
  if(path==='auth/logout'&&method==='POST'){
    await requireCsrf(request);const session=await resolveSession(request,env);if(session)await supabaseRequest(env,'/auth/v1/logout',{method:'POST',token:session.accessToken,body:{scope:'local'}}).catch(()=>null);
    return responseJson(request,env,{loggedOut:true},200,{cookies:clearSessionCookies()});
  }
  if(path==='auth/recovery/request'&&method==='POST'){
    const body=await jsonBody(request),email=safeEmail(body.email);await enforceRateLimit(env,`auth-recovery:${await hashKey(email)}`);
    const redirect=`${publicRuntimeConfig(env,request.url).publicSiteUrl}/auth/callback.html?flow=recovery`;
    await supabaseRequest(env,`/auth/v1/recover?redirect_to=${encodeURIComponent(redirect)}`,{method:'POST',body:{email}});
    return responseJson(request,env,{accepted:true});
  }
  if(path==='auth/recovery/status'&&method==='GET'){const session=await resolveSession(request,env);return responseJson(request,env,{recoverySession:Boolean(session),authenticated:Boolean(session)});}
  if(path==='auth/recovery/reset'&&method==='POST'){
    await requireCsrf(request);const session=await resolveSession(request,env,{required:true}),body=await jsonBody(request),password=strongPassword(body.newPassword||body.password);
    await supabaseRequest(env,'/auth/v1/user',{method:'PUT',token:session.accessToken,body:{password}});
    await supabaseRequest(env,'/auth/v1/logout',{method:'POST',token:session.accessToken,body:{scope:'global'}}).catch(()=>null);
    return responseJson(request,env,{updated:true,revokedSessions:1},200,{cookies:clearSessionCookies()});
  }
  return null;
}
