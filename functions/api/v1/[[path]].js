import {HttpError,SECURITY_HEADERS,bootstrapContext,correlationId,corsHeaders,enforceRateLimit,errorResponse,publicRuntimeConfig,requireOrigin,responseJson,resolveSession,stableUuid,validateJwtClaims} from '../../_lib/runtime.js';
import {effectivePublicRuntimeConfig} from '../../_lib/email-capability.js';
import {handleAuth} from '../../_lib/auth.js';
import {handleData,__dataTest} from '../../_lib/data.js';
import {providerCatalog,providerResult} from '../../_lib/providers.js';
import {capabilityInventory,matchUnavailableCapability} from '../../_lib/capability-registry.js';
import {buildExternalMarketNetwork} from '../../_lib/market-network.js';

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
const readMethod=(method)=>['GET','HEAD'].includes(String(method||'').toUpperCase());

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

const publicMarketNetwork=async(context)=>{
  const {request,env}=context;
  const [external,ecbEntry]=await Promise.all([
    buildExternalMarketNetwork(),
    providerResult(context,'ecb','fx-reference-rates','EUR',{}).then((value)=>publicProviderEnvelope(value,'ecb')).catch((error)=>publicProviderEnvelope({provider:'ecb',truthState:'unavailable',data:null,observedAt:null,ingestedAt:new Date().toISOString(),attribution:'European Central Bank',fallbackReason:error.message},'ecb'))
  ]);
  return responseJson(request,env,{
    ...external,
    sources:{...external.sources,ecb:ecbEntry},
    providerPolicy:{binance:'rights_blocked_or_unverified',coinbase:'rights_blocked_or_unverified',ecb:'governed_reference_data'},
    releaseSha:publicRuntimeConfig(env,request.url).releaseSha
  },200,{cache:'public, max-age=0, s-maxage=90, stale-while-revalidate=900'});
};

export async function route(context){
  const {request,env}=context;
  const url=new URL(request.url);
  const path=Array.isArray(context.params?.path)?context.params.path.join('/'):String(context.params?.path||url.pathname.replace(/^\/api\/v1\/?/,''));
  const segments=path.split('/').filter(Boolean);
  const method=request.method.toUpperCase();
  if(method==='OPTIONS')return new Response(null,{status:204,headers:{...SECURITY_HEADERS,...corsHeaders(request,env),'Access-Control-Allow-Methods':'GET,HEAD,POST,PUT,PATCH,DELETE,OPTIONS','Access-Control-Allow-Headers':'Content-Type,X-Qelly-CSRF,Idempotency-Key,X-Correlation-Id','Access-Control-Max-Age':'600'}});
  if(request.headers.get('origin'))requireOrigin(request,env);
  const authRuntime=effectivePublicRuntimeConfig(env,request.url);
  const authRuntimeOwned=path.startsWith('auth/')||path==='cloud/opt-in'||path==='account/delete';
  if(authRuntimeOwned&&authRuntime.capabilities.authentication!==true)throw new HttpError(503,'auth_runtime_unavailable','Authentication is disabled in the current runtime configuration.',{retryable:false});
  if(!authRuntime.capabilities.emailDelivery&&method==='POST'&&['auth/register','auth/recovery/request'].includes(path))throw new HttpError(503,'auth_email_delivery_unavailable','Account creation and email recovery are temporarily unavailable until transactional email delivery is proven.',{retryable:false});
  const auth=await handleAuth(context,path,method);
  if(auth)return auth;
  if(path==='platform/capabilities'&&readMethod(method)){
    await enforceRateLimit(env,`public-capability-inventory:${request.headers.get('CF-Connecting-IP')||'unknown'}`,{limit:60});
    return responseJson(request,env,capabilityInventory(),200,{cache:'no-store'});
  }
  if(path==='providers/status'&&readMethod(method)){
    await enforceRateLimit(env,`public-provider-status:${request.headers.get('CF-Connecting-IP')||'unknown'}`,{limit:60});
    return responseJson(request,env,{providers:providerCatalog(),releaseSha:publicRuntimeConfig(env,request.url).releaseSha});
  }
  if(segments[0]==='providers'&&['binance','coinbase','ecb'].includes(segments[1])&&readMethod(method)){
    await enforceRateLimit(env,`public-provider:${request.headers.get('CF-Connecting-IP')||'unknown'}`,{limit:60});
    const provider=segments[1];
    const capability=url.searchParams.get('capability')||(provider==='ecb'?'fx-reference-rates':'quote');
    const symbol=url.searchParams.get('symbol')||(provider==='binance'?'BTCUSDT':provider==='coinbase'?'BTC-USD':'EUR');
    return responseJson(request,env,await providerResult(context,provider,capability,symbol,Object.fromEntries(url.searchParams)),200,{cache:'public, max-age=5'});
  }
  if(path==='market/overview'&&readMethod(method)){
    await enforceRateLimit(env,`public-market-overview:${request.headers.get('CF-Connecting-IP')||'unknown'}`,{limit:60});
    return publicMarketOverview(context);
  }
  if(path==='market/network'&&readMethod(method)){
    await enforceRateLimit(env,`public-market-network:${request.headers.get('CF-Connecting-IP')||'unknown'}`,{limit:30});
    return publicMarketNetwork(context);
  }

  const session=await resolveSession(request,env,{required:true});
  await enforceRateLimit(env,`user:${session.user.id}:${path}`);
  const qelly=await bootstrapContext(env,session);
  if(path==='session/context'&&method==='GET')return responseJson(request,env,qelly,200,{cookies:session.cookies});
  if(path==='preferences/layout')throw new HttpError(503,'preferences_route_owner_mismatch','Preferences are owned by the dedicated /api/v1/preferences/layout function; the generic API fallback will not return browser-local defaults.',{retryable:false});
  if(path==='sessions'&&method==='GET')return responseJson(request,env,{scope:'current-session-only',items:[{sessionId:`supabase-${session.user.id.slice(0,8)}`,authenticationMethod:'supabase-email-password',expiresAt:new Date(Number(session.claims.exp)*1000).toISOString(),current:true,revokedAt:null}]});
  const data=await handleData(context,path,segments,method,session,qelly);
  if(data)return data;
  const unavailable=matchUnavailableCapability(path);
  if(unavailable)throw new HttpError(501,'capability_unavailable_in_canonical_runtime',`${unavailable.label} is not available in the canonical Cloudflare runtime.`,{
    details:{
      capability:unavailable.id,
      truthState:'UNAVAILABLE',
      canonicalRuntime:unavailable.canonicalRuntime,
      category:unavailable.category,
      priority:unavailable.priority,
      reason:unavailable.reason,
      routeFamilies:unavailable.routeFamilies
    },
    retryable:false
  });
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
export const __test=Object.freeze({route,stableUuid,validateJwtClaims,publicTruthState,publicProviderEnvelope,readMethod,publicMarketNetwork,...__dataTest});