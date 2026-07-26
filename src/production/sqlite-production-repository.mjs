import { DatabaseSync } from 'node:sqlite';
import crypto from 'node:crypto';
import path from 'node:path';
import { mkdirSync } from 'node:fs';
import { nowIso } from './crypto-utils.mjs';

const id=(prefix)=>`${prefix}_${crypto.randomUUID().replaceAll('-','')}`;
const parseJson=(value,fallback=[])=>{try{return value?JSON.parse(value):fallback;}catch{return fallback;}};

const SCHEMA=`
PRAGMA journal_mode=WAL;
PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS users(
  user_id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  display_name TEXT NOT NULL,
  email_verified INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  locale TEXT NOT NULL DEFAULT 'en-US',
  timezone TEXT NOT NULL DEFAULT 'UTC',
  base_currency TEXT NOT NULL DEFAULT 'USD',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  revision INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS organizations(
  organization_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  revision INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS workspaces(
  workspace_id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(organization_id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  environment TEXT NOT NULL DEFAULT 'research',
  risk_tier TEXT NOT NULL DEFAULT 'standard',
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  revision INTEGER NOT NULL DEFAULT 1,
  UNIQUE(organization_id,slug)
);
CREATE TABLE IF NOT EXISTS memberships(
  membership_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  organization_id TEXT NOT NULL REFERENCES organizations(organization_id) ON DELETE CASCADE,
  roles_json TEXT NOT NULL,
  workspace_ids_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  revision INTEGER NOT NULL DEFAULT 1,
  UNIQUE(user_id,organization_id)
);
CREATE TABLE IF NOT EXISTS sessions(
  session_id TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,
  csrf_hash TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  organization_id TEXT NOT NULL REFERENCES organizations(organization_id) ON DELETE CASCADE,
  workspace_id TEXT NOT NULL REFERENCES workspaces(workspace_id) ON DELETE CASCADE,
  assurance TEXT NOT NULL DEFAULT 'medium',
  authentication_method TEXT NOT NULL,
  user_agent TEXT,
  ip_hash TEXT,
  created_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  rotated_from_session_id TEXT,
  revoked_at TEXT,
  revocation_reason TEXT,
  revision INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id,revoked_at,expires_at);
CREATE TABLE IF NOT EXISTS jobs(
  job_id TEXT PRIMARY KEY,
  tenant_id TEXT,
  workspace_id TEXT,
  job_type TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  status TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 5,
  available_at TEXT NOT NULL,
  locked_at TEXT,
  locked_by TEXT,
  completed_at TEXT,
  failed_at TEXT,
  last_error TEXT,
  idempotency_key TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(tenant_id,idempotency_key)
);
CREATE INDEX IF NOT EXISTS idx_jobs_ready ON jobs(status,available_at,created_at);
CREATE TABLE IF NOT EXISTS notifications(
  notification_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  tenant_id TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  source_job_id TEXT,
  read_at TEXT,
  created_at TEXT NOT NULL,
  UNIQUE(user_id,source_job_id)
);
CREATE TABLE IF NOT EXISTS mfa_factors(user_id TEXT PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,secret TEXT NOT NULL,status TEXT NOT NULL,recovery_codes_json TEXT NOT NULL DEFAULT '[]',recovery_codes_remaining INTEGER NOT NULL DEFAULT 0,created_at TEXT NOT NULL,updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS secure_imports(import_id TEXT PRIMARY KEY,user_id TEXT NOT NULL,tenant_id TEXT NOT NULL,workspace_id TEXT NOT NULL,object_key TEXT NOT NULL,file_name TEXT NOT NULL,mime_type TEXT NOT NULL,size INTEGER NOT NULL,sha256 TEXT NOT NULL,status TEXT NOT NULL,scan_provider TEXT,scan_result TEXT,created_at TEXT NOT NULL,updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS delivery_attempts(delivery_id TEXT PRIMARY KEY,user_id TEXT NOT NULL,tenant_id TEXT NOT NULL,workspace_id TEXT NOT NULL,channel TEXT NOT NULL,destination TEXT,title TEXT NOT NULL,body TEXT NOT NULL,source_job_id TEXT,status TEXT NOT NULL,provider TEXT NOT NULL,created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS passkey_credentials(credential_id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,public_key_jwk TEXT NOT NULL,sign_count INTEGER NOT NULL DEFAULT 0,transports_json TEXT NOT NULL DEFAULT '[]',label TEXT NOT NULL DEFAULT 'Passkey',created_at TEXT NOT NULL,last_used_at TEXT,revoked_at TEXT);
CREATE INDEX IF NOT EXISTS idx_passkeys_user ON passkey_credentials(user_id,revoked_at);
CREATE TABLE IF NOT EXISTS auth_challenges(challenge_id TEXT PRIMARY KEY,user_id TEXT,email TEXT,kind TEXT NOT NULL,challenge TEXT NOT NULL,metadata_json TEXT NOT NULL DEFAULT '{}',expires_at TEXT NOT NULL,used_at TEXT,created_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS idx_auth_challenges_lookup ON auth_challenges(kind,email,expires_at,used_at);
CREATE TABLE IF NOT EXISTS account_recovery_challenges(
  challenge_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 5,
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_account_recovery_email ON account_recovery_challenges(email,created_at DESC);
CREATE TABLE IF NOT EXISTS migration_history(
  migration_id TEXT PRIMARY KEY,
  checksum TEXT NOT NULL,
  applied_at TEXT NOT NULL,
  runtime TEXT NOT NULL
);
`;

export class SqliteProductionRepository{
  constructor({filePath=':memory:'}={}){
    if(filePath!==':memory:')mkdirSync(path.dirname(filePath),{recursive:true});
    this.filePath=filePath; this.db=new DatabaseSync(filePath); this.db.exec(SCHEMA); this.ensureReleaseA5Schema();
  }
  ensureReleaseA5Schema(){
    const additions=[
      `ALTER TABLE secure_imports ADD COLUMN scan_provider TEXT`,
      `ALTER TABLE secure_imports ADD COLUMN scan_result TEXT`,
      `ALTER TABLE secure_imports ADD COLUMN updated_at TEXT`
    ];
    for(const statement of additions){try{this.db.exec(statement);}catch(error){if(!String(error.message).toLowerCase().includes('duplicate column'))throw error;}}
    this.db.exec(`UPDATE secure_imports SET updated_at=COALESCE(updated_at,created_at)`);
  }
  close(){this.db.close();}
  async health(){
    try{const row=this.db.prepare('SELECT 1 AS ok').get();return {ok:row.ok===1,driver:'sqlite-development',filePath:this.filePath};}
    catch(error){return {ok:false,driver:'sqlite-development',error:error.message};}
  }
  transaction(fn){
    this.db.exec('BEGIN IMMEDIATE');
    try{const value=fn();this.db.exec('COMMIT');return value;}catch(error){try{this.db.exec('ROLLBACK');}catch{}throw error;}
  }
  async findUserByEmail(email){return this.db.prepare('SELECT * FROM users WHERE email=?').get(email)??null;}
  async findUserById(userId){return this.db.prepare('SELECT * FROM users WHERE user_id=?').get(userId)??null;}
  async findMembershipForUser(userId){const row=this.db.prepare(`SELECT * FROM memberships WHERE user_id=? AND status='active' ORDER BY created_at LIMIT 1`).get(userId)??null;if(row){row.roles=parseJson(row.roles_json);row.workspaceIds=parseJson(row.workspace_ids_json);}return row;}
  async createRegistration({email,passwordHash,displayName,organizationName,organizationSlug,workspaceName,workspaceSlug,locale='en-US',timezone='UTC',baseCurrency='USD'}){
    return this.transaction(()=>{
      if(this.db.prepare('SELECT 1 FROM users WHERE email=?').get(email))throw Object.assign(new Error('An account with this email already exists'),{status:409,code:'email_already_registered'});
      const now=nowIso(); const userId=id('usr'),organizationId=id('org'),workspaceId=id('ws'),membershipId=id('mbr');
      this.db.prepare(`INSERT INTO users(user_id,email,password_hash,display_name,locale,timezone,base_currency,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)`).run(userId,email,passwordHash,displayName,locale,timezone,baseCurrency,now,now);
      this.db.prepare(`INSERT INTO organizations(organization_id,name,slug,created_at,updated_at) VALUES(?,?,?,?,?)`).run(organizationId,organizationName,organizationSlug,now,now);
      this.db.prepare(`INSERT INTO workspaces(workspace_id,organization_id,name,slug,created_at,updated_at) VALUES(?,?,?,?,?,?)`).run(workspaceId,organizationId,workspaceName,workspaceSlug,now,now);
      this.db.prepare(`INSERT INTO memberships(membership_id,user_id,organization_id,roles_json,workspace_ids_json,created_at,updated_at) VALUES(?,?,?,?,?,?,?)`).run(membershipId,userId,organizationId,JSON.stringify(['organization-admin']),JSON.stringify([workspaceId]),now,now);
      return {userId,organizationId,workspaceId,membershipId};
    });
  }
  async createSession({tokenHash,csrfHash,userId,organizationId,workspaceId,assurance='medium',authenticationMethod='password',userAgent=null,ipHash=null,expiresAt,rotatedFromSessionId=null}){
    const sessionId=id('ses'),now=nowIso();
    this.db.prepare(`INSERT INTO sessions(session_id,token_hash,csrf_hash,user_id,organization_id,workspace_id,assurance,authentication_method,user_agent,ip_hash,created_at,last_seen_at,expires_at,rotated_from_session_id) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(sessionId,tokenHash,csrfHash,userId,organizationId,workspaceId,assurance,authenticationMethod,userAgent,ipHash,now,now,expiresAt,rotatedFromSessionId);
    return this.getSessionById(sessionId);
  }
  async getSessionById(sessionId){return this.db.prepare('SELECT * FROM sessions WHERE session_id=?').get(sessionId)??null;}
  async getSessionByTokenHash(tokenHash){return this.db.prepare('SELECT * FROM sessions WHERE token_hash=?').get(tokenHash)??null;}
  async touchSession(sessionId){this.db.prepare('UPDATE sessions SET last_seen_at=?,revision=revision+1 WHERE session_id=?').run(nowIso(),sessionId);}
  async setSessionAssurance(sessionId,assurance){this.db.prepare(`UPDATE sessions SET assurance=?,revision=revision+1 WHERE session_id=?`).run(assurance,sessionId);return this.getSessionById(sessionId);}
  async revokeSession(sessionId,reason='logout'){
    const now=nowIso(); this.db.prepare('UPDATE sessions SET revoked_at=COALESCE(revoked_at,?),revocation_reason=COALESCE(revocation_reason,?),revision=revision+1 WHERE session_id=?').run(now,reason,sessionId); return this.getSessionById(sessionId);
  }
  async rotateSession(oldSessionId,newSession){
    return this.transaction(()=>{
      const current=this.db.prepare('SELECT * FROM sessions WHERE session_id=?').get(oldSessionId);
      if(!current||current.revoked_at)throw Object.assign(new Error('Session is not active'),{status:401,code:'session_inactive'});
      const now=nowIso();this.db.prepare(`UPDATE sessions SET revoked_at=?,revocation_reason='rotated',revision=revision+1 WHERE session_id=?`).run(now,oldSessionId);
      const sessionId=id('ses');
      this.db.prepare(`INSERT INTO sessions(session_id,token_hash,csrf_hash,user_id,organization_id,workspace_id,assurance,authentication_method,user_agent,ip_hash,created_at,last_seen_at,expires_at,rotated_from_session_id) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(sessionId,newSession.tokenHash,newSession.csrfHash,current.user_id,current.organization_id,current.workspace_id,current.assurance,current.authentication_method,newSession.userAgent??current.user_agent,newSession.ipHash??current.ip_hash,now,now,newSession.expiresAt,oldSessionId);
      return this.db.prepare('SELECT * FROM sessions WHERE session_id=?').get(sessionId);
    });
  }
  async contextForSession(sessionId){
    const session=await this.getSessionById(sessionId); if(!session)return null;
    const user=await this.findUserById(session.user_id);
    const organization=this.db.prepare('SELECT * FROM organizations WHERE organization_id=?').get(session.organization_id)??null;
    const workspace=this.db.prepare('SELECT * FROM workspaces WHERE workspace_id=?').get(session.workspace_id)??null;
    const membership=this.db.prepare('SELECT * FROM memberships WHERE user_id=? AND organization_id=?').get(session.user_id,session.organization_id)??null;
    if(membership){membership.roles=parseJson(membership.roles_json);membership.workspaceIds=parseJson(membership.workspace_ids_json);}
    return {session,user,organization,workspace,membership};
  }
  async listSessions(userId){return this.db.prepare('SELECT * FROM sessions WHERE user_id=? ORDER BY created_at DESC').all(userId);}
  async listWorkspaces(userId,organizationId){
    const membership=this.db.prepare('SELECT workspace_ids_json FROM memberships WHERE user_id=? AND organization_id=?').get(userId,organizationId); if(!membership)return [];
    const ids=parseJson(membership.workspace_ids_json); if(!ids.length)return [];
    const placeholders=ids.map(()=>'?').join(','); return this.db.prepare(`SELECT * FROM workspaces WHERE workspace_id IN (${placeholders}) ORDER BY name`).all(...ids);
  }
  async switchWorkspace(sessionId,workspaceId){
    const ctx=await this.contextForSession(sessionId); if(!ctx)throw Object.assign(new Error('Session not found'),{status:404,code:'session_not_found'});
    if(!ctx.membership.workspaceIds.includes(workspaceId))throw Object.assign(new Error('Workspace is outside membership scope'),{status:403,code:'workspace_forbidden'});
    this.db.prepare('UPDATE sessions SET workspace_id=?,last_seen_at=?,revision=revision+1 WHERE session_id=?').run(workspaceId,nowIso(),sessionId);
    return this.db.prepare('SELECT * FROM workspaces WHERE workspace_id=?').get(workspaceId);
  }
  async createJob({tenantId=null,workspaceId=null,jobType,payload,idempotencyKey=null,maxAttempts=5,availableAt=nowIso()}){
    if(idempotencyKey){const existing=this.db.prepare('SELECT * FROM jobs WHERE tenant_id IS ? AND idempotency_key=?').get(tenantId,idempotencyKey);if(existing)return this.mapJob(existing);}
    const jobId=id('job'),now=nowIso();
    this.db.prepare(`INSERT INTO jobs(job_id,tenant_id,workspace_id,job_type,payload_json,status,max_attempts,available_at,idempotency_key,created_at,updated_at) VALUES(?,?,?,?,?,'queued',?,?,?,?,?)`).run(jobId,tenantId,workspaceId,jobType,JSON.stringify(payload),maxAttempts,availableAt,idempotencyKey,now,now);
    return this.getJob(jobId);
  }
  mapJob(row){return row?{...row,payload:parseJson(row.payload_json,{})}:null;}
  async getJob(jobId){return this.mapJob(this.db.prepare('SELECT * FROM jobs WHERE job_id=?').get(jobId)??null);}
  async listJobs({tenantId=null,limit=100}={}){
    const rows=tenantId?this.db.prepare('SELECT * FROM jobs WHERE tenant_id=? ORDER BY created_at DESC LIMIT ?').all(tenantId,limit):this.db.prepare('SELECT * FROM jobs ORDER BY created_at DESC LIMIT ?').all(limit);return rows.map((row)=>this.mapJob(row));
  }
  async reserveJob({workerId,types=[],leaseMs=60000}={}){
    return this.transaction(()=>{
      const now=nowIso(); const params=[now]; let filter='';
      if(types.length){filter=` AND job_type IN (${types.map(()=>'?').join(',')})`;params.push(...types);}
      const row=this.db.prepare(`SELECT * FROM jobs WHERE status='queued' AND available_at<=?${filter} ORDER BY created_at LIMIT 1`).get(...params);
      if(!row)return null;
      this.db.prepare(`UPDATE jobs SET status='running',attempts=attempts+1,locked_at=?,locked_by=?,updated_at=? WHERE job_id=? AND status='queued'`).run(now,workerId,now,row.job_id);
      return this.mapJob(this.db.prepare('SELECT * FROM jobs WHERE job_id=?').get(row.job_id));
    });
  }

  async reserveJobById({jobId,workerId}){
    return this.transaction(()=>{
      const row=this.db.prepare(`SELECT * FROM jobs WHERE job_id=? AND status='queued' AND available_at<=?`).get(jobId,nowIso());
      if(!row)return null;const now=nowIso();
      this.db.prepare(`UPDATE jobs SET status='running',attempts=attempts+1,locked_at=?,locked_by=?,updated_at=? WHERE job_id=? AND status='queued'`).run(now,workerId,now,jobId);
      return this.mapJob(this.db.prepare('SELECT * FROM jobs WHERE job_id=?').get(jobId));
    });
  }
  async completeJob(jobId,result={}){const now=nowIso();this.db.prepare(`UPDATE jobs SET status='completed',completed_at=?,locked_at=NULL,locked_by=NULL,payload_json=?,updated_at=? WHERE job_id=?`).run(now,JSON.stringify({...((await this.getJob(jobId))?.payload??{}),result}),now,jobId);return this.getJob(jobId);}
  async failJob(jobId,error,{retryDelayMs=1000}={}){
    const job=await this.getJob(jobId);if(!job)return null;const now=nowIso();const retry=job.attempts<job.max_attempts;
    this.db.prepare(`UPDATE jobs SET status=?,available_at=?,failed_at=?,last_error=?,locked_at=NULL,locked_by=NULL,updated_at=? WHERE job_id=?`).run(retry?'queued':'dead',new Date(Date.now()+retryDelayMs).toISOString(),retry?null:now,String(error?.message??error).slice(0,2000),now,jobId);return this.getJob(jobId);
  }
  async createNotification({userId,tenantId,workspaceId,kind,title,body,sourceJobId=null}){
    if(sourceJobId){const existing=this.db.prepare('SELECT * FROM notifications WHERE user_id=? AND source_job_id=?').get(userId,sourceJobId);if(existing)return existing;}
    const notificationId=id('ntf'),createdAt=nowIso();this.db.prepare(`INSERT INTO notifications(notification_id,user_id,tenant_id,workspace_id,kind,title,body,source_job_id,created_at) VALUES(?,?,?,?,?,?,?,?,?)`).run(notificationId,userId,tenantId,workspaceId,kind,title,body,sourceJobId,createdAt);return this.db.prepare('SELECT * FROM notifications WHERE notification_id=?').get(notificationId);
  }
  async listNotifications({userId,tenantId,workspaceId,limit=100}){return this.db.prepare(`SELECT * FROM notifications WHERE user_id=? AND tenant_id=? AND workspace_id=? ORDER BY created_at DESC LIMIT ?`).all(userId,tenantId,workspaceId,limit);}
  async markNotificationRead({notificationId,userId}){this.db.prepare('UPDATE notifications SET read_at=COALESCE(read_at,?) WHERE notification_id=? AND user_id=?').run(nowIso(),notificationId,userId);return this.db.prepare('SELECT * FROM notifications WHERE notification_id=? AND user_id=?').get(notificationId,userId)??null;}

  async upsertMfaFactor({userId,secret,status='pending'}){const now=nowIso();this.db.prepare(`INSERT INTO mfa_factors(user_id,secret,status,created_at,updated_at) VALUES(?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET secret=excluded.secret,status=excluded.status,updated_at=excluded.updated_at`).run(userId,secret,status,now,now);return this.getMfaFactor(userId);}
  async getMfaFactor(userId){return this.db.prepare('SELECT * FROM mfa_factors WHERE user_id=?').get(userId)??null;}
  async listMfaFactors(){return this.db.prepare('SELECT * FROM mfa_factors ORDER BY user_id').all();}
  async updateMfaSecret(userId,secret){this.db.prepare('UPDATE mfa_factors SET secret=?,updated_at=? WHERE user_id=?').run(secret,nowIso(),userId);return this.getMfaFactor(userId);}
  async activateMfaFactor(userId,codes){this.db.prepare(`UPDATE mfa_factors SET status='active',recovery_codes_json=?,recovery_codes_remaining=?,updated_at=? WHERE user_id=?`).run(JSON.stringify(codes),codes.length,nowIso(),userId);return this.getMfaFactor(userId);}
  async disableMfaFactor(userId){this.db.prepare(`DELETE FROM mfa_factors WHERE user_id=?`).run(userId);}
  async consumeMfaRecoveryCode(userId,codeHash){return this.transaction(()=>{const row=this.db.prepare(`SELECT recovery_codes_json FROM mfa_factors WHERE user_id=? AND status='active'`).get(userId);if(!row)return {consumed:false,remaining:0};const codes=parseJson(row.recovery_codes_json,[]);const index=codes.indexOf(codeHash);if(index<0)return {consumed:false,remaining:codes.length};codes.splice(index,1);this.db.prepare(`UPDATE mfa_factors SET recovery_codes_json=?,recovery_codes_remaining=?,updated_at=? WHERE user_id=?`).run(JSON.stringify(codes),codes.length,nowIso(),userId);return {consumed:true,remaining:codes.length};});}
  async createAuthChallenge({userId=null,email=null,kind,challenge,metadata={},expiresAt}){const challengeId=id('chl'),createdAt=nowIso();this.db.prepare(`INSERT INTO auth_challenges(challenge_id,user_id,email,kind,challenge,metadata_json,expires_at,created_at) VALUES(?,?,?,?,?,?,?,?)`).run(challengeId,userId,email,kind,challenge,JSON.stringify(metadata),expiresAt,createdAt);return this.getAuthChallenge(challengeId);}
  async getAuthChallenge(challengeId){const row=this.db.prepare(`SELECT * FROM auth_challenges WHERE challenge_id=?`).get(challengeId)??null;if(row)row.metadata=parseJson(row.metadata_json,{});return row;}
  async consumeAuthChallenge(challengeId){return this.transaction(()=>{const row=this.db.prepare(`SELECT * FROM auth_challenges WHERE challenge_id=?`).get(challengeId);if(!row||row.used_at||Date.parse(row.expires_at)<=Date.now())return null;const usedAt=nowIso();this.db.prepare(`UPDATE auth_challenges SET used_at=? WHERE challenge_id=? AND used_at IS NULL`).run(usedAt,challengeId);row.used_at=usedAt;row.metadata=parseJson(row.metadata_json,{});return row;});}

  async createAccountRecoveryChallenge({userId,email,codeHash,expiresAt,maxAttempts=5}){const challengeId=id('rcv'),createdAt=nowIso();this.db.prepare(`INSERT INTO account_recovery_challenges(challenge_id,user_id,email,code_hash,max_attempts,expires_at,created_at) VALUES(?,?,?,?,?,?,?)`).run(challengeId,userId,email,codeHash,Number(maxAttempts),expiresAt,createdAt);return this.getAccountRecoveryChallenge(challengeId);}
  async getAccountRecoveryChallenge(challengeId){return this.db.prepare(`SELECT * FROM account_recovery_challenges WHERE challenge_id=?`).get(challengeId)??null;}
  async consumeAccountRecoveryChallenge(challengeId,codeHash){return this.transaction(()=>{const row=this.db.prepare(`SELECT * FROM account_recovery_challenges WHERE challenge_id=?`).get(challengeId);if(!row)return {verified:false,reason:'missing'};if(row.used_at)return {verified:false,reason:'used'};if(Date.parse(row.expires_at)<=Date.now())return {verified:false,reason:'expired'};if(Number(row.attempts)>=Number(row.max_attempts))return {verified:false,reason:'locked'};if(row.code_hash!==codeHash){this.db.prepare(`UPDATE account_recovery_challenges SET attempts=attempts+1 WHERE challenge_id=?`).run(challengeId);return {verified:false,reason:Number(row.attempts)+1>=Number(row.max_attempts)?'locked':'invalid'};}const usedAt=nowIso();this.db.prepare(`UPDATE account_recovery_challenges SET used_at=? WHERE challenge_id=? AND used_at IS NULL`).run(usedAt,challengeId);return {verified:true,userId:row.user_id,email:row.email,usedAt};});}
  async updateUserPassword(userId,passwordHash){this.db.prepare(`UPDATE users SET password_hash=?,updated_at=?,revision=revision+1 WHERE user_id=?`).run(passwordHash,nowIso(),userId);return this.findUserById(userId);}
  async revokeAllUserSessions(userId,reason='security-reset'){const now=nowIso();const result=this.db.prepare(`UPDATE sessions SET revoked_at=COALESCE(revoked_at,?),revocation_reason=COALESCE(revocation_reason,?),revision=revision+1 WHERE user_id=? AND revoked_at IS NULL`).run(now,reason,userId);return Number(result.changes??0);}

  async createPasskey({credentialId,userId,publicKeyJwk,signCount=0,transports=[],label='Passkey'}){const createdAt=nowIso();this.db.prepare(`INSERT INTO passkey_credentials(credential_id,user_id,public_key_jwk,sign_count,transports_json,label,created_at) VALUES(?,?,?,?,?,?,?)`).run(credentialId,userId,JSON.stringify(publicKeyJwk),Number(signCount),JSON.stringify(transports),label,createdAt);return this.getPasskey(credentialId);}
  async getPasskey(credentialId){const row=this.db.prepare(`SELECT * FROM passkey_credentials WHERE credential_id=? AND revoked_at IS NULL`).get(credentialId)??null;if(row){row.publicKeyJwk=parseJson(row.public_key_jwk,{});row.transports=parseJson(row.transports_json,[]);}return row;}
  async listPasskeys(userId){return this.db.prepare(`SELECT * FROM passkey_credentials WHERE user_id=? AND revoked_at IS NULL ORDER BY created_at DESC`).all(userId).map(row=>({...row,publicKeyJwk:parseJson(row.public_key_jwk,{}),transports:parseJson(row.transports_json,[])}));}
  async updatePasskeyCounter(credentialId,signCount){this.db.prepare(`UPDATE passkey_credentials SET sign_count=?,last_used_at=? WHERE credential_id=? AND revoked_at IS NULL`).run(Number(signCount),nowIso(),credentialId);return this.getPasskey(credentialId);}
  async revokePasskey({credentialId,userId}){const revokedAt=nowIso();this.db.prepare(`UPDATE passkey_credentials SET revoked_at=? WHERE credential_id=? AND user_id=? AND revoked_at IS NULL`).run(revokedAt,credentialId,userId);return {credentialId,revokedAt};}
  async createSecureImport({userId,tenantId,workspaceId,object}){const importId=id('imp'),createdAt=nowIso();this.db.prepare(`INSERT INTO secure_imports(import_id,user_id,tenant_id,workspace_id,object_key,file_name,mime_type,size,sha256,status,scan_provider,scan_result,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(importId,userId,tenantId,workspaceId,object.key,object.fileName,object.mimeType,object.size,object.sha256,object.status??'released',object.scanner??null,object.scanResult??null,createdAt,createdAt);return this.getSecureImport(importId);}
  async getSecureImport(importId){return this.db.prepare('SELECT * FROM secure_imports WHERE import_id=?').get(importId)??null;}
  async updateSecureImport({importId,objectKey,status,scanProvider=null,scanResult=null}){this.db.prepare(`UPDATE secure_imports SET object_key=COALESCE(?,object_key),status=?,scan_provider=COALESCE(?,scan_provider),scan_result=COALESCE(?,scan_result),updated_at=? WHERE import_id=?`).run(objectKey??null,status,scanProvider,scanResult,nowIso(),importId);return this.getSecureImport(importId);}
  async listSecureImports({userId,tenantId,workspaceId,status=null}){const base=`SELECT * FROM secure_imports WHERE user_id=? AND tenant_id=? AND workspace_id=?`;return status?this.db.prepare(`${base} AND status=? ORDER BY created_at DESC`).all(userId,tenantId,workspaceId,status):this.db.prepare(`${base} ORDER BY created_at DESC`).all(userId,tenantId,workspaceId);}
  async createDeliveryAttempt(v){const deliveryId=id('dlv'),createdAt=nowIso();this.db.prepare(`INSERT INTO delivery_attempts(delivery_id,user_id,tenant_id,workspace_id,channel,destination,title,body,source_job_id,status,provider,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`).run(deliveryId,v.userId,v.tenantId,v.workspaceId,v.channel,v.destination??null,v.title,v.body,v.sourceJobId??null,v.status,v.provider,createdAt);return this.db.prepare('SELECT * FROM delivery_attempts WHERE delivery_id=?').get(deliveryId);}
  async listDeliveryAttempts({userId,tenantId,workspaceId}){return this.db.prepare(`SELECT * FROM delivery_attempts WHERE user_id=? AND tenant_id=? AND workspace_id=? ORDER BY created_at DESC`).all(userId,tenantId,workspaceId);}
  async count(table){const allowed=new Set(['users','organizations','workspaces','memberships','sessions','jobs','notifications','mfa_factors','secure_imports','delivery_attempts','passkey_credentials','auth_challenges','account_recovery_challenges']);if(!allowed.has(table))throw new Error('Invalid table');return Number(this.db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get().count);}
}
