import {CSRF_COOKIE,HttpError,SECURITY_HEADERS,bootstrapContext,cookie,correlationId,corsHeaders,enforceRateLimit,errorResponse,parseCookies,publicRuntimeConfig,requireOrigin,responseJson,resolveSession,stableUuid,validateJwtClaims} from '../../_lib/runtime.js';
import {handleAuth} from '../../_lib/auth.js';
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

const PUBLIC_MARKET_OBSERVED_AT='2025-01-15T12:00:00.000Z';
const PUBLIC_MARKET_OBSERVED_UNIX=Math.floor(Date.parse(PUBLIC_MARKET_OBSERVED_AT)/1000);
const PUBLIC_MARKET_TRUTH_BOUNDARY='Deterministic demonstration observations only. Values are not live, personalized advice or executable trading signals.';
const PUBLIC_MARKET_ASSETS=Object.freeze([
  ['QI-CRYPTO-BTC','BTC','Bitcoin','Store of value',42500,1.84,18420000000],
  ['QI-CRYPTO-ETH','ETH','Ethereum','Smart-contract platform',2280,-0.62,9120000000],
  ['QI-CRYPTO-SOL','SOL','Solana','Smart-contract platform',98.4,3.21,1860000000],
  ['QI-CRYPTO-BNB','BNB','BNB','Exchange ecosystem',312.6,0.48,734000000],
  ['QI-CRYPTO-XRP','XRP','XRP','Payments',0.61,-1.17,1280000000],
  ['QI-CRYPTO-ADA','ADA','Cardano','Smart-contract platform',0.52,2.03,386000000]
].map(([canonicalId,symbol,name,category,price,change24h,quoteVolume24h],index)=>Object.freeze({
  canonicalId,
  id:canonicalId,
  symbol,
  providerSymbol:`${symbol}USDT`,
  name,
  assetClass:'crypto',
  category,
  currency:'USD',
  price,
  change24h,
  open24h:price/(1+(change24h/100)),
  high24h:price*(1.018+(index*0.001)),
  low24h:price*(0.973-(index*0.001)),
  volume24h:quoteVolume24h/price,
  quoteVolume24h,
  marketCap:null,
  marketCapDefinition:'Unavailable in the deterministic demonstration dataset.',
  definitions:{marketCap:'Unavailable in the deterministic demonstration dataset.'},
  source:{
    provider:'qelly-governed-demo',
    providerName:'Qelly deterministic demonstration',
    attribution:'Qelly deterministic demonstration · not live',
    observationTime:PUBLIC_MARKET_OBSERVED_AT,
    observedAt:PUBLIC_MARKET_OBSERVED_AT,
    ingestionTime:PUBLIC_MARKET_OBSERVED_AT,
    freshness:'simulated',
    qualityState:'simulated-demo',
    confidence:0.5,
    cacheState:'governed-runtime',
    degraded:true,
    fallbackReason:'Public provider redistribution rights are not approved; governed deterministic observations are shown instead.',
    entitlement:'public-read-only-demo'
  }
}))));

const publicMarketAsset=(value)=>{
  const decoded=decodeURIComponent(String(value||'')).toUpperCase();
  return PUBLIC_MARKET_ASSETS.find((asset)=>asset.canonicalId===decoded||asset.symbol===decoded||asset.providerSymbol===decoded)??null;
};

const publicMarketCandles=(asset,limit)=>{
  const count=Math.max(24,Math.min(Number(limit)||168,240));
  const points=Array.from({length:count},(_,index)=>{
    const wave=Math.sin(index/5)*0.018+Math.cos(index/11)*0.009;
    const drift=((index/Math.max(count-1,1))-0.5)*(asset.change24h/100);
    const close=asset.price*(1+wave+drift);
    const open=close*(1-Math.sin(index/3)*0.0025);
    return {
      time:PUBLIC_MARKET_OBSERVED_UNIX-((count-index-1)*3600),
      open,
      high:Math.max(open,close)*1.004,
      low:Math.min(open,close)*0.996,
      close,
      volume:(asset.quoteVolume24h/asset.price/24)*(0.8+((index%5)*0.1))
    };
  });
  return {
    canonicalId:asset.canonicalId,
    assetName:asset.name,
    provider:'qelly-governed-demo',
    requestedProvider:null,
    symbol:asset.providerSymbol,
    interval:'1h',
    points,
    summary:{
      first:points[0].close,
      last:points.at(-1).close,
      minimum:Math.min(...points.map((point)=>point.low)),
      maximum:Math.max(...points.map((point)=>point.high))
    },
    source:{mode:'simulated-demo',attribution:'Qelly deterministic demonstration · not live',observedAt:PUBLIC_MARKET_OBSERVED_AT},
    guardrails:{live:false,executable:false,truthBoundary:PUBLIC_MARKET_TRUTH_BOUNDARY}
  };
};

const publicMarketOverviewContract=()=>{
  const advancers=PUBLIC_MARKET_ASSETS.filter((asset)=>asset.change24h>0).length;
  const decliners=PUBLIC_MARKET_ASSETS.filter((asset)=>asset.change24h<0).length;
  return {
    generatedAt:PUBLIC_MARKET_OBSERVED_AT,
    mode:'simulated-demo',
    truthBoundary:PUBLIC_MARKET_TRUTH_BOUNDARY,
    items:PUBLIC_MARKET_ASSETS,
    total:PUBLIC_MARKET_ASSETS.length,
    breadth:{advancers,decliners,unchanged:PUBLIC_MARKET_ASSETS.length-advancers-decliners},
    kpis:[
      {label:'Demo assets',value:PUBLIC_MARKET_ASSETS.length,unit:'count',definition:'Fixed instruments in the governed public demonstration contract.'},
      {label:'Demo quote volume',value:PUBLIC_MARKET_ASSETS.reduce((sum,asset)=>sum+asset.quoteVolume24h,0),unit:'USD',definition:'Deterministic example values; not provider observations.'},
      {label:'Approved live redistribution feeds',value:0,unit:'count',definition:'No provider is presented as live until display rights and freshness are proven.'},
      {label:'Executable values',value:0,unit:'count',definition:'Public market observations never enable trade execution.'}
    ],
    providerStatus:{provider:'Qelly deterministic demonstration',status:'simulated',lastSuccessAt:null,cacheEntries:0},
    guardrails:{live:false,executable:false,personalizedAdvice:false}
  };
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
  if(path==='public/markets/overview'&&method==='GET'){
    await enforceRateLimit(env,`anonymous-market-overview:${request.headers.get('CF-Connecting-IP')||'unknown'}`,{limit:120});
    return responseJson(request,env,publicMarketOverviewContract(),200,{cache:'public, max-age=300, stale-while-revalidate=900'});
  }
  if(path==='public/markets/assets'&&method==='GET'){
    await enforceRateLimit(env,`anonymous-market-assets:${request.headers.get('CF-Connecting-IP')||'unknown'}`,{limit:120});
    return responseJson(request,env,{generatedAt:PUBLIC_MARKET_OBSERVED_AT,mode:'simulated-demo',truthBoundary:PUBLIC_MARKET_TRUTH_BOUNDARY,total:PUBLIC_MARKET_ASSETS.length,items:PUBLIC_MARKET_ASSETS},200,{cache:'public, max-age=300, stale-while-revalidate=900'});
  }
  if(segments[0]==='public'&&segments[1]==='markets'&&segments[2]==='assets'&&segments.length===4&&method==='GET'){
    await enforceRateLimit(env,`anonymous-market-asset:${request.headers.get('CF-Connecting-IP')||'unknown'}`,{limit:120});
    const asset=publicMarketAsset(segments[3]);
    if(!asset)throw new HttpError(404,'public_market_asset_not_found','Public market asset was not found');
    return responseJson(request,env,asset,200,{cache:'public, max-age=300, stale-while-revalidate=900'});
  }
  if(segments[0]==='public'&&segments[1]==='markets'&&segments[2]==='assets'&&segments[4]==='candles'&&segments.length===5&&method==='GET'){
    await enforceRateLimit(env,`anonymous-market-candles:${request.headers.get('CF-Connecting-IP')||'unknown'}`,{limit:120});
    const asset=publicMarketAsset(segments[3]);
    if(!asset)throw new HttpError(404,'public_market_asset_not_found','Public market asset was not found');
    return responseJson(request,env,publicMarketCandles(asset,url.searchParams.get('limit')),200,{cache:'public, max-age=300, stale-while-revalidate=900'});
  }

  const session=await resolveSession(request,env,{required:true});
  await enforceRateLimit(env,`user:${session.user.id}:${path}`);
  const qelly=await bootstrapContext(env,session);
  if(path==='session/context'&&method==='GET')return responseJson(request,env,qelly,200,{cookies:session.cookies});
  if(path==='preferences/layout'&&method==='GET')return responseJson(request,env,{theme:'burgundy-command',density:'comfortable',motion:'full',fontScale:100,radiusPx:14,customAccent:null,route:'market',revision:1});
  if(path==='preferences/layout'&&['PATCH','PUT'].includes(method))return responseJson(request,env,{revision:1,persisted:false,storage:'browser-local'});
  if(path==='sessions'&&method==='GET')return responseJson(request,env,{scope:'current-session-only',items:[{sessionId:`supabase-${session.user.id.slice(0,8)}`,authenticationMethod:'supabase-email-password',expiresAt:new Date(Number(session.claims.exp)*1000).toISOString(),current:true,revokedAt:null}]});
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
export const __test=Object.freeze({route,stableUuid,validateJwtClaims,publicTruthState,publicProviderEnvelope,publicMarketAsset,publicMarketCandles,publicMarketOverviewContract,...__dataTest});