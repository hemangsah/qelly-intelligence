import {publicRuntimeConfig,responseJson} from '../../../_lib/runtime.js';
import {providerCatalog} from '../../../_lib/providers.js';

const runtimeProviderInventory=(runtime)=>({
  generatedAt:new Date().toISOString(),
  releaseSha:runtime.releaseSha,
  environment:runtime.environment,
  canonicalSite:runtime.publicSiteUrl,
  truthState:'AUDIT',
  liveProviderFeatureEnabled:Boolean(runtime.capabilities.liveProviders),
  providers:providerCatalog().map((provider)=>({
    id:provider.id,
    enabled:Boolean(provider.enabled&&runtime.capabilities.liveProviders),
    policyEnabled:Boolean(provider.enabled),
    capabilities:[...(provider.capabilities||[])],
    termsState:provider.termsState||null,
    reason:provider.reason||null,
    termsUrl:provider.termsUrl||null,
    runtimeState:provider.enabled&&runtime.capabilities.liveProviders?(provider.id==='ecb'?'REFERENCE_ENABLED':'ENABLED'):'UNAVAILABLE'
  })),
  guardrails:{readOnly:true,execution:false,credentialsExposed:false,policyDisabledProvidersAreNotCalled:true}
});

export async function onRequest(context){
  const {request,env}=context;
  if(request.method.toUpperCase()!=='GET')return context.next();
  const runtime=publicRuntimeConfig(env,request.url);
  return responseJson(request,env,runtimeProviderInventory(runtime),200,{cache:'no-store'});
}

export const __providerRuntimeTest=Object.freeze({runtimeProviderInventory});
