import {publicRuntimeConfigForRequest,responseJson} from '../../../_lib/runtime.js';
import {providerCatalog} from '../../../_lib/providers.js';

const legacyProviderItem=(provider,runtime)=>{
  const enabled=Boolean(provider.enabled&&runtime.capabilities.liveProviders);
  const reference=provider.id==='ecb';
  return {
    providerId:provider.id,
    displayName:provider.id==='ecb'?'European Central Bank':provider.id==='binance'?'Binance':'Coinbase Exchange',
    status:enabled?'enabled':'disabled',
    selectionRole:enabled?(reference?'reference':'market-data'):'rights-blocked',
    capabilities:[...(provider.capabilities||[])],
    breaker:{state:enabled?'not-observed':'disabled',failureCount:null},
    quality:{
      score:null,
      latencyMs:null,
      failureCount:null,
      quotaRemaining:null,
      lastSuccessAt:null,
      observedAt:null,
      status:enabled?'UNMEASURED':'NOT_CALLED',
      freshnessClass:enabled?(reference?'daily-reference-schedule-not-verified':'provider-defined-not-measured'):'unavailable',
      boundary:'Policy inventory only. This endpoint has not probed availability, latency, quotas, request failures or source freshness.'
    },
    termsState:provider.termsState||null,
    reason:provider.reason||null,
    termsUrl:provider.termsUrl||null,
    truthState:enabled?(reference?'DELAYED':'LIVE'):'UNAVAILABLE',
    execution:false
  };
};

const runtimeProviderInventory=(runtime)=>{
  const providers=providerCatalog().map((provider)=>({
    id:provider.id,
    enabled:Boolean(provider.enabled&&runtime.capabilities.liveProviders),
    policyEnabled:Boolean(provider.enabled),
    capabilities:[...(provider.capabilities||[])],
    termsState:provider.termsState||null,
    reason:provider.reason||null,
    termsUrl:provider.termsUrl||null,
    runtimeState:provider.enabled&&runtime.capabilities.liveProviders?(provider.id==='ecb'?'REFERENCE_ENABLED':'ENABLED'):'UNAVAILABLE',
    healthState:provider.enabled&&runtime.capabilities.liveProviders?'UNMEASURED':'NOT_CALLED',
    observedAt:null
  }));
  return {
    generatedAt:new Date().toISOString(),
    releaseSha:runtime.releaseSha,
    environment:runtime.environment,
    canonicalSite:runtime.publicSiteUrl,
    truthState:'AUDIT',
    liveProviderFeatureEnabled:Boolean(runtime.capabilities.liveProviders),
    providers,
    items:providerCatalog().map((provider)=>legacyProviderItem(provider,runtime)),
    guardrails:{readOnly:true,execution:false,credentialsExposed:false,policyDisabledProvidersAreNotCalled:true,healthMetricsAreMeasured:false,providerProbesPerformed:false}
  };
};

export async function onRequest(context){
  const {request,env}=context;
  if(request.method.toUpperCase()!=='GET')return context.next();
  const runtime=publicRuntimeConfigForRequest(env,request.url);
  return responseJson(request,env,runtimeProviderInventory(runtime),200,{cache:'no-store'});
}

export const __providerRuntimeTest=Object.freeze({runtimeProviderInventory,legacyProviderItem});
