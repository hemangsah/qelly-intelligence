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
    breaker:{state:enabled?'closed':'disabled'},
    quality:{
      score:enabled?100:0,
      latencyMs:'n/a ',
      freshnessClass:enabled?(reference?'daily-reference':'provider-defined'):'unavailable'
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
    runtimeState:provider.enabled&&runtime.capabilities.liveProviders?(provider.id==='ecb'?'REFERENCE_ENABLED':'ENABLED'):'UNAVAILABLE'
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
    guardrails:{readOnly:true,execution:false,credentialsExposed:false,policyDisabledProvidersAreNotCalled:true}
  };
};

export async function onRequest(context){
  const {request,env}=context;
  if(request.method.toUpperCase()!=='GET')return context.next();
  const runtime=publicRuntimeConfigForRequest(env,request.url);
  return responseJson(request,env,runtimeProviderInventory(runtime),200,{cache:'no-store'});
}

export const __providerRuntimeTest=Object.freeze({runtimeProviderInventory,legacyProviderItem});
