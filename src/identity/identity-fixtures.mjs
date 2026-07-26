export const rolePermissions = {
  viewer: ['discovery:read','market:read','instrument:read','provider:read','timeseries:read','stream:read','preference:read','workspace:read','watchlist:read','alert:read','notification:read','screener:read','portfolio:read','research:read','evidence:read'],
  analyst: ['discovery:read','discovery:write','market:read','instrument:read','provider:read','timeseries:read','stream:read','preference:read','preference:write','workspace:read','watchlist:read','watchlist:write','alert:read','alert:write','notification:read','notification:write','screener:read','screener:write','research:read','research:write','evidence:read','evidence:write','portfolio:read','quality:read','entitlement:evaluate','job:read','job:write'],
  'portfolio-manager': ['discovery:read','discovery:write','market:read','instrument:read','provider:read','preference:read','preference:write','workspace:read','watchlist:read','watchlist:write','alert:read','alert:write','notification:read','notification:write','screener:read','screener:write','research:read','research:write','evidence:read','evidence:write','quality:read','portfolio:read','portfolio:write'],
  'trader-paper': ['discovery:read','market:read','instrument:read','provider:read','workspace:read','paper-order:read','paper-order:write'],
  'compliance-reviewer': ['discovery:read','market:read','instrument:read','provider:read','timeseries:read','stream:read','observability:read','workspace:read','quality:read','audit:read','evidence:read','privacy:read','entitlement:evaluate'],
  'workspace-admin': ['discovery:read','discovery:write','market:read','instrument:read','provider:read','provider:diagnose','timeseries:read','stream:read','observability:read','preference:read','preference:write','workspace:read','workspace:switch','session:read','session:revoke','device:read','privacy:read','privacy:write','quality:read','entitlement:evaluate','job:read','job:write','evidence:read','evidence:write'],
  'organization-admin': ['*']
};

export function identitySeed() {
  const now = new Date();
  const iso = (offsetMs = 0) => new Date(now.getTime() + offsetMs).toISOString();
  return {
    version: 1,
    mode: 'local-security-foundation',
    productionIdentityEnabled: false,
    users: [{
      userId: 'user-hemang-local',
      displayName: 'Hemang Sah',
      primaryEmail: 'hemang.local@example.invalid',
      emailVerified: false,
      profileClassification: 'simulated-local-fixture',
      locale: 'en-IN',
      timezone: 'Asia/Kolkata',
      baseCurrency: 'INR',
      status: 'active',
      createdAt: iso(-30 * 24 * 60 * 60 * 1000)
    }],
    organizations: [{ organizationId: 'org-qelly-labs', name: 'Qelly Labs', status: 'local-fixture', dataResidency: 'local-only' }],
    workspaces: [
      { workspaceId: 'ws-institutional-research', organizationId: 'org-qelly-labs', name: 'Institutional Research', environment: 'research', riskTier: 'standard', status: 'active' },
      { workspaceId: 'ws-provider-operations', organizationId: 'org-qelly-labs', name: 'Provider Operations', environment: 'operations', riskTier: 'elevated', status: 'active' }
    ],
    memberships: [{
      membershipId: 'm-hemang-qelly', userId: 'user-hemang-local', organizationId: 'org-qelly-labs',
      roles: ['analyst','compliance-reviewer','workspace-admin','organization-admin'],
      workspaceIds: ['ws-institutional-research','ws-provider-operations'], status: 'active'
    }],
    devices: [
      { deviceId: 'device-local-primary', userId: 'user-hemang-local', label: 'Local development browser', trust: 'trusted-local-fixture', platform: 'browser', firstSeenAt: iso(-7 * 24 * 60 * 60 * 1000), lastSeenAt: iso(), revokedAt: null },
      { deviceId: 'device-local-secondary', userId: 'user-hemang-local', label: 'Secondary test session', trust: 'untrusted', platform: 'browser', firstSeenAt: iso(-2 * 24 * 60 * 60 * 1000), lastSeenAt: iso(-24 * 60 * 60 * 1000), revokedAt: null }
    ],
    sessions: [
      { sessionId: 'sess-local-primary', userId: 'user-hemang-local', organizationId: 'org-qelly-labs', workspaceId: 'ws-institutional-research', deviceId: 'device-local-primary', assurance: 'medium', authenticationMethod: 'simulated-local', createdAt: iso(-2 * 60 * 60 * 1000), lastSeenAt: iso(), expiresAt: iso(8 * 60 * 60 * 1000), stepUpExpiresAt: null, revokedAt: null },
      { sessionId: 'sess-local-secondary', userId: 'user-hemang-local', organizationId: 'org-qelly-labs', workspaceId: 'ws-provider-operations', deviceId: 'device-local-secondary', assurance: 'low', authenticationMethod: 'simulated-local', createdAt: iso(-24 * 60 * 60 * 1000), lastSeenAt: iso(-24 * 60 * 60 * 1000), expiresAt: iso(24 * 60 * 60 * 1000), stepUpExpiresAt: null, revokedAt: null }
    ],
    consents: [
      { consentId: 'consent-essential', userId: 'user-hemang-local', purpose: 'essential-local-runtime', status: 'granted', required: true, updatedAt: iso(-7 * 24 * 60 * 60 * 1000) },
      { consentId: 'consent-product-analytics', userId: 'user-hemang-local', purpose: 'privacy-safe-product-analytics', status: 'denied', required: false, updatedAt: iso(-7 * 24 * 60 * 60 * 1000) }
    ],
    temporaryGrants: [],
    exportRequests: [],
    deletionRequests: []
  };
}
