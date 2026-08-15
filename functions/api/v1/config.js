import {CSRF_COOKIE,cookie,errorResponse,parseCookies,resolveSession,responseJson} from '../../_lib/runtime.js';
import {effectivePublicRuntimeConfig} from '../../_lib/email-capability.js';

export async function onRequest(context){
  const {request,env}=context;
  try{
    if(request.method.toUpperCase()!=='GET')return context.next();
    const session=await resolveSession(request,env);
    const csrf=parseCookies(request)[CSRF_COOKIE]||crypto.randomUUID().replaceAll('-','');
    const runtime=effectivePublicRuntimeConfig(env,request.url);
    const emailDelivery=runtime.capabilities.emailDelivery===true;
    const authenticated=Boolean(session);
    return responseJson(request,env,{
      productName:'Qelly Intelligence',
      productVersion:'0.9.0-preview.1',
      release:runtime.releaseSha,
      defaultRoute:'market',
      csrf:{header:'X-Qelly-CSRF',token:authenticated?csrf:null,mode:authenticated?'double-submit-cookie':'unavailable-until-authenticated'},
      auth:{authenticated,backendAvailable:true,productionIdentityEnabled:true,emailDeliveryAvailable:emailDelivery,registrationAvailable:emailDelivery,recoveryAvailable:emailDelivery,mode:'supabase-auth-cloudflare-facade'},
      cloud:{available:true,syncAvailable:true,providerRuntime:true},
      capabilityTruth:{passkeys:false,mfa:false,research:false,persistentJobs:false,productionNotifications:false,multiSessionManagement:false},
      providerRights:{binance:'blocked_pending_redistribution_rights',coinbase:'blocked_pending_written_end_user_display_permission',ecb:'conditionally_approved_attributed_reference_data'},
      runtime,
      states:['default','loading','empty','partial','error','offline','live','cached','stale','delayed','simulated','unavailable','mobile','reduced-motion','high-contrast'],
      liveTrading:false
    },200,{cookies:[...(session?.cookies||[]),...(authenticated?[cookie(CSRF_COOKIE,csrf,{httpOnly:false,maxAge:60*60*8,sameSite:'Strict'})]:[])]});
  }catch(error){return errorResponse(request,env,error);}
}
