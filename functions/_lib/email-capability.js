import {bool,publicRuntimeConfig} from './runtime.js';

export const CANONICAL_QELLY_PUBLIC_SITE='https://qelly-intelligence.pages.dev';
export const AUTH_EMAIL_CANARY=Object.freeze({
  proven:true,
  verifiedAt:'2026-08-19T16:51:37.822699Z',
  scope:'canonical-production',
  provider:'supabase-auth-custom-smtp',
  evidenceMethod:'confirmation_sent_at_then_email_confirmed_at',
  readinessEvidence:true,
  capabilityAuthority:true
});

const canonicalOrigin=(value)=>{
  try{return new URL(String(value||'')).origin;}
  catch{return '';}
};

const hasExplicitEmailDeliverySetting=(env={})=>Object.prototype.hasOwnProperty.call(env,'QELLY_ENABLE_AUTH_EMAIL_DELIVERY');

const canonicalCanaryAuthorityAvailable=(env={},requestUrl='https://qelly.invalid/')=>
  canonicalOrigin(env.QELLY_PUBLIC_SITE_URL)===CANONICAL_QELLY_PUBLIC_SITE&&
  canonicalOrigin(requestUrl)===CANONICAL_QELLY_PUBLIC_SITE&&
  AUTH_EMAIL_CANARY.proven===true&&
  AUTH_EMAIL_CANARY.readinessEvidence===true&&
  AUTH_EMAIL_CANARY.capabilityAuthority===true;

export const emailDeliveryAvailable=(env={},requestUrl='https://qelly.invalid/')=>{
  if(hasExplicitEmailDeliverySetting(env))return bool(env.QELLY_ENABLE_AUTH_EMAIL_DELIVERY,false);
  return canonicalCanaryAuthorityAvailable(env,requestUrl);
};

export const effectivePublicRuntimeConfig=(env={},requestUrl='https://qelly.invalid/')=>{
  const runtime=publicRuntimeConfig(env,requestUrl);
  const emailDelivery=emailDeliveryAvailable(env,requestUrl);
  if(runtime.capabilities.emailDelivery===emailDelivery)return runtime;
  return Object.freeze({...runtime,capabilities:Object.freeze({...runtime.capabilities,emailDelivery})});
};
