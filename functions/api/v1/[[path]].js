import {CSRF_COOKIE,HttpError,SECURITY_HEADERS,bootstrapContext,cookie,correlationId,corsHeaders,enforceRateLimit,errorResponse,parseCookies,publicRuntimeConfig,requireOrigin,responseJson,resolveSession,stableUuid,validateJwtClaims} from '../../_lib/runtime.js';
import {handleAuth} from '../../_lib/auth.js';
import {handleData,__dataTest} from '../../_lib/data.js';
import {providerCatalog,providerResult} from '../../_lib/providers.js';

const configResponse=async(request,env)=>{
  const session=await resolveSession(request,env),csrf=parseCookies(request)[CSRF_COOKIE]||crypto.randomUUID().replaceAll('-',''),context=session?await bootstrapContext(env,session):null,runtime=publicRuntimeConfig(env,request.url);
  return responseJson(request,env,{productName:'Qelly Intelligence',productVersion:'0.9.0-preview.1',release:runtime.releaseSha,defaultRoute:context?'market':'auth-login',csrf:{header:'X-Qelly-CSRF',token:context?csrf:null,mode:context?'double-submit-cookie':'unavailable-until-authenticated'},auth:{authenticated:Boolean(context),backendAvailable:true,productionIdentityEnabled:true,mode:'supabase-auth-cloudflare-facade'},cloud:{available:true,syncAvailable:true,providerRuntime:true},runtime,states:['default','loading','empty','partial','error','offline','stale','delayed','simulated','mobile','reduced-motion','high-contrast'],liveTrading:false},200,{cookies:[...(session?.cookies||[]),...(context?[cookie(CSRF_COOKIE,csrf,{httpOnly:false,maxAge:60*60*8,sameSite:'Strict'})]:[])]});
};

export async function route(context){
  const {request,env}=context,url=new URL(request.url),path=Array.isArray(context.params?.path)?context.params.path.join('/'):String(context.params?.path||url.pathname.replace(/^\/api\/v1\/?/,'')),segments=path.split('/').filter(Boolean),method=request.method.toUpperCase();
  if(method==='OPTIONS')return new Response(null,{status:204,headers:{...SECURITY_HEADERS,...corsHeaders(request,env),'Access-Control-Allow-Methods':'GET,HEAD,POST,PUT,PATCH,DELETE,OPTIONS','Access-Control-Allow-Headers':'Content-Type,X-Qelly-CSRF,Idempotency-Key,X-Correlation-Id','Access-Control-Max-Age':'600'}});
  requireOrigin(request,env);
  if(path==='config'&&method==='GET')return configResponse(request,env);
  if(path==='health'&&method==='GET'){const runtime=publicRuntimeConfig(env,request.url);return responseJson(request,env,{status:'ok',releaseSha:runtime.releaseSha,deterministicLocal:true,authentication:runtime.capabilities.authentication,cloudSync:runtime.capabilities.cloudSync,liveProviders:runtime.capabilities.liveProviders,trading:false,custody:false,transfers:false});}
  if(path==='readiness'&&method==='GET')return responseJson(request,env,{ready:true,dependencies:{supabase:'configured',auth:'configured',rls:'required',providers:'configured'},releaseSha:publicRuntimeConfig(env,request.url).releaseSha});
  const auth=await handleAuth(context,path,method);if(auth)return auth;
  const session=await resolveSession(request,env,{required:true});await enforceRateLimit(env,`user:${session.user.id}:${path}`);const qelly=await bootstrapContext(env,session);
  if(path==='session/context'&&method==='GET')return responseJson(request,env,qelly,200,{cookies:session.cookies});
  if(path==='preferences/layout'&&method==='GET')return responseJson(request,env,{theme:'burgundy-command',density:'comfortable',motion:'full',fontScale:100,radiusPx:14,customAccent:null,route:'market',revision:1});
  if(path==='preferences/layout'&&['PATCH','PUT'].includes(method))return responseJson(request,env,{revision:1,persisted:false,storage:'browser-local'});
  if(path==='production-foundation/status'&&method==='GET')return responseJson(request,env,{ready:true,dependencies:{database:{driver:'Supabase PostgreSQL + RLS',ok:true},jobs:{driver:'Cloudflare request lifecycle',ok:true},auth:{driver:'Supabase Auth',ok:true},providers:{driver:'Cloudflare provider facade',ok:true}}});
  if(path==='sessions'&&method==='GET')return responseJson(request,env,{items:[{sessionId:`supabase-${session.user.id.slice(0,8)}`,authenticationMethod:'supabase-email-password',expiresAt:new Date(Number(session.claims.exp)*1000).toISOString(),current:true,revokedAt:null}]});
  if(path==='jobs'&&method==='GET')return responseJson(request,env,{items:[]});
  if(path==='production-notifications'&&method==='GET')return responseJson(request,env,{items:[]});
  if(path==='market/overview'&&method==='GET'){const [binance,coinbase,ecb]=await Promise.all([providerResult(context,'binance','quote','BTCUSDT',{}),providerResult(context,'coinbase','quote','BTC-USD',{}),providerResult(context,'ecb','fx-reference-rates','EUR',{})]);return responseJson(request,env,{macro:[{label:'BTC · Binance',value:binance.data?`$${Number(binance.data.price).toLocaleString()}`:'Unavailable',state:binance.truthState},{label:'BTC · Coinbase',value:coinbase.data?`$${Number(coinbase.data.price).toLocaleString()}`:'Unavailable',state:coinbase.truthState},{label:'ECB',value:ecb.data?`${Object.keys(ecb.data.rates).length} rates`:'Unavailable',state:ecb.truthState}],providers:{binance,coinbase,ecb}},200,{cache:'private, max-age=5'});}
  if(path==='providers/status'&&method==='GET')return responseJson(request,env,{providers:providerCatalog(),releaseSha:publicRuntimeConfig(env,request.url).releaseSha});
  if(segments[0]==='providers'&&['binance','coinbase','ecb'].includes(segments[1])&&method==='GET'){const provider=segments[1],capability=url.searchParams.get('capability')||(provider==='ecb'?'fx-reference-rates':'quote'),symbol=url.searchParams.get('symbol')||(provider==='binance'?'BTCUSDT':provider==='coinbase'?'BTC-USD':'EUR');return responseJson(request,env,await providerResult(context,provider,capability,symbol,Object.fromEntries(url.searchParams)),200,{cache:'private, max-age=5'});}
  const data=await handleData(context,path,segments,method,session,qelly);if(data)return data;
  throw new HttpError(404,'route_not_found','API route was not found');
}

export async function onRequest(context){const started=Date.now(),request=context.request;try{return await route(context);}catch(error){return errorResponse(request,context.env,error);}finally{try{console.log(JSON.stringify({event:'qelly_public_runtime_request',correlationId:correlationId(request),method:request.method,path:new URL(request.url).pathname,status:'completed',durationMs:Date.now()-started,bodyLogged:false}));}catch{}}}
export {publicRuntimeConfig} from '../../_lib/runtime.js';
export const __test=Object.freeze({route,stableUuid,validateJwtClaims,...__dataTest});
