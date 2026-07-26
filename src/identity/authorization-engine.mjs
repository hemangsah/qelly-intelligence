import { rolePermissions } from './identity-fixtures.mjs';

const highAssurancePermissions = new Set([
  'session:revoke','device:revoke','workspace:admin','instrument:govern','timeseries:write','quality:override','privacy:delete','access:grant'
]);

function expandedPermissions(roles) {
  const values = new Set();
  for (const role of roles) for (const permission of rolePermissions[role] ?? []) values.add(permission);
  return values;
}

export function evaluateAccess({ action, resource = {}, context, now = new Date() }) {
  const reasons = [];
  const obligations = [];
  if (!context?.session || context.session.revokedAt) reasons.push('session-not-active');
  if (context?.session && new Date(context.session.expiresAt) <= now) reasons.push('session-expired');
  if (!context?.membership || context.membership.status !== 'active') reasons.push('membership-not-active');
  if (resource.tenantId && resource.tenantId !== context?.organization?.organizationId) reasons.push('tenant-boundary-mismatch');
  if (resource.workspaceId && resource.workspaceId !== context?.workspace?.workspaceId && !context?.membership?.workspaceIds?.includes(resource.workspaceId)) reasons.push('workspace-boundary-mismatch');
  const permissions = expandedPermissions(context?.membership?.roles ?? []);
  const roleAllowed = permissions.has('*') || permissions.has(action);
  if (!roleAllowed) reasons.push('permission-not-granted');
  const elevated = context?.session?.assurance === 'high' && context.session.stepUpExpiresAt && new Date(context.session.stepUpExpiresAt) > now;
  if (highAssurancePermissions.has(action) && !elevated) reasons.push('step-up-required');
  if (context?.device?.trust === 'untrusted' && highAssurancePermissions.has(action)) reasons.push('trusted-device-required');
  if (['provider:read','instrument:read','timeseries:read','stream:read'].includes(action)) obligations.push('retain-source-and-freshness-metadata');
  if (action === 'audit:read') obligations.push('do-not-export-sensitive-details');
  return {
    decision: reasons.length ? 'deny' : obligations.length ? 'allow-with-obligations' : 'allow',
    allowed: reasons.length === 0,
    action,
    reasons,
    obligations,
    evaluatedAt: now.toISOString(),
    policyVersion: 'qelly-rbac-abac-1.0.0'
  };
}
