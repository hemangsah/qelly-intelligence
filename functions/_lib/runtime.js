export const ACCESS_COOKIE='qelly_sb_access';
export const REFRESH_COOKIE='qelly_sb_refresh';
export const CSRF_COOKIE='qelly_csrf';
export const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const REQUEST_STATE=new WeakMap();

export const SECURITY_HEADERS=Object.freeze({
  'Content-Security-Policy':"default-src 'self'; base-uri 'none'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data: blob:; connect-src 'self'; worker-src 'self' blob:; manifest-src 'self'; upgrade-insecure-requests",
  'Referrer-Policy':'strict-origin-when-cross-origin',
  'Permissions-Policy':'camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()',
  'X-Content-Type-Options':'nosniff',
  'X-Frame-Options':'DENY',
  'Cross-Origin-Opener-Policy':'same-origin',
  'Cross-Origin-Resource-Policy':'same-origin',
  'Strict-Transport-Security':'max-age=31536000; includeSubDomains; preload'
});

export class HttpError extends Error{
  constructor(status,code,message,{details=null,retryable=false}={}){
    super(message);
    this.status=status;
    this.code=code;
    this.details=details;
    this.retryable=retryable;
  }
}

export const bool=(value,fallback=false)=>value==null||value===''?fallback:/^(1|true|yes|on)$/i.test(String(value));
export const cleanText=(value,max=160)=>String(value??'').trim().slice(0,max);
export const safeEmail=(value)=>{
  const email=String(value||'').trim().toLowerCase();
  if(email.length>254||!EMAIL.test(email))throw new HttpError(400,'invalid_email','Enter a valid email address');
  return email;
};
export const strongPassword=(value)=>{
  const password=String(value||'');
  if(password.length<12||password.length>256||!/[a-z]/.test(password)||!/[A-Z]/.test(password)||!/[0-9]/.test(password)||!/[\W_]/.test(password))throw new HttpError(400,'weak_password','Password must contain 12+ characters with upper, lower, number and symbol');
  return password;
};
export const fetcher=(env)=>typeof env.__fetch==='function'?env.__fetch:globalThis.fetch;

const safeUrl=(value,name)=>{
  let url;
  try{url=new URL(String(value||''));}catch{throw new HttpError(503,'runtime_configuration_invalid',`${name} is not configured`);}
  if(url.protocol!=='https:'||url.username||url.password)throw new HttpError(503,'runtime_configuration_invalid',`${name} must be a safe HTTPS URL`);
  return url.toString().replace(/\/$/,'');
};

export function publicRuntimeConfig(env,requestUrl='https://qelly.invalid/'){
  const publicSiteUrl=safeUrl(env.QELLY_PUBLIC_SITE_URL||new URL(requestUrl).origin,'QELLY_PUBLIC_SITE_URL');
  const supabaseUrl=safeUrl(env.QELLY_PUBLIC_SUPABASE_URL,'QELLY_PUBLIC_SUPABASE_URL');
  const supabasePublishableKey=String(env.QELLY_PUBLIC_SUPABASE_PUBLISHABLE_KEY||env.QELLY_PUBLIC_SUPABASE_ANON_KEY||'');
  if(supabasePublishableKey.length<20)throw new HttpError(503,'runtime_configuration_invalid','Supabase publishable key is not configured');
  return Object.freeze({
    schemaVersion:1,
    environment:String(env.QELLY_DEPLOYMENT_ENVIRONMENT||'cloudflare-pages-production'),
    releaseSha:String(env.QELLY_PUBLIC_RELEASE_SHA||env.CF_PAGES_COMMIT_SHA||'unresolved'),
    publicSiteUrl,
    supabaseUrl,
    supabasePublishableKey,
    productMode:'QELLY GLOBAL PUBLIC BETA',
    supportUrl:`${publicSiteUrl}/support.html`,
    legal:Object.freeze({
      beta:`${publicSiteUrl}/legal/beta.html`,
      risk:`${publicSiteUrl}/legal/risk.html`,
      privacy:`${publicSiteUrl}/legal/privacy.html`,
      terms:`${publicSiteUrl}/legal/terms.html`
    }),
    capabilities:Object.freeze({
      authentication:bool(env.QELLY_ENABLE_AUTH,true),
      emailDelivery:bool(env.QELLY_ENABLE_AUTH_EMAIL_DELIVERY,false),
      cloudSync:bool(env.QELLY_ENABLE_CLOUD_SYNC,true),
      liveProviders:bool(env.QELLY_ENABLE_LIVE_PROVIDERS,true),
      protectedWrites:bool(env.QELLY_ENABLE_FEEDBACK_WRITES,true),
      deterministicLocal:true
    }),
    buildTimestamp:String(env.QELLY_BUILD_TIMESTAMP||new Date().toISOString())
  });
}

const requestState=(request)=>{
  let state=REQUEST_STATE.get(request);
  if(!state){
    state={correlationId:null,cookies:new Map()};
    REQUEST_STATE.set(request,state);
  }
  return state;
};

export const correlationId=(request)=>{
  const state=requestState(request);
  if(!state.correlationId)state.correlationId=cleanText(request.headers.get('x-correlation-id')||crypto.randomUUID(),128);
  return state.correlationId;
};

const responseCookieName=(value)=>String(value||'').split('=',1)[0].trim();
const queueResponseCookies=(request,values=[])=>{
  const state=requestState(request);
  for(const value of values){
    const name=responseCookieName(value);
    if(name)state.cookies.set(name,value);
  }
};
const consumeResponseCookies=(request,explicit=[])=>{
  const state=requestState(request);
  for(const value of explicit){
    const name=responseCookieName(value);
    if(name)state.cookies.set(name,value);
  }
  const values=[...state.cookies.values()];
  state.cookies.clear();
  return values;
};

const decodeCookieValue=(value)=>{
  try{return decodeURIComponent(value);}catch{return '';}
};
export const parseCookies=(request)=>Object.fromEntries(String(request.headers.get('cookie')||'').split(';').map(value=>value.trim()).filter(Boolean).map(part=>{
  const index=part.indexOf('=');
  return index<0?[part,'']:[part.slice(0,index),decodeCookieValue(part.slice(index+1))];
}));

export const cookie=(name,value,{httpOnly=true,maxAge=3600,sameSite='Lax'}={})=>`${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${Math.max(0,Math.floor(maxAge))}; Secure; SameSite=${sameSite}${httpOnly?'; HttpOnly':''}`;
export const clearCookie=(name,{httpOnly=true}={})=>cookie(name,'',{httpOnly,maxAge:0});
export const clearSessionCookies=()=>[clearCookie(ACCESS_COOKIE),clearCookie(REFRESH_COOKIE),clearCookie(CSRF_COOKIE,{httpOnly:false})];
export const tokenCookies=(session)=>{
  const expires=Math.max(60,Number(session.expires_in)||3600);
  return [cookie(ACCESS_COOKIE,session.access_token,{maxAge:expires}),cookie(REFRESH_COOKIE,session.refresh_token,{maxAge:60*60*24*30})];
};
export const randomToken=()=>{
  const bytes=new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes,byte=>byte.toString(16).padStart(2,'0')).join('');
};

const configuredOrigins=(env)=>{
  const origins=new Set();
  for(const value of [env.QELLY_PUBLIC_SITE_URL,...String(env.QELLY_ALLOWED_ORIGINS||'').split(',')]){
    try{
      const url=new URL(String(value||'').trim());
      if(url.protocol==='https:'&&!url.username&&!url.password)origins.add(url.origin);
    }catch{}
  }
  return origins;
};
const allowedOrigins=(request,env)=>{
  const origins=configuredOrigins(env);
  if(!origins.size)throw new HttpError(503,'runtime_configuration_invalid','No trusted public origin is configured');
  return origins;
};
export const corsHeaders=(request,env)=>{
  const origin=request.headers.get('origin');
  if(!origin)return {};
  if(!allowedOrigins(request,env).has(origin))throw new HttpError(403,'cors_origin_forbidden','Cross-origin request origin is not allowlisted');
  return {'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Credentials':'true','Vary':'Origin'};
};
export const requireOrigin=(request,env)=>{
  if(['GET','HEAD','OPTIONS'].includes(request.method))return;
  const origin=request.headers.get('origin');
  if(!origin)throw new HttpError(403,'csrf_origin_required','State-changing requests require an Origin header');
  if(!allowedOrigins(request,env).has(origin))throw new HttpError(403,'csrf_origin_forbidden','Cross-origin state change blocked');
};

const timingSafeEqual=async(a,b)=>{
  const [leftHash,rightHash]=await Promise.all([
    crypto.subtle.digest('SHA-256',new TextEncoder().encode(String(a))),
    crypto.subtle.digest('SHA-256',new TextEncoder().encode(String(b)))
  ]);
  const left=new Uint8Array(leftHash);
  const right=new Uint8Array(rightHash);
  let difference=left.length^right.length;
  for(let index=0;index<Math.min(left.length,right.length);index++)difference|=left[index]^right[index];
  return difference===0;
};
export const requireCsrf=async(request)=>{
  const cookies=parseCookies(request);
  const header=request.headers.get('x-qelly-csrf');
  if(!cookies[CSRF_COOKIE]||!header||!(await timingSafeEqual(cookies[CSRF_COOKIE],header)))throw new HttpError(403,'csrf_invalid','Missing or invalid CSRF proof');
};

export const jsonBody=async(request,limit=1_000_000)=>{
  const length=Number(request.headers.get('content-length'));
  if(Number.isFinite(length)&&length>limit)throw new HttpError(413,'request_too_large','Request body is too large');
  const text=await request.text();
  if(new TextEncoder().encode(text).byteLength>limit)throw new HttpError(413,'request_too_large','Request body is too large');
  if(!text)return {};
  try{return JSON.parse(text);}catch{throw new HttpError(400,'malformed_json','Malformed JSON body');}
};

export const responseJson=(request,env,body,status=200,{cookies=[],cache='no-store'}={})=>{
  const id=correlationId(request);
  const headers=new Headers({...SECURITY_HEADERS,...corsHeaders(request,env),'Content-Type':'application/json; charset=utf-8','Cache-Control':cache,'X-Correlation-Id':id});
  for(const value of consumeResponseCookies(request,cookies))headers.append('Set-Cookie',value);
  return new Response(JSON.stringify(body),{status,headers});
};

export const errorResponse=(request,env,error)=>{
  const failure=error instanceof HttpError?error:new HttpError(500,'internal_error','The request could not be completed');
  const id=correlationId(request);
  const headers=new Headers({...SECURITY_HEADERS,'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Correlation-Id':id});
  const origin=request.headers.get('origin');
  try{
    if(origin&&allowedOrigins(request,env).has(origin)){
      headers.set('Access-Control-Allow-Origin',origin);
      headers.set('Access-Control-Allow-Credentials','true');
      headers.set('Vary','Origin');
    }
  }catch{}
  for(const value of consumeResponseCookies(request))headers.append('Set-Cookie',value);
  return new Response(JSON.stringify({error:{code:failure.code,message:failure.message,details:failure.details,retryable:failure.retryable},correlationId:id,timestamp:new Date().toISOString()}),{status:failure.status||500,headers});
};

export const supabaseRequest=async(env,path,{method='GET',body,token,headers={},timeoutMs=8000}={})=>{
  const config=publicRuntimeConfig(env);
  const key=config.supabasePublishableKey;
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),timeoutMs);
  let response;
  try{
    response=await fetcher(env)(`${config.supabaseUrl}${path}`,{
      method,
      headers:{apikey:key,Authorization:`Bearer ${token||key}`,Accept:'application/json','Content-Type':'application/json',...headers},
      body:body===undefined?undefined:JSON.stringify(body),
      signal:controller.signal
    });
  }catch(error){
    if(error?.name==='AbortError')throw new HttpError(503,'supabase_timeout','Supabase request timed out',{retryable:true});
    throw error;
  }finally{clearTimeout(timeout);}
  const text=await response.text();
  let payload=null;
  if(text){
    try{payload=JSON.parse(text);}catch{payload={message:text.slice(0,500)};}
  }
  if(!response.ok)throw new HttpError(response.status===401?401:response.status===403?403:response.status===429?429:response.status>=500?503:400,payload?.code||payload?.error_code||'supabase_request_failed',payload?.msg||payload?.message||payload?.error_description||payload?.error||`Supabase request failed (${response.status})`,{retryable:response.status===429||response.status>=500});
  return payload;
};

export const restRequest=(env,token,path,{method='GET',body,prefer}={})=>supabaseRequest(env,`/rest/v1/${path}`,{method,body,token,headers:prefer?{Prefer:prefer}:{}});

const decodeJwt=(token)=>{
  const parts=String(token||'').split('.');
  if(parts.length!==3)throw new HttpError(401,'authentication_required','Authentication is required');
  try{return JSON.parse(BufferLike(parts[1]));}catch{throw new HttpError(401,'jwt_invalid','Session token is malformed');}
};
const BufferLike=(value)=>{
  const normalized=String(value).replace(/-/g,'+').replace(/_/g,'/').padEnd(Math.ceil(String(value).length/4)*4,'=');
  return atob(normalized);
};
export const validateJwtClaims=(token,env)=>{
  const claims=decodeJwt(token);
  const config=publicRuntimeConfig(env);
  const audience=Array.isArray(claims.aud)?claims.aud:[claims.aud];
  if(claims.iss!==`${config.supabaseUrl}/auth/v1`)throw new HttpError(401,'jwt_issuer_invalid','Session issuer is invalid');
  if(!audience.includes('authenticated'))throw new HttpError(401,'jwt_audience_invalid','Session audience is invalid');
  if(Number(claims.exp)<=Math.floor(Date.now()/1000)-30)throw new HttpError(401,'session_expired','Session has expired');
  if(!UUID.test(String(claims.sub||'')))throw new HttpError(401,'jwt_subject_invalid','Session subject is invalid');
  return claims;
};
export const verifyAccess=async(env,accessToken)=>{
  const claims=validateJwtClaims(accessToken,env);
  const user=await supabaseRequest(env,'/auth/v1/user',{token:accessToken});
  if(user?.id!==claims.sub)throw new HttpError(401,'jwt_subject_mismatch','Session identity could not be verified');
  return {user,claims};
};
export const refreshSession=async(env,refreshToken)=>{
  if(!refreshToken)throw new HttpError(401,'session_unavailable','No refresh session is available');
  const session=await supabaseRequest(env,'/auth/v1/token?grant_type=refresh_token',{method:'POST',body:{refresh_token:refreshToken}});
  if(!session?.access_token||!session?.refresh_token)throw new HttpError(401,'refresh_failed','Session refresh failed');
  await verifyAccess(env,session.access_token);
  return session;
};
const rejectedProviderSession=(error)=>error instanceof HttpError&&(
  error.status===401||
  (error.status===403&&/(?:session_id claim|session).*(?:does not exist|not found|invalid)/i.test(`${error.code} ${error.message}`))
);
const rejectedRefresh=(error)=>error instanceof HttpError&&(error.status===400||rejectedProviderSession(error))&&!error.retryable;
export const resolveSession=async(request,env,{required=false}={})=>{
  const cookies=parseCookies(request);
  let accessToken=cookies[ACCESS_COOKIE];
  let refreshToken=cookies[REFRESH_COOKIE];
  let accessRejected=false;
  try{
    if(accessToken){
      const verified=await verifyAccess(env,accessToken);
      return {...verified,accessToken,refreshToken,cookies:[]};
    }
  }catch(error){
    if(!rejectedProviderSession(error))throw error;
    accessRejected=true;
  }
  if(refreshToken){
    try{
      const rotated=await refreshSession(env,refreshToken);
      const verified=await verifyAccess(env,rotated.access_token);
      const rotatedCookies=tokenCookies(rotated);
      queueResponseCookies(request,rotatedCookies);
      return {...verified,accessToken:rotated.access_token,refreshToken:rotated.refresh_token,cookies:rotatedCookies};
    }catch(error){
      if(!rejectedRefresh(error))throw error;
      queueResponseCookies(request,clearSessionCookies());
      if(required)throw new HttpError(401,'authentication_required','Authentication is required');
      return null;
    }
  }
  if(accessRejected)queueResponseCookies(request,clearSessionCookies());
  if(required)throw new HttpError(401,'authentication_required','Authentication is required');
  return null;
};

export const bootstrapContext=async(env,session)=>{
  const id=session.user.id;
  let profiles=await restRequest(env,session.accessToken,`qelly_profiles?select=*&user_id=eq.${id}&limit=1`);
  if(!profiles?.length)profiles=await restRequest(env,session.accessToken,'qelly_profiles',{method:'POST',body:{user_id:id,display_name:cleanText(session.user.user_metadata?.display_name||session.user.email?.split('@')[0]||'Qelly User',80)},prefer:'return=representation'});
  let workspaces=await restRequest(env,session.accessToken,`qelly_workspaces?select=*&owner_id=eq.${id}&order=created_at.asc&limit=1`);
  if(!workspaces?.length)workspaces=await restRequest(env,session.accessToken,'qelly_workspaces',{method:'POST',body:{owner_id:id,name:cleanText(session.user.user_metadata?.workspace_name||session.user.user_metadata?.organization_name||'My Qelly Workspace',100)},prefer:'return=representation'});
  const profile=profiles[0];
  const workspace=workspaces[0];
  return {
    mode:'supabase-auth-cloudflare-facade',
    user:{userId:id,email:session.user.email,displayName:profile?.display_name||null,emailConfirmedAt:session.user.email_confirmed_at||null},
    organization:{organizationId:workspace.id,name:workspace.name},
    workspace:{workspaceId:workspace.id,name:workspace.name},
    profile,
    session:{authenticationMethod:'supabase-email-password',assurance:'email',expiresAt:new Date(Number(session.claims.exp)*1000).toISOString()}
  };
};

const localRateBuckets=new Map();
export const enforceRateLimit=async(env,key,{limit=60,windowMs=60_000}={})=>{
  if(env.QELLY_RATE_LIMITER?.limit){
    const result=await env.QELLY_RATE_LIMITER.limit({key});
    if(!result.success)throw new HttpError(429,'rate_limited','Request rate limit exceeded',{retryable:true});
    return;
  }
  const now=Date.now();
  if(!localRateBuckets.has(key)&&localRateBuckets.size>=10_000)localRateBuckets.delete(localRateBuckets.keys().next().value);
  const events=(localRateBuckets.get(key)||[]).filter(value=>value>now-windowMs);
  if(events.length>=limit)throw new HttpError(429,'rate_limited','Request rate limit exceeded',{retryable:true});
  events.push(now);
  localRateBuckets.set(key,events);
};

export const hashKey=async(value)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(String(value)))).slice(0,16),byte=>byte.toString(16).padStart(2,'0')).join('');
export const stableUuid=async(value)=>{
  const bytes=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(String(value))));
  bytes[6]=(bytes[6]&15)|80;
  bytes[8]=(bytes[8]&63)|128;
  const hex=Array.from(bytes.slice(0,16),item=>item.toString(16).padStart(2,'0')).join('');
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
};
