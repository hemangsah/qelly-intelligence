import { AtomicJsonStore } from '../platform/json-store.mjs';
import { identitySeed } from './identity-fixtures.mjs';
import { evaluateAccess } from './authorization-engine.mjs';

export class IdentityService {
  constructor({ filePath, auditLedger }) {
    this.store = new AtomicJsonStore(filePath, identitySeed);
    this.auditLedger = auditLedger;
  }

  async context(sessionId = 'sess-local-primary') {
    let data = await this.store.read();
    let session = data.sessions.find((item) => item.sessionId === sessionId) ?? null;
    if (!session) return null;
    if (data.mode === 'local-security-foundation' && session.authenticationMethod === 'simulated-local' && !session.revokedAt && Date.parse(session.expiresAt) <= Date.now()) {
      data = await this.store.update((value) => {
        const local = value.sessions.find((item) => item.sessionId === sessionId);
        if (local && local.authenticationMethod === 'simulated-local' && !local.revokedAt && Date.parse(local.expiresAt) <= Date.now()) {
          local.lastSeenAt = new Date().toISOString();
          local.expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString();
          local.stepUpExpiresAt = null;
        }
        return value;
      });
      session = data.sessions.find((item) => item.sessionId === sessionId) ?? null;
    }
    const user = data.users.find((item) => item.userId === session.userId) ?? null;
    const organization = data.organizations.find((item) => item.organizationId === session.organizationId) ?? null;
    const workspace = data.workspaces.find((item) => item.workspaceId === session.workspaceId) ?? null;
    const membership = data.memberships.find((item) => item.userId === session.userId && item.organizationId === session.organizationId) ?? null;
    const device = data.devices.find((item) => item.deviceId === session.deviceId) ?? null;
    return {
      mode: data.mode,
      productionIdentityEnabled: false,
      authenticationTruth: 'No production authentication is performed. The selected local session is deterministic fixture state.',
      user, organization, workspace, membership, device, session,
      safety: { liveTrading:false, transfers:false, withdrawals:false, privateKeys:false, recoveryPhrases:false }
    };
  }

  async require(sessionId, action, resource = {}) {
    const context = await this.context(sessionId);
    const result = evaluateAccess({ action, resource, context });
    if (!result.allowed) {
      const error = new Error(`Access denied: ${result.reasons.join(', ')}`);
      error.status = result.reasons.includes('step-up-required') ? 403 : 403;
      error.code = 'access_denied';
      error.details = result;
      throw error;
    }
    return { context, decision: result };
  }

  async evaluate(sessionId, action, resource = {}) {
    const context = await this.context(sessionId);
    return evaluateAccess({ action, resource, context });
  }

  async listSessions(sessionId) {
    const { context } = await this.require(sessionId, 'session:read');
    const data = await this.store.read();
    return data.sessions.filter((item) => item.userId === context.user.userId).map((item) => ({ ...item, current: item.sessionId === sessionId }));
  }

  async listDevices(sessionId) {
    const { context } = await this.require(sessionId, 'device:read');
    const data = await this.store.read();
    return data.devices.filter((item) => item.userId === context.user.userId);
  }

  async simulateStepUp(sessionId, correlationId) {
    const context = await this.context(sessionId);
    if (!context) throw Object.assign(new Error('Session not found'), { status:404, code:'session_not_found' });
    const updated = await this.store.update((data) => {
      const session = data.sessions.find((item) => item.sessionId === sessionId);
      if (!session || session.revokedAt) throw Object.assign(new Error('Session is not active'), { status:401, code:'session_inactive' });
      session.assurance = 'high';
      session.stepUpExpiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
      session.lastSeenAt = new Date().toISOString();
      return data;
    });
    await this.auditLedger.append({ eventType:'stepup.simulated.completed.v1', correlationId, actor:{type:'user',id:context.user.userId}, tenantId:context.organization.organizationId, workspaceId:context.workspace.workspaceId, details:{ sessionId, simulation:true, expiresAt:updated.sessions.find((item)=>item.sessionId===sessionId).stepUpExpiresAt } });
    return this.context(sessionId);
  }

  async revokeSession(actorSessionId, targetSessionId, correlationId) {
    const { context } = await this.require(actorSessionId, 'session:revoke');
    if (actorSessionId === targetSessionId) throw Object.assign(new Error('The active session cannot revoke itself in this local foundation'), { status:409, code:'self_revocation_blocked' });
    let target;
    await this.store.update((data) => {
      target = data.sessions.find((item) => item.sessionId === targetSessionId && item.userId === context.user.userId);
      if (!target) throw Object.assign(new Error('Session not found'), { status:404, code:'session_not_found' });
      target.revokedAt ??= new Date().toISOString();
      return data;
    });
    await this.auditLedger.append({ eventType:'session.revoked.v1', correlationId, actor:{type:'user',id:context.user.userId}, tenantId:context.organization.organizationId, workspaceId:context.workspace.workspaceId, details:{targetSessionId} });
    return { sessionId:targetSessionId, revokedAt:target.revokedAt };
  }

  async switchWorkspace(sessionId, workspaceId, correlationId) {
    const { context } = await this.require(sessionId, 'workspace:switch', { tenantId:'org-qelly-labs', workspaceId });
    const data = await this.store.update((value) => {
      const workspace = value.workspaces.find((item) => item.workspaceId === workspaceId && item.organizationId === context.organization.organizationId);
      if (!workspace) throw Object.assign(new Error('Workspace not found'), { status:404, code:'workspace_not_found' });
      const session = value.sessions.find((item) => item.sessionId === sessionId);
      session.workspaceId = workspaceId;
      session.lastSeenAt = new Date().toISOString();
      return value;
    });
    await this.auditLedger.append({ eventType:'workspace.switched.v1', correlationId, actor:{type:'user',id:context.user.userId}, tenantId:context.organization.organizationId, workspaceId, details:{from:context.workspace.workspaceId,to:workspaceId} });
    return data.workspaces.find((item)=>item.workspaceId===workspaceId);
  }

  async listWorkspaces(sessionId) {
    const { context } = await this.require(sessionId, 'workspace:read');
    const data = await this.store.read();
    return data.workspaces.filter((item) => context.membership.workspaceIds.includes(item.workspaceId));
  }

  async listConsents(sessionId) {
    const { context } = await this.require(sessionId, 'privacy:read');
    const data = await this.store.read();
    return data.consents.filter((item) => item.userId === context.user.userId);
  }

  async updateConsent(sessionId, purpose, status, correlationId) {
    const { context } = await this.require(sessionId, 'privacy:write');
    if (!['granted','denied'].includes(status)) throw Object.assign(new Error('Consent status must be granted or denied'), { status:400, code:'request_invalid' });
    let consent;
    await this.store.update((data) => {
      consent = data.consents.find((item) => item.userId === context.user.userId && item.purpose === purpose);
      if (consent?.required && status === 'denied') throw Object.assign(new Error('Required local-runtime consent cannot be denied'), { status:409, code:'required_consent' });
      if (!consent) {
        consent = { consentId:`consent-${purpose}`, userId:context.user.userId, purpose, status, required:false, updatedAt:new Date().toISOString() };
        data.consents.push(consent);
      } else { consent.status=status; consent.updatedAt=new Date().toISOString(); }
      return data;
    });
    await this.auditLedger.append({ eventType:'consent.updated.v1', correlationId, actor:{type:'user',id:context.user.userId}, tenantId:context.organization.organizationId, workspaceId:context.workspace.workspaceId, classification:'restricted', details:{purpose,status} });
    return consent;
  }

  async privacyInventory(sessionId) {
    const { context } = await this.require(sessionId, 'privacy:read');
    return {
      subjectId: context.user.userId,
      mode:'local-fixture-only',
      categories:[
        {category:'profile',fields:['displayName','locale','timezone','baseCurrency'],purpose:'local interface personalization',retention:'until local runtime reset'},
        {category:'security',fields:['session identifiers','device trust','audit events'],purpose:'access-control demonstration',retention:'local release evidence'},
        {category:'preferences',fields:['theme','density','motion','layout'],purpose:'workspace customization',retention:'until local runtime reset'}
      ],
      excludes:['passwords','production tokens','private keys','recovery phrases','payment information']
    };
  }
}
