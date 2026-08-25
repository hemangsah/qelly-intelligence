const EXACT_COPY=Object.freeze({
  blocked_pending_redistribution_rights:'Market data display is awaiting redistribution approval.',
  provider_redistribution_rights_not_verified:'Market data display is awaiting redistribution approval.',
  blocked_pending_written_end_user_display_permission:'End-user display is awaiting written provider approval.',
  provider_end_user_display_rights_not_verified:'End-user display is awaiting written provider approval.',
  conditionally_approved_attributed_reference_data:'Approved for attributed reference use.',
  commercial_use_allowed_under_current_public_api_terms:'Available under current public API terms with source attribution.',
  supabase_auth_health_proven:'Account service available.',
  email_delivery_canary_proven:'Account email delivery verified.',
  rls_isolation_canary_proven:'Private workspace protection verified.',
  ecb_reference_freshness_proven:'Reference rates are current.',
  unavailable_pending_primary_source_reverification:'Primary source review in progress.',
  unavailable_pending_scheme_specific_primary_source_reverification:'Scheme-specific source review in progress.',
  canonical_production_scope_required:'Available in the production workspace.',
  configured_not_live_canaried:'Configured; live verification is pending.',
  no_blocking_reason:'No restrictions reported.'
});

const normalize=(value)=>String(value??'').trim();

export function humanizeOperationalState(value,{fallback='Status is being verified.'}={}){
  const raw=normalize(value);
  if(!raw)return fallback;
  const normalized=raw.toLowerCase();
  const exact=EXACT_COPY[normalized]
    ||(normalized.startsWith('commercial_use_allowed_under_current_public_api_terms')?EXACT_COPY.commercial_use_allowed_under_current_public_api_terms:null);
  if(exact)return exact;
  const readable=raw
    .replace(/https?:\/\/\S+/gi,'')
    .replace(/[_-]+/g,' ')
    .replace(/\s+/g,' ')
    .trim()
    .toLowerCase();
  if(!readable)return fallback;
  return `${readable.charAt(0).toUpperCase()}${readable.slice(1)}${/[.!?]$/.test(readable)?'':'.'}`;
}

export function providerPolicyMessage(provider){
  const state=provider?.termsState||provider?.policyState||provider?.reason;
  return humanizeOperationalState(state,{fallback:provider?.enabled?'Approved for customer display.':'Provider approval is pending.'});
}

export function providerAvailability(provider){
  if(provider?.enabled&&String(provider?.id||'').toLowerCase()==='ecb')return {label:'Approved reference',tone:'delayed'};
  if(provider?.enabled)return {label:'Available',tone:'live'};
  return {label:'Awaiting approval',tone:'cached'};
}

export function readinessLabel(status){
  const normalized=normalize(status).toLowerCase();
  if(normalized==='ready')return 'Available';
  if(normalized==='partial')return 'Limited';
  if(normalized==='deferred')return 'Planned';
  if(normalized==='blocked')return 'Needs attention';
  return humanizeOperationalState(normalized,{fallback:'Checking'}).replace(/\.$/,'');
}

export function truthLabel(state){
  const normalized=normalize(state).toUpperCase();
  if(['LIVE','AUDIT'].includes(normalized))return 'Verified';
  if(['DELAYED','DELAYED_PROVIDER','CACHED','CACHED_PROVIDER'].includes(normalized))return 'Reference';
  if(['STALE','PARTIAL'].includes(normalized))return 'Review needed';
  if(['UNAVAILABLE','BLOCKED','DENY'].includes(normalized))return 'Not available';
  return humanizeOperationalState(state,{fallback:'Checking'}).replace(/\.$/,'');
}

export function authenticationMethodLabel(value){
  const normalized=normalize(value).toLowerCase();
  if(normalized.includes('email')&&normalized.includes('password'))return 'Email and password';
  if(normalized.includes('magic'))return 'Email sign-in link';
  if(normalized.includes('oauth'))return 'Connected account';
  return normalized?'Secure sign-in':'Signed-in session';
}

export function assuranceLabel(value){
  const normalized=normalize(value).toLowerCase();
  if(normalized==='email'||normalized.includes('email'))return 'Email verified';
  if(normalized.includes('aal2')||normalized.includes('multi'))return 'Enhanced protection';
  return 'Standard protection';
}

export const __customerCopyTest=Object.freeze({EXACT_COPY});
