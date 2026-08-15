import {providerCatalog} from './providers.js';
import {readinessSnapshot} from './readiness.js';

const gate=(id,label,status,detail,{kind='infrastructure',truthState=null,observedAt=null,required=true}={})=>Object.freeze({
  id,label,status,detail,kind,truthState,observedAt,required
});

const statusForProof=(check,{optionalStatus='deferred',failureStatus='blocked'}={})=>{
  if(!check?.required)return optionalStatus;
  if(check?.configured&&check?.proven)return 'ready';
  return failureStatus;
};

const providerPolicyState=(policy)=>{
  if(policy?.enabled&&policy?.id==='ecb')return 'approved-reference';
  if(policy?.enabled)return 'enabled';
  if(String(policy?.termsState||'').startsWith('blocked_'))return 'rights-restricted';
  return 'unavailable';
};

const providerHealthState=(policy,evidence)=>{
  if(!policy?.enabled)return 'not-called-policy-disabled';
  if(policy.id==='ecb')return evidence?.state||'reference-freshness-unproven';
  return 'enabled-health-not-sampled';
};

const providerTruthState=(policy,evidence)=>{
  if(!policy?.enabled)return 'UNAVAILABLE';
  if(policy.id==='ecb'){
    const state=String(evidence?.truthState||'').toUpperCase();
    if(state==='DELAYED_PROVIDER')return 'DELAYED';
    if(state==='CACHED_PROVIDER')return 'CACHED';
    if(state==='STALE_PROVIDER')return 'STALE';
    if(state==='LIVE_PROVIDER')return 'LIVE';
    return evidence?.proven?'DELAYED':'UNAVAILABLE';
  }
  return 'UNAVAILABLE';
};

export function platformReadinessSnapshot(runtime,evidence={},policies=providerCatalog()){
  const readiness=readinessSnapshot(runtime,evidence);
  const policyById=new Map(policies.map((policy)=>[policy.id,policy]));
  const ecb=policyById.get('ecb');
  const ecbCheck=readiness.checks.providerFreshness;
  const gates=[
    gate('cloudflare-runtime','Cloudflare Pages Functions',runtime.releaseSha&&runtime.releaseSha!=='unresolved'?'ready':'partial',`${runtime.environment} · release ${runtime.releaseSha||'unresolved'}`,{kind:'runtime',truthState:'LIVE'}),
    gate('supabase','Supabase Auth / persistence',statusForProof(readiness.checks.supabase),readiness.checks.supabase.state,{kind:'infrastructure',truthState:readiness.checks.supabase.proven?'LIVE':'UNAVAILABLE'}),
    gate('auth-email','Authentication email delivery',statusForProof(readiness.checks.authEmail),readiness.checks.authEmail.state,{kind:'infrastructure',truthState:readiness.checks.authEmail.proven?'AUDIT':'UNAVAILABLE',observedAt:readiness.checks.authEmail.evidence?.verifiedAt||null}),
    gate('rls-isolation','Workspace RLS isolation',statusForProof(readiness.checks.rlsIsolation),readiness.checks.rlsIsolation.state,{kind:'security',truthState:readiness.checks.rlsIsolation.proven?'AUDIT':'UNAVAILABLE',observedAt:readiness.checks.rlsIsolation.evidence?.verifiedAt||null}),
    gate('ecb-reference','ECB reference-rate freshness',statusForProof(ecbCheck,{optionalStatus:'deferred',failureStatus:'partial'}),ecbCheck.state,{kind:'reference-data',truthState:providerTruthState(ecb,evidence.providerFreshness),observedAt:evidence.providerFreshness?.observedAt||null,required:ecbCheck.required}),
    gate('binance-market-data','Binance market display rights',policyById.get('binance')?.enabled?'ready':'deferred',policyById.get('binance')?.reason||policyById.get('binance')?.termsState||'enabled',{kind:'market-data-rights',truthState:policyById.get('binance')?.enabled?'LIVE':'UNAVAILABLE',required:false}),
    gate('coinbase-market-data','Coinbase market display rights',policyById.get('coinbase')?.enabled?'ready':'deferred',policyById.get('coinbase')?.reason||policyById.get('coinbase')?.termsState||'enabled',{kind:'market-data-rights',truthState:policyById.get('coinbase')?.enabled?'LIVE':'UNAVAILABLE',required:false}),
    gate('governed-demo','Qelly governed demonstration', 'ready','Deterministic local market observations remain explicitly SIMULATED and non-executable.',{kind:'fallback',truthState:'SIMULATED',required:false})
  ];
  const summary=gates.reduce((counts,item)=>({...counts,[item.status]:(counts[item.status]||0)+1}),{ready:0,partial:0,deferred:0,blocked:0});
  const providers=policies.map((policy)=>Object.freeze({
    id:policy.id,
    enabled:Boolean(policy.enabled),
    capabilities:[...(policy.capabilities||[])],
    policyState:providerPolicyState(policy),
    healthState:providerHealthState(policy,evidence.providerFreshness),
    truthState:providerTruthState(policy,evidence.providerFreshness),
    observedAt:policy.id==='ecb'?evidence.providerFreshness?.observedAt||null:null,
    termsState:policy.termsState||null,
    reason:policy.reason||null,
    termsUrl:policy.termsUrl||null
  }));
  providers.push(Object.freeze({
    id:'qelly-governed-demo',
    enabled:true,
    capabilities:['deterministic-demonstration'],
    policyState:'governed-fallback',
    healthState:'available-local',
    truthState:'SIMULATED',
    observedAt:null,
    termsState:'internal-governed-demonstration',
    reason:'Used only when an approved live/display provider is unavailable or intentionally not selected.',
    termsUrl:null
  }));
  return Object.freeze({
    generatedAt:new Date().toISOString(),
    releaseSha:runtime.releaseSha,
    environment:runtime.environment,
    canonicalSite:runtime.publicSiteUrl,
    ready:readiness.ready,
    readinessStatus:readiness.status,
    readinessReason:readiness.reason,
    summary:Object.freeze(summary),
    gates:Object.freeze(gates),
    providers:Object.freeze(providers),
    safety:Object.freeze({
      readOnly:true,
      tradeExecution:false,
      automatedTrading:false,
      custody:false,
      transfers:false,
      withdrawals:false,
      walletSigning:false,
      privateKeys:false,
      recoveryPhrases:false
    })
  });
}

export const __platformReadinessTest=Object.freeze({statusForProof,providerPolicyState,providerHealthState,providerTruthState});
