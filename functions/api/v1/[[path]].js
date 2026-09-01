import {HttpError,SECURITY_HEADERS,bootstrapContext,correlationId,corsHeaders,enforceRateLimit,errorResponse,publicRuntimeConfigForRequest,requireOrigin,responseJson,resolveSession,stableUuid,validateJwtClaims} from '../../_lib/runtime.js';
import {effectivePublicRuntimeConfig} from '../../_lib/email-capability.js';
import {handleAuth} from '../../_lib/auth.js';
import {handleData,__dataTest} from '../../_lib/data.js';
import {handleEvidence,__evidenceTest} from '../../_lib/evidence.js';
import {providerCatalog,providerResult} from '../../_lib/providers.js';
import {capabilityInventory,matchUnavailableCapability} from '../../_lib/capability-registry.js';
import {buildAssetRankings,buildDiscoveryOverview,buildExternalMarketNetwork,buildNetworkDiagnostics} from '../../_lib/market-network.js';
import {buildUniversalSearch} from '../../_lib/public-search.js';
import {buildPublicCategories} from '../../_lib/public-categories.js';
import {buildPublicVenues} from '../../_lib/public-venues.js';
import {buildPublicDexDiscovery} from '../../_lib/public-dex.js';
import {buildPublicGlobalCharts} from '../../_lib/public-global-charts.js';
import {buildPublicConverter} from '../../_lib/public-converter.js';
import {buildPublicAssetIntelligence} from '../../_lib/public-asset-intelligence.js';
import {buildPublicAdvancedChart} from '../../_lib/public-advanced-chart.js';
import {buildPublicFundamentalsEstimates} from '../../_lib/public-fundamentals-estimates.js';
import {buildPublicFilingWorkspace} from '../../_lib/public-filing-workspace.js';
import {buildPublicEventCalendar} from '../../_lib/public-event-calendar.js';
import {buildPublicComparisonLab} from '../../_lib/public-comparison-lab.js';
import {buildPublicAlertRules} from '../../_lib/public-alert-rules.js';
import {providerDirectory} from '../../_lib/provider-directory.js';

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

const externalTruthState=(source,{reference=false}={})=>{
  const raw=String(source?.truthState||source?.state||'unavailable').toLowerCase();
  if(!source||raw==='unavailable'||source.data==null)return 'unavailable';
  if(reference||raw.includes('delayed')||raw.includes('stale')||raw.includes('reference'))return 'delayed';
  if(raw.includes('cached'))return 'cached';
  if(raw.startsWith('live'))return 'live';
  return 'cached';
};
const formatUsd=(value,{maximumFractionDigits=2}={})=>Number.isFinite(Number(value))?`$${Number(value).toLocaleString('en-US',{maximumFractionDigits})}`:'Unavailable';
const macroObservation=({label,value,state,provider,observedAt,attribution})=>({label,value:value??'Unavailable',state:state||'unavailable',provider,observedAt:observedAt??null,attribution:attribution??provider});

const publicMarketOverview=async(context)=>{
  const {request,env}=context;
  const [settled,external]=await Promise.all([
    Promise.allSettled([
      providerResult(context,'binance','quote','BTCUSDT',{}),
      providerResult(context,'coinbase','quote','BTC-USD',{}),
      providerResult(context,'ecb','fx-reference-rates','EUR',{})
    ]),
    buildExternalMarketNetwork(context)
  ]);
  const normalized=(entry,provider)=>publicProviderEnvelope(entry.status==='fulfilled'?entry.value:{provider,truthState:'unavailable',data:null,error:{code:'provider_unavailable',message:'Provider is temporarily unavailable'},observedAt:null,ingestedAt:new Date().toISOString(),attribution:provider},provider);
  const [binance,coinbase,ecb]=[
    normalized(settled[0],'binance'),
    normalized(settled[1],'coinbase'),
    normalized(settled[2],'ecb')
  ];
  const quote=(result,label)=>({
    label,
    value:result.data?.price!=null?formatUsd(result.data.price):'Unavailable',
    state:result.truthState,
    provider:result.provider,
    observedAt:result.observedAt,
    ingestedAt:result.ingestedAt,
    attribution:result.attribution??label,
    reason:result.fallbackReason??null,
    termsState:result.termsState??null
  });
  const hyperliquid=external.sources?.hyperliquid;
  const alternative=external.sources?.['alternative-me'];
  const worldBank=external.sources?.['world-bank'];
  const hyperRows=Array.isArray(hyperliquid?.data)?hyperliquid.data:[];
  const mid=(symbol)=>hyperRows.find((row)=>row.symbol===symbol)?.mid;
  const sentiment=alternative?.data?.sentiment;
  const indiaGrowth=Array.isArray(worldBank?.data)?worldBank.data.find((row)=>row.countryId==='IND'):null;
  const ecbUsd=ecb.data?.rates?.USD;
  const macro=[
    macroObservation({label:'BTC',value:formatUsd(mid('BTC')),state:externalTruthState(hyperliquid),provider:'Hyperliquid',observedAt:hyperliquid?.observedAt,attribution:hyperliquid?.attribution}),
    macroObservation({label:'ETH',value:formatUsd(mid('ETH')),state:externalTruthState(hyperliquid),provider:'Hyperliquid',observedAt:hyperliquid?.observedAt,attribution:hyperliquid?.attribution}),
    macroObservation({label:'SOL',value:formatUsd(mid('SOL'),{maximumFractionDigits:4}),state:externalTruthState(hyperliquid),provider:'Hyperliquid',observedAt:hyperliquid?.observedAt,attribution:hyperliquid?.attribution}),
    macroObservation({label:'Fear & Greed',value:sentiment?.value!=null?`${sentiment.value} · ${sentiment.classification||'Reference'}`:'Unavailable',state:externalTruthState(alternative,{reference:true}),provider:'Alternative.me',observedAt:sentiment?.timestamp??alternative?.observedAt,attribution:alternative?.attribution}),
    macroObservation({label:'EUR/USD',value:Number.isFinite(Number(ecbUsd))?Number(ecbUsd).toFixed(4):'Unavailable',state:ecb.truthState==='unavailable'?'unavailable':'delayed',provider:'ECB',observedAt:ecb.observedAt,attribution:ecb.attribution??'European Central Bank'}),
    macroObservation({label:'India GDP',value:Number.isFinite(Number(indiaGrowth?.gdpGrowthPct))?`${Number(indiaGrowth.gdpGrowthPct).toFixed(2)}% · ${indiaGrowth.year}`:'Unavailable',state:externalTruthState(worldBank,{reference:true}),provider:'World Bank',observedAt:worldBank?.observedAt,attribution:worldBank?.attribution})
  ];
  return responseJson(request,env,{
    generatedAt:new Date().toISOString(),
    macro,
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
    externalSources:external.sources,
    deterministicLocal:false,
    fabricatedFallback:false,
    execution:false
  },200,{cache:'public, max-age=0, s-maxage=10, stale-while-revalidate=30'});
};

const publicMarketNetwork=async(context)=>{
  const {request,env}=context;
  const [external,ecbEntry]=await Promise.all([
    buildExternalMarketNetwork(context),
    providerResult(context,'ecb','fx-reference-rates','EUR',{}).then((value)=>publicProviderEnvelope(value,'ecb')).catch((error)=>publicProviderEnvelope({provider:'ecb',truthState:'unavailable',data:null,observedAt:null,ingestedAt:new Date().toISOString(),attribution:'European Central Bank',fallbackReason:error.message},'ecb'))
  ]);
  const sources={...external.sources,ecb:ecbEntry};
  const networkDiagnostics=buildNetworkDiagnostics(sources);
  return responseJson(request,env,{
    ...external,
    sources,
    networkDiagnostics,
    discoveryOverview:buildDiscoveryOverview(sources,networkDiagnostics),
    assetRankings:buildAssetRankings(sources),
    providerPolicy:{binance:'rights_blocked_or_unverified',coinbase:'rights_blocked_or_unverified',ecb:'governed_reference_data'},
    releaseSha:publicRuntimeConfigForRequest(env,request.url).releaseSha
  },200,{cache:'public, max-age=0, s-maxage=10, stale-while-revalidate=30'});
};

export async function route(context){
  const {request,env}=context;
  const url=new URL(request.url);
  const path=Array.isArray(context.params?.path)?context.params.path.join('/'):String(context.params?.path||url.pathname.replace(/^\/api\/v1\/?/,''));
  const segments=path.split('/').filter(Boolean);
  const method=request.method.toUpperCase();
  if(method==='OPTIONS')return new Response(null,{status:204,headers:{...SECURITY_HEADERS,...corsHeaders(request,env),'Access-Control-Allow-Methods':'GET,HEAD,POST,PUT,PATCH,DELETE,OPTIONS','Access-Control-Allow-Headers':'Content-Type,X-Qelly-CSRF,Idempotency-Key,X-Correlation-Id','Access-Control-Max-Age':'600'}});
  if(request.headers.get('origin'))requireOrigin(request,env);
  const authRuntimeOwned=path.startsWith('auth/')||path==='cloud/opt-in'||path==='account/delete';
  if(authRuntimeOwned){
    const authRuntime=effectivePublicRuntimeConfig(env,request.url);
    if(authRuntime.capabilities.authentication!==true)throw new HttpError(503,'auth_runtime_unavailable','Authentication is disabled in the current runtime configuration.',{retryable:false});
    if(!authRuntime.capabilities.emailDelivery&&method==='POST'&&['auth/register','auth/recovery/request'].includes(path))throw new HttpError(503,'auth_email_delivery_unavailable','Account creation and email recovery are temporarily unavailable until transactional email delivery is proven.',{retryable:false});
  }
  const auth=await handleAuth(context,path,method);
  if(auth)return auth;
  if(path==='platform/capabilities'&&readMethod(method)){
    await enforceRateLimit(env,`public-capability-inventory:${request.headers.get('CF-Connecting-IP')||'unknown'}`,{limit:60});
    return responseJson(request,env,capabilityInventory(),200,{cache:'no-store'});
  }
  if(path==='providers/status'&&readMethod(method)){
    await enforceRateLimit(env,`public-provider-status:${request.headers.get('CF-Connecting-IP')||'unknown'}`,{limit:60});
    return responseJson(request,env,{providers:providerCatalog(),releaseSha:publicRuntimeConfigForRequest(env,request.url).releaseSha});
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
  if(path==='search'&&readMethod(method)){
    await enforceRateLimit(env,`public-universal-search:${request.headers.get('CF-Connecting-IP')||'unknown'}`,{limit:90});
    const query=url.searchParams.get('q')||'';
    const types=url.searchParams.get('types')||'';
    const assetTerms=new Set(['btc','bitcoin','eth','ethereum','usdt','tether','bnb','xrp','sol','solana','usdc','doge','dogecoin','ada','cardano','trx','tron']);
    const assetIntent=types.split(',').includes('asset')||assetTerms.has(query.trim().toLowerCase());
    const external=assetIntent?await buildExternalMarketNetwork(context):{sources:{}};
    const result=buildUniversalSearch({
      q:query,
      types,
      access:url.searchParams.get('access')||'all',
      limit:url.searchParams.get('limit')||30,
      assetRankings:buildAssetRankings(external.sources)
    });
    return responseJson(request,env,{...result,releaseSha:publicRuntimeConfigForRequest(env,request.url).releaseSha},200,{cache:'public, max-age=0, s-maxage=10, stale-while-revalidate=30'});
  }
  if(path==='discovery/categories'&&readMethod(method)){
    await enforceRateLimit(env,`public-categories:${request.headers.get('CF-Connecting-IP')||'unknown'}`,{limit:60});
    const external=await buildExternalMarketNetwork(context);
    const result=buildPublicCategories(buildAssetRankings(external.sources));
    return responseJson(request,env,{...result,releaseSha:publicRuntimeConfigForRequest(env,request.url).releaseSha},200,{cache:'public, max-age=0, s-maxage=10, stale-while-revalidate=30'});
  }
  if(path==='discovery/venues'&&readMethod(method)){
    await enforceRateLimit(env,`public-venues:${request.headers.get('CF-Connecting-IP')||'unknown'}`,{limit:60});
    const external=await buildExternalMarketNetwork(context);
    const result=buildPublicVenues({directory:providerDirectory(),providerPolicies:providerCatalog(),sources:external.sources});
    return responseJson(request,env,{...result,releaseSha:publicRuntimeConfigForRequest(env,request.url).releaseSha},200,{cache:'public, max-age=0, s-maxage=10, stale-while-revalidate=30'});
  }
  if(path==='discovery/dex'&&readMethod(method)){
    await enforceRateLimit(env,`public-dex:${request.headers.get('CF-Connecting-IP')||'unknown'}`,{limit:60});
    const result=buildPublicDexDiscovery(providerDirectory());
    return responseJson(request,env,{...result,releaseSha:publicRuntimeConfigForRequest(env,request.url).releaseSha},200,{cache:'public, max-age=0, s-maxage=30, stale-while-revalidate=60'});
  }
  if(path==='discovery/global-charts'&&readMethod(method)){
    await enforceRateLimit(env,`public-global-charts:${request.headers.get('CF-Connecting-IP')||'unknown'}`,{limit:60});
    const result=buildPublicGlobalCharts(providerDirectory());
    return responseJson(request,env,{...result,releaseSha:publicRuntimeConfigForRequest(env,request.url).releaseSha},200,{cache:'public, max-age=0, s-maxage=30, stale-while-revalidate=60'});
  }
  if(path==='discovery/converter'&&readMethod(method)){
    await enforceRateLimit(env,`public-converter:${request.headers.get('CF-Connecting-IP')||'unknown'}`,{limit:60});
    let ecb;
    try{ecb=await providerResult(context,'ecb','fx-reference-rates','EUR',{});}catch(error){ecb={truthState:'unavailable',data:null,error:{code:'provider_unavailable',message:error.message}};}
    const result=buildPublicConverter(ecb);
    return responseJson(request,env,{...result,releaseSha:publicRuntimeConfigForRequest(env,request.url).releaseSha},200,{cache:'public, max-age=0, s-maxage=30, stale-while-revalidate=90'});
  }
  if(path==='discovery/asset-intelligence'&&readMethod(method)){
    await enforceRateLimit(env,`public-asset-intelligence:${request.headers.get('CF-Connecting-IP')||'unknown'}`,{limit:60});
    const external=await buildExternalMarketNetwork(context);
    const result=buildPublicAssetIntelligence(external.sources,url.searchParams.get('asset')||'QI-CRYPTO-BTC');
    return responseJson(request,env,{...result,releaseSha:publicRuntimeConfigForRequest(env,request.url).releaseSha},200,{cache:'public, max-age=0, s-maxage=10, stale-while-revalidate=30'});
  }
  if(path==='discovery/advanced-chart'&&readMethod(method)){
    await enforceRateLimit(env,`public-advanced-chart:${request.headers.get('CF-Connecting-IP')||'unknown'}`,{limit:60});
    const external=await buildExternalMarketNetwork(context);
    const result=buildPublicAdvancedChart(external.sources,url.searchParams.get('asset')||'QI-CRYPTO-BTC',Object.fromEntries(url.searchParams));
    return responseJson(request,env,{...result,releaseSha:publicRuntimeConfigForRequest(env,request.url).releaseSha},200,{cache:'public, max-age=0, s-maxage=10, stale-while-revalidate=30'});
  }
  if(path==='discovery/fundamentals-estimates'&&readMethod(method)){
    await enforceRateLimit(env,`public-fundamentals-estimates:${request.headers.get('CF-Connecting-IP')||'unknown'}`,{limit:90});
    const result=buildPublicFundamentalsEstimates(url.searchParams.get('issuer')||'QI-EQUITY-AAPL',Object.fromEntries(url.searchParams));
    return responseJson(request,env,{...result,releaseSha:publicRuntimeConfigForRequest(env,request.url).releaseSha},200,{cache:'public, max-age=0, s-maxage=30, stale-while-revalidate=60'});
  }
  if(path==='discovery/filing-workspace'&&readMethod(method)){
    await enforceRateLimit(env,`public-filing-workspace:${request.headers.get('CF-Connecting-IP')||'unknown'}`,{limit:90});
    const result=buildPublicFilingWorkspace(url.searchParams.get('issuer')||'QI-EQUITY-AAPL',Object.fromEntries(url.searchParams));
    return responseJson(request,env,{...result,releaseSha:publicRuntimeConfigForRequest(env,request.url).releaseSha},200,{cache:'no-store'});
  }
  if(path==='discovery/event-calendar'&&readMethod(method)){
    await enforceRateLimit(env,`public-event-calendar:${request.headers.get('CF-Connecting-IP')||'unknown'}`,{limit:90});
    const result=buildPublicEventCalendar(url.searchParams.get('asset')||'QI-EQUITY-AAPL',Object.fromEntries(url.searchParams));
    return responseJson(request,env,{...result,releaseSha:publicRuntimeConfigForRequest(env,request.url).releaseSha},200,{cache:'no-store'});
  }
  if(path==='discovery/comparison-lab'&&readMethod(method)){
    await enforceRateLimit(env,`public-comparison-lab:${request.headers.get('CF-Connecting-IP')||'unknown'}`,{limit:90});
    const result=buildPublicComparisonLab(Object.fromEntries(url.searchParams));
    return responseJson(request,env,{...result,releaseSha:publicRuntimeConfigForRequest(env,request.url).releaseSha},200,{cache:'no-store'});
  }
  if(path==='discovery/alert-rules'&&readMethod(method)){
    await enforceRateLimit(env,`public-alert-rules:${request.headers.get('CF-Connecting-IP')||'unknown'}`,{limit:90});
    const result=buildPublicAlertRules(Object.fromEntries(url.searchParams));
    return responseJson(request,env,{...result,releaseSha:publicRuntimeConfigForRequest(env,request.url).releaseSha},200,{cache:'no-store'});
  }

  const session=await resolveSession(request,env,{required:true});
  await enforceRateLimit(env,`user:${session.user.id}:${path}`);
  const qelly=await bootstrapContext(env,session);
  if(path==='session/context'&&method==='GET')return responseJson(request,env,qelly,200,{cookies:session.cookies});
  if(path==='preferences/layout')throw new HttpError(503,'preferences_route_owner_mismatch','Preferences are owned by the dedicated /api/v1/preferences/layout function; the generic API fallback will not return browser-local defaults.',{retryable:false});
  if(path==='sessions'&&method==='GET')return responseJson(request,env,{scope:'current-session-only',items:[{sessionId:`supabase-${session.user.id.slice(0,8)}`,authenticationMethod:'supabase-email-password',expiresAt:new Date(Number(session.claims.exp)*1000).toISOString(),current:true,revokedAt:null}]});
  const data=await handleData(context,path,segments,method,session,qelly);
  if(data)return data;
  const evidence=await handleEvidence(context,path,segments,method,session,qelly);
  if(evidence)return evidence;
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
export const __test=Object.freeze({route,stableUuid,validateJwtClaims,publicTruthState,publicProviderEnvelope,externalTruthState,macroObservation,readMethod,publicMarketNetwork,...__dataTest,...__evidenceTest});
