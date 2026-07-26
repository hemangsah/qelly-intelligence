const fixtureCapabilities = new Set(['search','quote','timeseries','stream','mapping','reference']);

export class EntitlementEngine {
  evaluate(input) {
    const {
      tenantId, workspaceId, providerId, capability, use = 'display',
      entitlementClass = 'development-fixture', territory = 'IN', userClass = 'internal-user'
    } = input ?? {};
    const reasons = [];
    const obligations = ['show-attribution','show-freshness','retain-audit'];
    if (!tenantId || !workspaceId) reasons.push('tenant-and-workspace-required');
    if (!providerId || !capability) reasons.push('provider-and-capability-required');
    if (entitlementClass !== 'development-fixture') reasons.push('licensed-entitlement-not-configured');
    if (!fixtureCapabilities.has(capability)) reasons.push('capability-not-entitled');
    if (['redistribution','external-export'].includes(use)) reasons.push('redistribution-not-entitled');
    if (use === 'export') obligations.push('watermark-development-fixture','disable-redistribution');
    if (territory !== 'IN') obligations.push('territory-review-required');
    if (userClass !== 'internal-user') obligations.push('user-class-review-required');
    const allowed = reasons.length === 0;
    return {
      decision: allowed ? 'allow-with-obligations' : 'deny',
      allowed,
      reasons,
      obligations: allowed ? obligations : [],
      evaluatedAt: new Date().toISOString(),
      policyVersion: 'qelly-entitlement-1.0.0',
      input: { tenantId, workspaceId, providerId, capability, use, entitlementClass, territory, userClass }
    };
  }
}
