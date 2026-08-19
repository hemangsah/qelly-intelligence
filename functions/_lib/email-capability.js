import {bool,publicRuntimeConfig} from './runtime.js';

export const CANONICAL_QELLY_PUBLIC_SITE='https://qelly-intelligence.pages.dev';
export const AUTH_EMAIL_CANARY=Object.freeze({
  proven:true,
  verifiedAt:'2026-08-19T16:51:37.822699Z',
  scope:'canonical-production',
  provider:'supabase-auth-custom-smtp',
  evidenceMethod:'confirmation_sent_at_then_email_confirmed_at',
  readinessEvidence:true,
  capabilityAuthority:false
});

export const emailDeliveryAvailable=(env={})=>bool(env.QELLY_ENABLE_AUTH_EMAIL_DELIVERY,false);

export const effectivePublicRuntimeConfig=(env={},requestUrl='https://qelly.invalid/')=>{
  const runtime=publicRuntimeConfig(env,requestUrl);
  const emailDelivery=emailDeliveryAvailable(env);
  if(runtime.capabilities.emailDelivery===emailDelivery)return runtime;
  return Object.freeze({...runtime,capabilities:Object.freeze({...runtime.capabilities,emailDelivery})});
};
