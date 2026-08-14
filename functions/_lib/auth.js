import {
  CSRF_COOKIE,
  HttpError,
  bootstrapContext,
  cleanText,
  cookie,
  clearSessionCookies,
  enforceRateLimit,
  hashKey,
  jsonBody,
  parseCookies,
  publicRuntimeConfig,
  randomToken,
  refreshSession,
  requireCsrf,
  responseJson,
  resolveSession,
  safeEmail,
  strongPassword,
  supabaseRequest,
  tokenCookies,
  verifyAccess
} from './runtime.js';
import {handleGovernance} from './governance.js';

const AUTH_TRANSACTION_COOKIE='qelly_auth_transaction';
const AUTH_TRANSACTION_TTL_MS=60*60*1000;
const AUTH_FLOWS=new Set(['signup','recovery']);

const base64UrlEncode=(value)=>{
  const bytes=new TextEncoder().encode(JSON.stringify(value));
  let binary='';
  for(const byte of bytes)binary+=String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
};

const base64UrlDecode=(value)=>{
  try{
    const normalized=String(value||'').replace(/-/g,'+').replace(/_/g,'/');
    const binary=atob(normalized.padEnd(Math.ceil(normalized.length/4)*4,'='));
    const bytes=Uint8Array.from(binary,character=>character.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes));
  }catch{
    throw new HttpError(400,'auth_transaction_invalid','Authentication transaction is invalid or expired');
  }
};

const base64UrlBytes=(bytes)=>{
  let binary='';
  for(const byte of bytes)binary+=String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
};

const constantTimeEqual=async(leftValue,rightValue)=>{
  const [leftHash,rightHash]=await Promise.all([
    crypto.subtle.digest('SHA-256',new TextEncoder().encode(String(leftValue||''))),
    crypto.subtle.digest('SHA-256',new TextEncoder().encode(String(rightValue||'')))
  ]);
  const left=new Uint8Array(leftHash);
  const right=new Uint8Array(rightHash);
  let difference=left.length^right.length;
  for(let index=0;index<Math.min(left.length,right.length);index++)difference|=left[index]^right[index];
  return difference===0;
};

const issueAuthTransaction=async(flow)=>{
  if(!AUTH_FLOWS.has(flow))throw new HttpError(400,'auth_flow_invalid','Authentication flow is invalid');
  const verifier=randomToken();
  const challenge=base64UrlBytes(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier))));
  const transaction={
    version:1,
    flow,
    state:randomToken(),
    nonce:randomToken(),
    verifier,
    issuedAt:Date.now()
  };
  return {
    ...transaction,
    challenge,
    cookie:cookie(AUTH_TRANSACTION_COOKIE,base64UrlEncode(transaction),{
      maxAge:AUTH_TRANSACTION_TTL_MS/1000,
      sameSite:'Lax'
    })
  };
};

const clearAuthTransactionCookie=()=>cookie(AUTH_TRANSACTION_COOKIE,'',{maxAge:0,sameSite:'Lax'});

const callbackRedirect=(config,transaction)=>{
  const redirect=new URL('/auth/callback.html',`${config.publicSiteUrl}/`);
  redirect.searchParams.set('flow',transaction.flow);
  redirect.searchParams.set('state',transaction.state);
  redirect.searchParams.set('nonce',transaction.nonce);
  return redirect.toString();
};

const readAuthTransaction=(request)=>{
  const encoded=parseCookies(request)[AUTH_TRANSACTION_COOKIE];
  if(!encoded)throw new HttpError(400,'auth_transaction_missing','Authentication transaction is missing or expired');
  const transaction=base64UrlDecode(encoded);
  if(
    transaction?.version!==1||
    !AUTH_FLOWS.has(transaction?.flow)||
    !/^[0-9a-f]{64}$/i.test(String(transaction?.state||''))||
    !/^[0-9a-f]{64}$/i.test(String(transaction?.nonce||''))||
    !/^[0-9a-f]{64}$/i.test(String(transaction?.verifier||''))||
    !Number.isFinite(Number(transaction?.issuedAt))||
    Date.now()-Number(transaction.issuedAt)>AUTH_TRANSACTION_TTL_MS||
    Number(transaction.issuedAt)>Date.now()+30_000
  )throw new HttpError(400,'auth_transaction_invalid','Authentication transaction is invalid or expired');
  return transaction;
};

const validateCallback=async(request,body)=>{
  const transaction=readAuthTransaction(request);
  const code=cleanText(body.code,1024);
  const flow=cleanText(body.flow,32);
  const state=cleanText(body.state,128);
  const nonce=cleanText(body.nonce,128);
  if(!code)throw new HttpError(400,'auth_code_required','Authentication code is required');
  if(
    !AUTH_FLOWS.has(flow)||
    flow!==transaction.flow||
    !(await constantTimeEqual(state,transaction.state))||
    !(await constantTimeEqual(nonce,transaction.nonce))
  )throw new HttpError(400,'auth_transaction_mismatch','Authentication transaction proof did not match');
  return {...transaction,code};
};

export async function handleAuth(context,path,method){
  const {request,env}=context;

  if(path==='auth/register'&&method==='POST'){
    const body=await jsonBody(request);
    const email=safeEmail(body.email);
    const password=strongPassword(body.password);
    await enforceRateLimit(env,`auth-register:${await hashKey(email)}`);
    const transaction=await issueAuthTransaction('signup');
    const config=publicRuntimeConfig(env,request.url);
    const redirect=callbackRedirect(config,transaction);
    const payload=await supabaseRequest(env,`/auth/v1/signup?redirect_to=${encodeURIComponent(redirect)}`,{
      method:'POST',
      body:{
        email,
        password,
        data:{
          display_name:cleanText(body.displayName,80),
          organization_name:cleanText(body.organizationName,100),
          workspace_name:cleanText(body.workspaceName||body.organizationName||'My Qelly Workspace',100),
          base_currency:cleanText(body.baseCurrency||'USD',8),
          timezone:cleanText(body.timezone||'Asia/Kolkata',64)
        },
        code_challenge:transaction.challenge,
        code_challenge_method:'s256'
      }
    });
    const providerSession=payload?.session||payload;
    const hasSession=Boolean(providerSession?.access_token&&providerSession?.refresh_token);
    let qelly=null;
    if(hasSession){
      const verified=await verifyAccess(env,providerSession.access_token);
      qelly=await bootstrapContext(env,{...verified,accessToken:providerSession.access_token,refreshToken:providerSession.refresh_token});
    }
    return responseJson(request,env,{
      accepted:true,
      verificationRequired:!hasSession,
      user:payload?.user?{id:payload.user.id,email:payload.user.email}:null,
      context:qelly,
      callbackMode:'pkce-code'
    },hasSession?201:202,{
      cookies:hasSession
        ?[...tokenCookies(providerSession),clearAuthTransactionCookie()]
        :[transaction.cookie]
    });
  }

  if(path==='auth/login'&&method==='POST'){
    const body=await jsonBody(request);
    const email=safeEmail(body.email);
    const password=String(body.password||'');
    await enforceRateLimit(env,`auth-login:${await hashKey(email)}`);
    const providerSession=await supabaseRequest(env,'/auth/v1/token?grant_type=password',{method:'POST',body:{email,password}});
    if(!providerSession?.access_token||!providerSession?.refresh_token)throw new HttpError(401,'login_failed','Login failed');
    const verified=await verifyAccess(env,providerSession.access_token);
    const qelly=await bootstrapContext(env,{...verified,accessToken:providerSession.access_token,refreshToken:providerSession.refresh_token});
    return responseJson(request,env,{authenticated:true,context:qelly},200,{cookies:tokenCookies(providerSession)});
  }

  if(path==='auth/callback'&&method==='POST'){
    const body=await jsonBody(request,20_000);
    const transaction=await validateCallback(request,body);
    const providerSession=await supabaseRequest(env,'/auth/v1/token?grant_type=pkce',{
      method:'POST',
      body:{auth_code:transaction.code,code_verifier:transaction.verifier}
    });
    if(!providerSession?.access_token||!providerSession?.refresh_token)throw new HttpError(401,'auth_code_exchange_failed','Authentication code exchange failed');
    const verified=await verifyAccess(env,providerSession.access_token);
    const qelly=await bootstrapContext(env,{...verified,accessToken:providerSession.access_token,refreshToken:providerSession.refresh_token});
    const csrf=randomToken();
    return responseJson(request,env,{
      authenticated:true,
      context:qelly,
      flow:transaction.flow,
      csrf:{header:'X-Qelly-CSRF',token:csrf}
    },200,{
      cookies:[
        ...tokenCookies(providerSession),
        cookie(CSRF_COOKIE,csrf,{httpOnly:false,maxAge:60*60*8,sameSite:'Strict'}),
        clearAuthTransactionCookie()
      ]
    });
  }

  if(path==='auth/session'&&method==='POST'){
    throw new HttpError(410,'implicit_callback_disabled','Token-fragment callbacks are disabled; restart email verification or password recovery');
  }

  if(path==='auth/status'&&method==='GET'){
    const session=await resolveSession(request,env);
    return session
      ?responseJson(request,env,{authenticated:true,context:await bootstrapContext(env,session)},200,{cookies:session.cookies})
      :responseJson(request,env,{authenticated:false,context:null});
  }

  if(path==='auth/refresh'&&method==='POST'){
    await requireCsrf(request);
    const providerSession=await refreshSession(env,parseCookies(request).qelly_sb_refresh);
    const verified=await verifyAccess(env,providerSession.access_token);
    return responseJson(request,env,{
      authenticated:true,
      context:await bootstrapContext(env,{...verified,accessToken:providerSession.access_token,refreshToken:providerSession.refresh_token})
    },200,{cookies:tokenCookies(providerSession)});
  }

  if(path==='auth/logout'&&method==='POST'){
    await requireCsrf(request);
    const session=await resolveSession(request,env);
    if(session)await supabaseRequest(env,'/auth/v1/logout',{method:'POST',token:session.accessToken,body:{scope:'local'}}).catch(()=>null);
    return responseJson(request,env,{loggedOut:true},200,{cookies:clearSessionCookies()});
  }

  if(path==='auth/recovery/request'&&method==='POST'){
    const body=await jsonBody(request);
    const email=safeEmail(body.email);
    await enforceRateLimit(env,`auth-recovery:${await hashKey(email)}`);
    const transaction=await issueAuthTransaction('recovery');
    const redirect=callbackRedirect(publicRuntimeConfig(env,request.url),transaction);
    await supabaseRequest(env,`/auth/v1/recover?redirect_to=${encodeURIComponent(redirect)}`,{
      method:'POST',
      body:{
        email,
        code_challenge:transaction.challenge,
        code_challenge_method:'s256'
      }
    });
    return responseJson(request,env,{accepted:true,callbackMode:'pkce-code'},200,{cookies:[transaction.cookie]});
  }

  if(path==='auth/recovery/status'&&method==='GET'){
    const session=await resolveSession(request,env);
    return responseJson(request,env,{recoverySession:Boolean(session),authenticated:Boolean(session)});
  }

  if(path==='auth/recovery/reset'&&method==='POST'){
    await requireCsrf(request);
    const session=await resolveSession(request,env,{required:true});
    const body=await jsonBody(request);
    const password=strongPassword(body.newPassword||body.password);
    await supabaseRequest(env,'/auth/v1/user',{method:'PUT',token:session.accessToken,body:{password}});
    await supabaseRequest(env,'/auth/v1/logout',{method:'POST',token:session.accessToken,body:{scope:'global'}}).catch(()=>null);
    return responseJson(request,env,{updated:true,revokedSessions:1},200,{cookies:clearSessionCookies()});
  }

  if((path==='cloud/opt-in'||path==='account/delete')&&method==='POST'){
    const session=await resolveSession(request,env,{required:true});
    await enforceRateLimit(env,`user:${session.user.id}:${path}`);
    const qelly=await bootstrapContext(env,session);
    return handleGovernance(context,path,method,session,qelly);
  }

  return null;
}

export const __authTest=Object.freeze({
  AUTH_TRANSACTION_COOKIE,
  AUTH_TRANSACTION_TTL_MS,
  issueAuthTransaction,
  readAuthTransaction,
  validateCallback,
  callbackRedirect
});
