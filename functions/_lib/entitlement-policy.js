const DIMENSIONS=Object.freeze(['provider','capability','use','provider-rights','truth-state']);
const OBLIGATIONS=Object.freeze(['read-only','source-attribution','preserve-truth-state','respect-provider-rights','no-execution']);

export const entitlementContract=()=>({
  contract:'qelly-provider-entitlements-v1',
  decision:'DENY_BY_DEFAULT',
  evaluation:'Server-side policy evaluation before governed provider data may be used or redistributed.',
  dimensions:[...DIMENSIONS],
  obligations:[...OBLIGATIONS],
  rules:{
    execution:'DENY',
    custody:'DENY',
    moneyMovement:'DENY',
    unverifiedRedistribution:'DENY',
    approvedReferenceDisplay:'ALLOW_WITH_OBLIGATIONS'
  }
});

export function evaluateEntitlement(input={}){
  const providerId=String(input.providerId||'').toLowerCase();
  const capability=String(input.capability||'').toLowerCase();
  const use=String(input.use||'').toLowerCase();
  const executionUse=['trade','execution','order','transfer','withdrawal','custody','wallet-signing'].some((value)=>use.includes(value)||capability.includes(value));
  if(executionUse)return {allowed:false,decision:'DENY',reasons:['Qelly is read-only and does not permit execution, custody, signing or money movement.'],obligations:[...OBLIGATIONS]};
  if(providerId==='ecb'&&['fx-reference-rates','reference-rate','reference'].includes(capability)&&['display','research','analytics','reference'].includes(use)){
    return {allowed:true,decision:'ALLOW_WITH_OBLIGATIONS',reasons:[],obligations:[...OBLIGATIONS,'ecb-attribution','reference-cadence-disclosure']};
  }
  return {allowed:false,decision:'DENY',reasons:['No production entitlement matches the requested provider, capability and use.'],obligations:[...OBLIGATIONS]};
}

export const __entitlementPolicyTest=Object.freeze({DIMENSIONS,OBLIGATIONS});
