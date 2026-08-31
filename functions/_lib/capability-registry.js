const capability=(id,label,category,priority,routeFamilies,reason,implementedExceptions=[])=>Object.freeze({
  id,label,category,priority,state:'UNAVAILABLE',canonicalRuntime:'cloudflare-pages-functions',routeFamilies:Object.freeze(routeFamilies),implementedExceptions:Object.freeze(implementedExceptions),reason
});

export const unavailableCapabilities=Object.freeze([
  capability('access-entitlements','Advanced access & entitlement evaluation','governance','high',['access/**','entitlements/**'],'The canonical runtime exposes the governed entitlement evaluation endpoint; additional access and entitlement surfaces remain unpromoted.',['entitlements/evaluate']),
  capability('alerts-notifications','Alerts & notifications','operations','medium',['alerts/**','notifications/**','notification-schedules/**'],'Persistent alert evaluation and notification delivery require a production worker/scheduler and storage contract that is not yet enabled.'),
  capability('asset-intelligence','Protected asset intelligence datasets','market-intelligence','high',['asset-intelligence/**','discovery/asset-intelligence'],'The protected legacy chart, filing and fundamental fixture APIs remain unpromoted; the provider-rights-safe public diligence router is available.',['discovery/asset-intelligence']),
  capability('audit-verification','Audit verification','evidence','high',['audit','audit/**'],'The local audit ledger/verification service is not yet available through the canonical Cloudflare API.'),
  capability('mfa','Authenticator MFA & recovery codes','identity','critical',['auth/mfa/**'],'The complete production TOTP enrollment, confirmation, recovery-code and revocation ceremony is not implemented in Cloudflare Functions.'),
  capability('step-up','Step-up authentication simulation','identity','low',['auth/step-up/**'],'Simulation-only step-up authentication is intentionally not exposed by the canonical production runtime.'),
  capability('contracts','Additional runtime contracts','governance','medium',['contracts/**'],'The canonical entitlement contract is promoted; the remaining local contract registry is not yet canonical.',['contracts/entitlements']),
  capability('delivery-jobs','Delivery, jobs & storage operations','operations','medium',['delivery/**','delivery-attempts','jobs','jobs/**','storage/status'],'Persistent delivery jobs/background workers are not implemented in this Cloudflare Pages release.'),
  capability('devices','Device inventory','identity','medium',['devices','devices/**'],'Multi-device identity inventory and remote device revocation are not implemented.'),
  capability('discovery','Additional discovery intelligence','discovery','high',['discovery/**'],'Selected provider-rights-safe discovery contracts are promoted; local fixture and persistence surfaces remain unavailable.',['discovery/asset-intelligence']),
  capability('imports','Import center','data-management','medium',['imports','imports/**'],'The local import pipeline has not yet been promoted to the canonical runtime.'),
  capability('observability','Application observability','operations','medium',['observability/**'],'Production log/trace query APIs are not exposed to the browser in this release.'),
  capability('onboarding','Profile onboarding','identity','high',['onboarding/**'],'The local onboarding profile/catalog workflow is not yet backed by a canonical Cloudflare persistence contract.'),
  capability('platform-assurance','Staging assurance & migrations','operations','low',['platform/assurance','platform/migrations/**','platform/staging-manifest'],'Staging assurance and migration-control surfaces are deployment operations, not enabled end-user production APIs.'),
  capability('portfolio','Portfolio analytics','portfolio','high',['portfolio/**'],'The portfolio service has not yet been promoted with canonical holdings persistence and governed market inputs.'),
  capability('privacy','Privacy inventory & consent controls','governance','high',['privacy/**'],'Browser privacy/consent management has not yet been promoted to the canonical Cloudflare API.'),
  capability('screeners','Screeners','quant','high',['screeners/**'],'Server-side screener execution/saved screens are not yet promoted to Cloudflare. Deterministic calculator/formula/indicator engines remain separate.'),
  capability('search','Universal search','discovery','high',['search'],'Universal search is not yet backed by a canonical cross-domain index.'),
  capability('secure-imports','Secure import vault & quarantine','security','medium',['secure-imports','secure-imports/**'],'Secure import quarantine/rescan requires an accepted production file-scanning pipeline that is not yet enabled.'),
  capability('secret-protection','Secret protection rotation','security','low',['security/secret-protection/**'],'Secret rotation is an operator capability and is not exposed as an end-user production API.'),
  capability('remote-session-control','Remote session control','identity','medium',['sessions/**'],'Only the current-browser session summary is implemented; multi-device revoke/control is unavailable.'),
  capability('streams','Realtime streams','market-data','high',['streams/**'],'Bounded governed time-series history is now promoted; realtime streaming remains unavailable until a rights-safe streaming provider contract is proven.'),
  capability('workspaces','Workspace management','workspace','high',['workspaces','workspaces/**'],'Workspace switching/management beyond the bootstrapped current workspace is not yet promoted to the canonical API.')
]);

function familyMatches(path,family){
  const normalized=String(path||'').replace(/^\/+|\/+$/g,'');
  if(family.endsWith('/**')){
    const base=family.slice(0,-3);
    return normalized===base||normalized.startsWith(`${base}/`);
  }
  return normalized===family;
}

export function matchUnavailableCapability(path){
  const normalized=String(path||'').replace(/^\/+|\/+$/g,'');
  return unavailableCapabilities.find((entry)=>!entry.implementedExceptions.some((implemented)=>familyMatches(normalized,implemented))&&entry.routeFamilies.some((family)=>familyMatches(normalized,family)))||null;
}

export function capabilityInventory(){
  return {
    generatedAt:new Date().toISOString(),
    canonicalRuntime:'cloudflare-pages-functions',
    truthState:'AUDIT',
    unavailableCount:unavailableCapabilities.length,
    items:unavailableCapabilities
  };
}

export const __capabilityRegistryTest=Object.freeze({familyMatches});
