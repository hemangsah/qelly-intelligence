import {bool,publicRuntimeConfig} from './runtime.js';

export const CANONICAL_QELLY_PUBLIC_SITE='https://qelly-intelligence.pages.dev';
export const AUTH_EMAIL_CANARY=Object.freeze({
  proven:true,
  verifiedAt:'2026-08-14',
  scope:'canonical-production',
  provider:'supabase-auth-custom-smtp'
});

const normalizedSite=(value)=>{
  try{return new URL(String(value||'')).origin;}
  catch{return '';}
};

export const emailDeliveryAvailable=(env={},requestUrl='https://qelly.invalid/')=>{
  const explicit=String(env.QELLY_ENABLE_AUTH_EMAIL_DELIVERY??'').trim();
  if(explicit)return bool(explicit,false);
  const site=normalizedSite(env.QELLY_PUBLIC_SITE_URL)||normalizedSite(requestUrl);
  return AUTH_EMAIL_CANARY.proven&&site===CANONICAL_QELLY_PUBLIC_SITE;
};

export const effectivePublicRuntimeConfig=(env={},requestUrl='https://qelly.invalid/')=>{
  const runtime=publicRuntimeConfig(env,requestUrl);
  const emailDelivery=emailDeliveryAvailable(env,requestUrl);
  if(runtime.capabilities.emailDelivery===emailDelivery)return runtime;
  return Object.freeze({...runtime,capabilities:Object.freeze({...runtime.capabilities,emailDelivery})});
};
