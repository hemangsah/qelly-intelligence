export function readinessSnapshot(runtime){
  const authState=runtime.capabilities.emailDelivery
    ?'email_delivery_configured_not_end_to_end_proven'
    :'email_delivery_fail_closed';
  const liveProvidersRequired=runtime.capabilities.liveProviders===true;
  const providerState=liveProvidersRequired
    ?'configured_but_freshness_not_proven'
    :'intentionally_unavailable_rights_restricted';
  const checks=Object.freeze({
    supabase:Object.freeze({required:true,configured:true,proven:false,state:'configured_not_live_canaried'}),
    authEmail:Object.freeze({required:true,configured:runtime.capabilities.emailDelivery,proven:false,state:authState}),
    rlsIsolation:Object.freeze({required:true,configured:true,proven:false,state:'required_not_live_proven'}),
    providerFreshness:Object.freeze({
      required:liveProvidersRequired,
      configured:liveProvidersRequired,
      proven:!liveProvidersRequired,
      state:providerState
    })
  });
  return Object.freeze({
    ready:false,
    status:'not_proven',
    reason:'Production readiness remains fail-closed until required end-to-end canaries and policy evidence pass.',
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
