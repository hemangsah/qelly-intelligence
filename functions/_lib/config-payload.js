import {effectivePublicRuntimeConfig} from './email-capability.js';

export function buildPublicConfigPayload(env,requestUrl,session,csrf,{runtime=effectivePublicRuntimeConfig(env,requestUrl)}={}){
  const authentication=runtime.capabilities.authentication===true;
  const emailDelivery=authentication&&runtime.capabilities.emailDelivery===true;
  const authenticated=authentication&&Boolean(session);
  return {
    productName:'Qelly Intelligence',
    productVersion:'0.9.0-preview.1',
    release:runtime.releaseSha,
    defaultRoute:'market',
    csrf:{header:'X-Qelly-CSRF',token:authenticated?csrf:null,mode:authenticated?'double-submit-cookie':'unavailable-until-authenticated'},
    auth:{authenticated,backendAvailable:authentication,productionIdentityEnabled:authentication,emailDeliveryAvailable:emailDelivery,registrationAvailable:emailDelivery,recoveryAvailable:emailDelivery,mode:'supabase-auth-cloudflare-facade'},
    cloud:{available:true,syncAvailable:runtime.capabilities.cloudSync===true,providerRuntime:true},
    capabilityTruth:{passkeys:false,mfa:false,research:authentication&&runtime.capabilities.cloudSync===true,persistentJobs:false,productionNotifications:false,multiSessionManagement:false},
    providerRights:{binance:'blocked_pending_redistribution_rights',coinbase:'blocked_pending_written_end_user_display_permission',ecb:'conditionally_approved_attributed_reference_data'},
    runtime,
    dataStatePolicy:{connectedProduction:true,fabricatedMarketFallback:false,designSampleStateRuntime:false,deterministicExamplesRestrictedToAnalyticalTools:true},
    states:['default','loading','empty','partial','error','offline','live','reference','cached','stale','delayed','unavailable','mobile','reduced-motion','high-contrast'],
    liveTrading:false
  };
}
