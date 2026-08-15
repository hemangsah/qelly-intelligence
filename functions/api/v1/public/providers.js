import {responseJson} from '../../../_lib/runtime.js';
import {providerCatalog} from '../../../_lib/providers.js';

const publicProviderInventory=()=>({
  generatedAt:new Date().toISOString(),
  canonicalRuntime:'cloudflare-pages-functions',
  truthState:'AUDIT',
  providers:providerCatalog().map((provider)=>({
    id:provider.id,
    enabled:Boolean(provider.enabled),
    capabilities:[...(provider.capabilities||[])],
    termsState:provider.termsState||null,
    reason:provider.reason||null,
    termsUrl:provider.termsUrl||null,
    presentationState:provider.enabled?(provider.id==='ecb'?'REFERENCE':'ENABLED'):'UNAVAILABLE'
  })),
  guardrails:{readOnly:true,execution:false,credentialsExposed:false,rightsRestrictionsHonored:true}
});

export async function onRequest(context){
  const {request,env}=context;
  if(request.method.toUpperCase()!=='GET')return context.next();
  return responseJson(request,env,publicProviderInventory(),200,{cache:'public, max-age=60, stale-while-revalidate=300'});
}

export const __publicProvidersTest=Object.freeze({publicProviderInventory});
