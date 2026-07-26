import crypto from 'node:crypto';
import { hashPassword } from './password-hasher.mjs';

const sha256=value=>crypto.createHash('sha256').update(String(value)).digest('hex');
const normalizeEmail=value=>String(value??'').trim().toLowerCase();
const numericCode=()=>String(crypto.randomInt(0,1000000)).padStart(6,'0');
const addMinutes=minutes=>new Date(Date.now()+minutes*60_000).toISOString();

export class AccountRecoveryService{
  constructor({repository,jobQueue,auditLedger,passwordPepper='',environment=process.env}={}){this.repository=repository;this.jobQueue=jobQueue;this.auditLedger=auditLedger;this.passwordPepper=passwordPepper;this.exposeCode=environment.NODE_ENV!=='production'&&String(environment.QELLY_EXPOSE_RECOVERY_CODE_IN_DEVELOPMENT??'false').toLowerCase()==='true';}
  async request({email},correlationId){
    const normalized=normalizeEmail(email);if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized))throw Object.assign(new Error('A valid email is required'),{status:400,code:'email_invalid'});
    const user=await this.repository.findUserByEmail(normalized);let challengeId=null,developmentCode=null;
    if(user&&user.status==='active'){
      const membership=await this.repository.findMembershipForUser(user.user_id);const workspaceIds=membership?.workspaceIds??[];const code=numericCode();
      const challenge=await this.repository.createAccountRecoveryChallenge({userId:user.user_id,email:normalized,codeHash:sha256(code),expiresAt:addMinutes(15),maxAttempts:5});challengeId=challenge.challenge_id;
      if(membership&&workspaceIds[0]&&this.jobQueue)await this.jobQueue.enqueue({tenantId:membership.organization_id,workspaceId:workspaceIds[0],jobType:'notification.email',payload:{userId:user.user_id,tenantId:membership.organization_id,workspaceId:workspaceIds[0],destination:normalized,title:'Your Qelly account recovery code',body:`Your Qelly recovery code is ${code}. It expires in 15 minutes. If you did not request this, ignore this message.`},idempotencyKey:`account-recovery:${challenge.challenge_id}`});
      if(this.exposeCode)developmentCode=code;
    }
    await this.auditLedger?.append({eventType:'auth.account-recovery.requested.v1',correlationId,actor:{type:'anonymous',id:'recovery-request'},tenantId:null,workspaceId:null,outcome:'success',details:{emailHash:sha256(normalized).slice(0,16),challengeCreated:Boolean(challengeId)}});
    return {accepted:true,challengeId,expiresInMinutes:15,developmentCode,truthBoundary:'The response is intentionally non-enumerating. External delivery depends on the configured email adapter.'};
  }
  async status(challengeId){const row=await this.repository.getAccountRecoveryChallenge(challengeId);if(!row)return {found:false};return {found:true,challengeId:row.challenge_id,status:row.used_at?'used':Date.parse(row.expires_at)<=Date.now()?'expired':Number(row.attempts)>=Number(row.max_attempts)?'locked':'pending',attempts:Number(row.attempts),maxAttempts:Number(row.max_attempts),expiresAt:row.expires_at};}
  async reset({challengeId,code,newPassword},correlationId){
    if(String(newPassword??'').length<12)throw Object.assign(new Error('New password must contain at least 12 characters'),{status:400,code:'password_too_short'});
    const consumed=await this.repository.consumeAccountRecoveryChallenge(challengeId,sha256(String(code??'').trim()));
    if(!consumed?.verified)throw Object.assign(new Error(consumed?.reason==='expired'?'Recovery challenge has expired':'Recovery code is invalid or unavailable'),{status:400,code:`account_recovery_${consumed?.reason??'invalid'}`});
    const passwordHash=await hashPassword(newPassword,{pepper:this.passwordPepper});await this.repository.updateUserPassword(consumed.userId,passwordHash);const revoked=await this.repository.revokeAllUserSessions(consumed.userId,'account-recovery');
    await this.auditLedger?.append({eventType:'auth.account-recovery.completed.v1',correlationId,actor:{type:'user',id:consumed.userId},tenantId:null,workspaceId:null,outcome:'success',details:{challengeId,revokedSessions:revoked}});
    return {reset:true,revokedSessions:revoked,loginRequired:true};
  }
}
