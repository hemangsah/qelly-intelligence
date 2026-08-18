import {CSRF_COOKIE,cookie,errorResponse,parseCookies,resolveSession,responseJson} from '../../_lib/runtime.js';
import {effectivePublicRuntimeConfig} from '../../_lib/email-capability.js';
import {buildPublicConfigPayload} from '../../_lib/config-payload.js';

const CONFIG_ROUTE_CONTRACT=Object.freeze({
  defaultRoute:'market',
  csrfMode:'double-submit-cookie',
  fabricatedMarketFallback:false,
  deterministicExamplesRestrictedToAnalyticalTools:true
});

export async function onRequest(context){
  const {request,env}=context;
  try{
    if(request.method.toUpperCase()!=='GET')return context.next();
    const runtime=effectivePublicRuntimeConfig(env,request.url);
    const session=runtime.capabilities.authentication===true?await resolveSession(request,env):null;
    const csrf=parseCookies(request)[CSRF_COOKIE]||crypto.randomUUID().replaceAll('-','');
    const authenticated=Boolean(session);
    const payload=buildPublicConfigPayload(env,request.url,session,csrf,{runtime});
    if(payload.defaultRoute!==CONFIG_ROUTE_CONTRACT.defaultRoute||payload.dataStatePolicy.fabricatedMarketFallback!==CONFIG_ROUTE_CONTRACT.fabricatedMarketFallback||payload.dataStatePolicy.deterministicExamplesRestrictedToAnalyticalTools!==CONFIG_ROUTE_CONTRACT.deterministicExamplesRestrictedToAnalyticalTools)throw new Error('config_route_contract_mismatch');
    if(authenticated&&payload.csrf.mode!==CONFIG_ROUTE_CONTRACT.csrfMode)throw new Error('config_csrf_contract_mismatch');
    return responseJson(request,env,payload,200,{
      cookies:[...(session?.cookies||[]),...(authenticated?[cookie(CSRF_COOKIE,csrf,{httpOnly:false,maxAge:60*60*8,sameSite:'Strict'})]:[])]
    });
  }catch(error){return errorResponse(request,env,error);}
}
