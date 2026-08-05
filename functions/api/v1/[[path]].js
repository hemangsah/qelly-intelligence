import {CSRF_COOKIE,HttpError,SECURITY_HEADERS,bootstrapContext,cookie,correlationId,corsHeaders,enforceRateLimit,errorResponse,parseCookies,publicRuntimeConfig,requireOrigin,responseJson,resolveSession,stableUuid,validateJwtClaims} from '../../_lib/runtime.js';
import {handleAuth} from '../../_lib/auth.js';
import {handleGovernance} from '../../_lib/governance.js';
import {handleData,__dataTest} from '../../_lib/data.js';
import {providerCatalog,providerResult} from '../../_lib/providers.js';

const configResponse=async(request,env)=>{
  const session=await resolveSession(request,env);
  const csrf=parseCookies(request)[CSRF_COOKIE]||crypto.randomUUID().replaceAll('-','');
  const context=session?await bootstrapContext(env,session):null;
  const runtime=publicRuntimeConfig(env,request.url);
  return responseJson(request,env,{
    productName:'Qelly Intelligence',
    productVersion:'0.9.0-preview.1',
    release:runtime.releaseSha,
    defaultRoute:'market',
    csrf:{header:'X-Qelly-CSRF',token:context?csrf:null,mode:context?'double-submit-cookie':'unavailable-until-authenticated'},
    auth:{authenticated:Boolean(context),backendAvailable:true,productionIdentityEnabled:true,emailDeliveryAvailable:runtime.capabilities.emailDelivery,registrationAvailable:runtime.capabilities.emailDelivery,recoveryAvailable:runtime.capabilities.emailDelivery,mode:'supabase-auth-cloudflare-facade'},
    cloud:{available:true,syncAvailable:true,providerRuntime:true},
    capabilityTruth:{passkeys:false,mfa:false,research:false,persistentJobs:false,productionNotifications:false,multiSessionManagement:false},
    providerRights:{binance:'blocked_pending_redistribution_rights',coinbase:'blocked_pending_written_end_user_display_permission',ecb:'conditionally_approved_attributed_reference_data'},
    runtime,
    states:['default','loading','empty','partial','error','offline','live','cached','stale','delayed','simulated','unavailable','mobile','reduced-motion','high-contrast'],
    liveTrading:false
  },200,{cookies:[...(session?.cookies||[]),...(context?[cookie(CSRF_COOKIE,csrf,{httpOnly:false,maxAge:60*60*8,sameSite:'Strict'})]:[])]});
};

const publicTruthState=(state)=>({
  live_provider:'live',
  cached_provider:'cached',
  delayed_provider:'delayed',
  stale_provider:'stale',
  unavailable:'unavailable',
  live:'live',
  cached:'cached',
  delayed:'delayed',
  stale:'stale'
}[String(state||'')]||'unavailable');

const publicProviderEnvelope=(result,provider)=>{
  const sourceProvider=String(result?.provider||provider);
  const sourceTruthState=String(result?.truthState||'unavailable');
  return {
    ...result,
    provider,
    sourceProvider,
    truthState:publicTruthState(sourceTruthState),
    sourceTruthState,
    observedAt:result?.observedAt??result?.observationTime??null,
    ingestedAt:result?.ingestedAt??result?.ingestionTime??new Date().toISOString()
  };
};

const publicMarketOverview=async(context)=>{
  const {request,env}=context;
  const settled=await Promise.allSettled([
    providerResult(context,'binance','quote','BTCUSDT',{}),
    providerResult(context,'coinbase','quote','BTC-USD',{}),
    providerResult(context,'ecb','fx-reference-rates','EUR',{})
  ]);
  const normalized=(entry,provider)=>publicProviderEnvelope(entry.status==='fulfilled'?entry.value:{provider,truthState:'unavailable',data:null,error:{code:'provider_unavailable',message:'Provider is temporarily unavailable'},observedAt:null,ingestedAt:new Date().toISOString(),attribution:provider},provider);
  const [binance,coinbase,ecb]=[
    normalized(settled[0],'binance'),
    normalized(settled[1],'coinbase'),
    normalized(settled[2],'ecb')
  ];
  const quote=(result,label)=>({
    label,
    value:result.data?.price!=null?`$${Number(result.data.price).toLocaleString('en-US',{maximumFractionDigits:2})}`:'Unavailable',
    state:result.truthState,
    provider:result.provider,
    observedAt:result.observedAt,
    ingestedAt:result.ingestedAt,
    attribution:result.attribution??label,
    reason:result.fallbackReason??null,
    termsState:result.termsState??null
  });
  return responseJson(request,env,{
    generatedAt:new Date().toISOString(),
    market:[quote(coinbase,'Coinbase Exchange'),quote(binance,'Binance')],
    referenceRates:{
      label:'ECB reference rates',
      count:ecb.data?.rates?Object.keys(ecb.data.rates).length:0,
      state:ecb.truthState,
      provider:'ecb',
      observedAt:ecb.observedAt,
      ingestedAt:ecb.ingestedAt,
      attribution:ecb.attribution??'European Central Bank',
      reason:ecb.fallbackReason??null,
      termsState:ecb.termsState??'conditionally_approved_attributed_reference_data'
    },
    providers:{binance,coinbase,ecb},
    deterministicLocal:true,
    execution:false
  },200,{cache:'public, max-age=5, stale-while-revalidate=20'});
};

export async function route(context){
  const {request,env}=context;
  const url=new URL(request.url);
  const path=Array.isArray(context.params?.path)?context.params.path.join('/'):String(context.params?.path||url.pathname.replace(/^\/api\/v1\/?/,''));
  const segments=path.split('/').filter(Boolean);
  const method=request.method.toUpperCase();
  if(method==='OPTIONS')return new Response(null,{status:204,headers:{...SECURITY_HEADERS,...corsHeaders(request,env),'Access-Control-Allow-Methods':'GET,HEAD,POST,PUT,PATCH,DELETE,OPTIONS','Access-Control-Allow-Headers':'Content-Type,X-Qelly-CSRF,Idempotency-Key,X-Correlation-Id','Access-Control-Max-Age':'600'}});
  if(request.headers.get('origin'))requireOrigin(request,env);
  if(path==='config'&&method==='GET')return configResponse(request,env);
  if(path==='health'&&method==='GET'){
    const runtime=publicRuntimeConfig(env,request.url);
    return responseJson(request,env,{status:'ok',scope:'process-and-static-runtime',releaseSha:runtime.releaseSha,deterministicLocal:true,authenticationConfigured:runtime.capabilities.authentication,emailDeliveryConfigured:runtime.capabilities.emailDelivery,cloudSyncConfigured:runtime.capabilities.cloudSync,liveProvidersConfigured:runtime.capabilities.liveProviders,providerRights:'restricted',trading:false,custody:false,transfers:false});
  }
  if(path==='readiness'&&method==='GET')return responseJson(request,env,{
    ready:false,
    status:'not_proven',
    reason:'End-to-end Auth delivery, RLS isolation and provider freshness canaries are not yet complete.',
    dependencies:{supabase:'configured_not_canaried',auth:'smtp_delivery_blocked',rls:'required_not_live_proven',providers:'restricted_by_rights_review'},
    releaseSha:publicRuntimeConfig(env,request.url).releaseSha
  },503);
  const authRuntime=publicRuntimeConfig(env,request.url);
  if(!authRuntime.capabilities.emailDelivery&&method==='POST'&&['auth/register','auth/recovery/request'].includes(path))throw new HttpError(503,'auth_email_delivery_unavailable','Account creation and email recovery are temporarily unavailable until transactional email delivery is proven.',{retryable:false});
  const auth=await handleAuth(context,path,method);
  if(auth)return auth;
  if(path==='providers/status'&&method==='GET'){
    await enforceRateLimit(env,`public-provider-status:${request.headers.get('CF-Connecting-IP')||'unknown'}`,{limit:60});
    return responseJson(request,env,{providers:providerCatalog(),releaseSha:publicRuntimeConfig(env,request.url).releaseSha});
  }
  if(segments[0]==='providers'&&['binance','coinbase','ecb'].includes(segments[1])&&method==='GET'){
    await enforceRateLimit(env,`public-provider:${request.headers.get('CF-Connecting-IP')||'unknown'}`,{limit:60});
    const provider=segments[1];
    const capability=url.searchParams.get('capability')||(provider==='ecb'?'fx-reference-rates':'quote');
    const symbol=url.searchParams.get('symbol')||(provider==='binance'?'BTCUSDT':provider==='coinbase'?'BTC-USD':'EUR');
    return responseJson(request,env,await providerResult(context,provider,capability,symbol,Object.fromEntries(url.searchParams)),200,{cache:'public, max-age=5'});
  }
  if(path==='market/overview'&&method==='GET'){
    await enforceRateLimit(env,`public-market-overview:${request.headers.get('CF-Connecting-IP')||'unknown'}`,{limit:60});
    return publicMarketOverview(context);
  }

  const session=await resolveSession(request,env,{required:true});
  await enforceRateLimit(env,`user:${session.user.id}:${path}`);
  const qelly=await bootstrapContext(env,session);
  if(path==='session/context'&&method==='GET')return responseJson(request,env,qelly,200,{cookies:session.cookies});
  if(path==='preferences/layout'&&method==='GET')return responseJson(request,env,{theme:'burgundy-command',density:'comfortable',motion:'full',fontScale:100,radiusPx:14,customAccent:null,route:'market',revision:1});
  if(path==='preferences/layout'&&['PATCH','PUT'].includes(method))return responseJson(request,env,{revision:1,persisted:false,storage:'browser-local'});
  if(path==='sessions'&&method==='GET')return responseJson(request,env,{scope:'current-session-only',items:[{sessionId:`supabase-${session.user.id.slice(0,8)}`,authenticationMethod:'supabase-email-password',expiresAt:new Date(Number(session.claims.exp)*1000).toISOString(),current:true,revokedAt:null}]});
  const governance=await handleGovernance(context,path,method,session,qelly);
  if(governance)return governance;
  const data=await handleData(context,path,segments,method,session,qelly);
  if(data)return data;
  throw new HttpError(404,'route_not_found','API route was not found');
}

export async function onRequest(context){
  const started=Date.now();
  const request=context.request;
  let response;
  try{response=await route(context);return response;}
  catch(error){response=errorResponse(request,context.env,error);return response;}
  finally{
    try{console.log(JSON.stringify({event:'qelly_public_runtime_request',correlationId:correlationId(request),method:request.method,path:new URL(request.url).pathname,status:response?.status??500,durationMs:Date.now()-started,bodyLogged:false}));}catch{}
  }
}

export {publicRuntimeConfig} from '../../_lib/runtime.js';
export const __test=Object.freeze({route,stableUuid,validateJwtClaims,publicTruthState,publicProviderEnvelope,...__dataTest});
