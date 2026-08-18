import {AUTH_EMAIL_CANARY,CANONICAL_QELLY_PUBLIC_SITE} from './email-capability.js';
import {providerResult} from './providers.js';
import {fetcher} from './runtime.js';

export const RLS_ISOLATION_CANARY=Object.freeze({
  proven:true,
  verifiedAt:'2026-08-14',
  scope:'canonical-production',
  method:'two-identity-workspace-owner-isolation'
});

const ECB_REFERENCE_MAX_AGE_MS=7*24*60*60*1000;
const canonicalOrigin=(value)=>{
  try{return new URL(String(value||'')).origin;}
  catch{return '';}
};
const isCanonicalProduction=(runtime)=>canonicalOrigin(runtime?.publicSiteUrl)===CANONICAL_QELLY_PUBLIC_SITE;
const frozenEvidence=(value={})=>Object.freeze({...value});

const supabaseHealthCanary=async(context,runtime)=>{
  if(!runtime?.supabaseUrl||!runtime?.supabasePublishableKey)return frozenEvidence({proven:false,state:'supabase_runtime_not_configured'});
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),5000);
  try{
    const response=await fetcher(context.env)(`${runtime.supabaseUrl}/auth/v1/health`,{
      method:'GET',
      headers:{apikey:runtime.supabasePublishableKey,Accept:'application/json'},
      signal:controller.signal
    });
    if(!response.ok)return frozenEvidence({proven:false,state:`supabase_auth_health_http_${response.status}`});
    const contentType=(response.headers.get('content-type')||'').toLowerCase();
    if(!contentType.includes('json'))return frozenEvidence({proven:false,state:'supabase_auth_health_content_type_invalid'});
    const payload=await response.json().catch(()=>null);
    if(!payload||typeof payload!=='object')return frozenEvidence({proven:false,state:'supabase_auth_health_payload_invalid'});
    return frozenEvidence({proven:true,state:'supabase_auth_health_proven',checkedAt:new Date().toISOString(),endpoint:'auth-health'});
  }catch(error){
    return frozenEvidence({proven:false,state:error?.name==='AbortError'?'supabase_auth_health_timeout':'supabase_auth_health_unavailable'});
  }finally{clearTimeout(timeout);}
};

const ecbFreshnessCanary=async(context)=>{
  try{
    const result=await providerResult(context,'ecb','fx-reference-rates','EUR');
    const truthState=String(result?.truthState||'unavailable');
    const observedAt=Date.parse(String(result?.observationTime||''));
    const ageMs=Number.isFinite(observedAt)?Date.now()-observedAt:Number.POSITIVE_INFINITY;
    const rates=result?.data?.rates;
    const rateCount=rates&&typeof rates==='object'?Object.keys(rates).length:0;
    const acceptableTruth=new Set(['live_provider','cached_provider','delayed_provider']);
    const proven=acceptableTruth.has(truthState)&&ageMs>=-6*60*60*1000&&ageMs<=ECB_REFERENCE_MAX_AGE_MS&&rateCount>=5;
    return frozenEvidence({
      proven,
      state:proven?'ecb_reference_freshness_proven':'ecb_reference_freshness_not_proven',
      provider:'ecb',
      truthState,
      observedAt:Number.isFinite(observedAt)?new Date(observedAt).toISOString():null,
      rateCount,
      scope:'read_only_attributed_reference_data',
      transactionUse:'not_for_transaction_execution'
    });
  }catch{
    return frozenEvidence({proven:false,state:'ecb_reference_freshness_unavailable',provider:'ecb'});
  }
};

export async function collectReadinessEvidence(context,runtime){
  const canonical=isCanonicalProduction(runtime);
  if(!canonical){
    return Object.freeze({
      supabase:frozenEvidence({proven:false,state:'canonical_production_scope_required'}),
      authEmail:frozenEvidence({proven:false,state:'canonical_production_scope_required'}),
      rlsIsolation:frozenEvidence({proven:false,state:'canonical_production_scope_required'}),
      providerFreshness:frozenEvidence({proven:false,state:'canonical_production_scope_required'})
    });
  }
  const [supabase,providerFreshness]=await Promise.all([
    supabaseHealthCanary(context,runtime),
    runtime.capabilities.liveProviders===true?ecbFreshnessCanary(context):Promise.resolve(frozenEvidence({proven:true,state:'intentionally_unavailable_rights_restricted'}))
  ]);
  const emailConfigured=runtime.capabilities.emailDelivery===true;
  const emailEvidenceProven=emailConfigured&&AUTH_EMAIL_CANARY.proven===true&&AUTH_EMAIL_CANARY.readinessEvidence===true;
  const authEmail=frozenEvidence({
    proven:emailEvidenceProven,
    state:emailConfigured
      ?emailEvidenceProven?'email_delivery_canary_proven':'email_delivery_configured_not_end_to_end_proven'
      :'email_delivery_fail_closed',
    verifiedAt:AUTH_EMAIL_CANARY.verifiedAt,
    scope:AUTH_EMAIL_CANARY.scope,
    provider:AUTH_EMAIL_CANARY.provider,
    evidenceMethod:AUTH_EMAIL_CANARY.evidenceMethod||null,
    readinessEvidence:AUTH_EMAIL_CANARY.readinessEvidence===true,
    capabilityAuthority:AUTH_EMAIL_CANARY.capabilityAuthority===true
  });
  const rlsIsolation=frozenEvidence({
    proven:RLS_ISOLATION_CANARY.proven===true,
    state:RLS_ISOLATION_CANARY.proven===true?'rls_isolation_canary_proven':'rls_isolation_not_proven',
    verifiedAt:RLS_ISOLATION_CANARY.verifiedAt,
    scope:RLS_ISOLATION_CANARY.scope,
    method:RLS_ISOLATION_CANARY.method
  });
  return Object.freeze({supabase,authEmail,rlsIsolation,providerFreshness});
}

const check=(required,configured,proof,states)=>Object.freeze({
  required,
  configured,
  proven:required?configured&&proof?.proven===true:true,
  state:required
    ?configured
      ?proof?.proven===true?states.proven:(proof?.state||states.unproven)
      :states.unconfigured
    :states.notRequired,
  evidence:proof?Object.freeze({...proof}):null
});

export function readinessSnapshot(runtime,evidence={}){
  const liveProvidersRequired=runtime.capabilities.liveProviders===true;
  const checks=Object.freeze({
    supabase:check(true,Boolean(runtime.supabaseUrl&&runtime.supabasePublishableKey),evidence.supabase,{
      proven:'supabase_auth_health_proven',unproven:'configured_not_live_canaried',unconfigured:'supabase_runtime_not_configured',notRequired:'not_required'
    }),
    authEmail:check(true,runtime.capabilities.emailDelivery===true,evidence.authEmail,{
      proven:'email_delivery_canary_proven',unproven:'email_delivery_configured_not_end_to_end_proven',unconfigured:'email_delivery_fail_closed',notRequired:'not_required'
    }),
    rlsIsolation:check(true,true,evidence.rlsIsolation,{
      proven:'rls_isolation_canary_proven',unproven:'required_not_live_proven',unconfigured:'rls_isolation_not_configured',notRequired:'not_required'
    }),
    providerFreshness:check(liveProvidersRequired,liveProvidersRequired,evidence.providerFreshness,{
      proven:'ecb_reference_freshness_proven',unproven:'configured_but_freshness_not_proven',unconfigured:'live_provider_runtime_not_configured',notRequired:'intentionally_unavailable_rights_restricted'
    })
  });
  const failed=Object.entries(checks).filter(([,value])=>value.required&&(!value.configured||!value.proven)).map(([name])=>name);
  const ready=failed.length===0;
  return Object.freeze({
    ready,
    status:ready?'ready':'not_proven',
    reason:ready
      ?'Required production dependencies have live or explicitly dated production evidence.'
      :`Production readiness remains fail-closed; required evidence is missing for: ${failed.join(', ')}.`,
    checks,
    dependencies:Object.freeze({
      supabase:checks.supabase.state,
      auth:checks.authEmail.state,
      rls:checks.rlsIsolation.state,
      providers:checks.providerFreshness.state
    }),
    capabilities:Object.freeze({
      authentication:runtime.capabilities.authentication,
      emailDelivery:runtime.capabilities.emailDelivery,
      cloudSync:runtime.capabilities.cloudSync,
      liveProviders:runtime.capabilities.liveProviders
    }),
    releaseSha:runtime.releaseSha
  });
}
