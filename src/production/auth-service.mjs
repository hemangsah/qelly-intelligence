import { hashPassword, verifyPassword } from './password-hasher.mjs';
import { issueSessionToken, parseCookies, verifySignedSession, serializeSessionCookie, clearSessionCookie, SESSION_COOKIE } from './session-cookie.mjs';
import { addMsIso, hmacSha256, normalizeEmail, randomToken, sha256 } from './crypto-utils.mjs';

const slugify=(value,fallback='qelly')=>String(value??'').toLowerCase().trim().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,48)||fallback;
const bool=(value)=>value===true||value==='true'||value==='t'||value===1||value==='1';

function mapContext(raw){
  if(!raw)return null;
  const s=raw.session,u=raw.user,o=raw.organization,w=raw.workspace,m=raw.membership;
  return {
    mode:'production-platform-foundation',productionIdentityEnabled:true,authenticationTruth:'Cookie-authenticated database-backed session. Passwords are scrypt-hashed; raw session tokens are never persisted.',
    user:{userId:u.user_id,displayName:u.display_name,primaryEmail:u.email,emailVerified:bool(u.email_verified),locale:u.locale,timezone:u.timezone,baseCurrency:u.base_currency,status:u.status},
    organization:{organizationId:o.organization_id,name:o.name,slug:o.slug,status:o.status},
    workspace:{workspaceId:w.workspace_id,organizationId:w.organization_id??o.organization_id,name:w.name,slug:w.slug,environment:w.environment,riskTier:w.risk_tier,status:w.status},
    membership:{membershipId:m.membership_id,userId:m.user_id,organizationId:m.organization_id,roles:m.roles??[],workspaceIds:m.workspaceIds??[],status:m.status},
    device:{deviceId:`cookie:${s.session_id}`,userId:s.user_id,label:'Secure browser session',trust:'trusted-authenticated',platform:'browser',revokedAt:s.revoked_at??null},
    session:{sessionId:s.session_id,userId:s.user_id,organizationId:s.organization_id,workspaceId:s.workspace_id,assurance:s.assurance,authenticationMethod:s.authentication_method,createdAt:s.created_at,lastSeenAt:s.last_seen_at,expiresAt:s.expires_at,stepUpExpiresAt:s.step_up_expires_at??null,revokedAt:s.revoked_at??null,revision:Number(s.revision??1)},
    safety:{liveTrading:false,transfers:false,withdrawals:false,privateKeys:false,recoveryPhrases:false}
  };
}

export class ProductionAuthService{
  constructor({repository,auditLedger,sessionSecret=process.env.QELLY_SESSION_SECRET,passwordPepper=process.env.QELLY_PASSWORD_PEPPER??'',secureCookies=process.env.NODE_ENV==='production',sessionTtlMs=8*60*60*1000}={}){
    if(!repository)throw new Error('ProductionAuthService requires repository');
    if(!sessionSecret||sessionSecret.length<32)throw Object.assign(new Error('QELLY_SESSION_SECRET must be at least 32 characters'),{code:'session_secret_invalid'});
    this.repository=repository;this.auditLedger=auditLedger;this.sessionSecret=sessionSecret;this.passwordPepper=passwordPepper;this.secureCookies=secureCookies;this.sessionTtlMs=sessionTtlMs;
  }
  csrfForRawToken(rawToken){return hmacSha256(this.sessionSecret,`csrf:${rawToken}`);}
  sessionKey(rawToken){return `prod:${rawToken}`;}
  rawFromSessionKey(sessionKey){return String(sessionKey??'').startsWith('prod:')?String(sessionKey).slice(5):null;}
  requestMetadata(request){return {userAgent:String(request.headers['user-agent']??'').slice(0,500)||null,ipHash:sha256(`${request.socket?.remoteAddress??'unknown'}:${this.sessionSecret}`).slice(0,32)};}
  async issueForPrincipal({userId,organizationId,workspaceId,authenticationMethod='password',request,rotatedFromSessionId=null}){
    const {token,signed}=issueSessionToken(this.sessionSecret),csrf=this.csrfForRawToken(token),meta=this.requestMetadata(request);
    const session=await this.repository.createSession({tokenHash:sha256(token),csrfHash:sha256(csrf),userId,organizationId,workspaceId,authenticationMethod,userAgent:meta.userAgent,ipHash:meta.ipHash,expiresAt:addMsIso(this.sessionTtlMs),rotatedFromSessionId});
    return {sessionKey:this.sessionKey(token),session,csrf,cookie:serializeSessionCookie(signed,{secure:this.secureCookies,maxAgeSeconds:this.sessionTtlMs/1000})};
  }
  async register(input,request,correlationId){
    const email=normalizeEmail(input.email);if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw Object.assign(new Error('A valid email is required'),{status:400,code:'email_invalid'});
    const displayName=String(input.displayName??'').trim();if(displayName.length<2||displayName.length>80)throw Object.assign(new Error('Display name must contain 2-80 characters'),{status:400,code:'display_name_invalid'});
    const passwordHash=await hashPassword(input.password,{pepper:this.passwordPepper});
    const organizationName=String(input.organizationName??`${displayName}'s organization`).trim().slice(0,120);const workspaceName=String(input.workspaceName??'Research Workspace').trim().slice(0,120);
    const registration=await this.repository.createRegistration({email,passwordHash,displayName,organizationName,organizationSlug:slugify(organizationName,`org-${randomToken(4)}`),workspaceName,workspaceSlug:slugify(workspaceName,'research'),locale:input.locale??'en-US',timezone:input.timezone??'UTC',baseCurrency:input.baseCurrency??'USD'});
    const issued=await this.issueForPrincipal({...registration,authenticationMethod:'password-registration',request});
    await this.auditLedger?.append({eventType:'auth.user.registered.v1',correlationId,actor:{type:'user',id:registration.userId},tenantId:registration.organizationId,workspaceId:registration.workspaceId,outcome:'success',details:{emailDomain:email.split('@')[1],productionFoundation:true}});
    return {context:await this.context(issued.sessionKey),csrf:issued.csrf,cookie:issued.cookie};
  }
  async login(input,request,correlationId){
    const email=normalizeEmail(input.email);const user=await this.repository.findUserByEmail(email);const valid=user?await verifyPassword(input.password,user.password_hash,{pepper:this.passwordPepper}):false;
    if(!user||!valid||user.status!=='active'){
      await this.auditLedger?.append({eventType:'auth.login.failed.v1',correlationId,actor:{type:'anonymous',id:'unknown'},tenantId:null,workspaceId:null,outcome:'failure',details:{emailHash:sha256(email).slice(0,16),reason:'invalid-credentials'}});
      throw Object.assign(new Error('Invalid email or password'),{status:401,code:'invalid_credentials'});
    }
    const membership=await this.repository.findMembershipForUser(user.user_id);
    if(!membership)throw Object.assign(new Error('No active organization membership'),{status:403,code:'membership_missing'});
    const workspaceIds=membership.workspaceIds??(typeof membership.workspace_ids_json==='string'?JSON.parse(membership.workspace_ids_json):membership.workspace_ids_json);const workspaceId=workspaceIds[0];
    const issued=await this.issueForPrincipal({userId:user.user_id,organizationId:membership.organization_id,workspaceId,request});
    await this.auditLedger?.append({eventType:'auth.login.succeeded.v1',correlationId,actor:{type:'user',id:user.user_id},tenantId:membership.organization_id,workspaceId,outcome:'success',details:{authenticationMethod:'password'}});
    return {context:await this.context(issued.sessionKey),csrf:issued.csrf,cookie:issued.cookie};
  }
  async issueForUser(userId,request,correlationId,{authenticationMethod='passkey',assurance='high'}={}){
    const user=await this.repository.findUserById(userId);if(!user||user.status!=='active')throw Object.assign(new Error('User account is unavailable'),{status:401,code:'account_unavailable'});const membership=await this.repository.findMembershipForUser(userId);if(!membership)throw Object.assign(new Error('No active organization membership'),{status:403,code:'membership_missing'});const workspaceIds=membership.workspaceIds??(typeof membership.workspace_ids_json==='string'?JSON.parse(membership.workspace_ids_json):membership.workspace_ids_json);const workspaceId=workspaceIds[0];const issued=await this.issueForPrincipal({userId,organizationId:membership.organization_id,workspaceId,authenticationMethod,request});if(assurance!=='medium'&&this.repository.setSessionAssurance)await this.repository.setSessionAssurance(issued.session.session_id,assurance);await this.auditLedger?.append({eventType:'auth.session.issued.v2',correlationId,actor:{type:'user',id:userId},tenantId:membership.organization_id,workspaceId,outcome:'success',details:{authenticationMethod,assurance}});return {context:await this.context(issued.sessionKey),csrf:issued.csrf,cookie:issued.cookie};
  }
  async resolveRequest(request){
    const value=parseCookies(request.headers.cookie??'')[SESSION_COOKIE];if(!value)return null;const raw=verifySignedSession(value,this.sessionSecret);if(!raw)return null;
    const session=await this.repository.getSessionByTokenHash(sha256(raw));if(!session||session.revoked_at||Date.parse(session.expires_at)<=Date.now())return null;
    return {mode:'production',sessionKey:this.sessionKey(raw),sessionId:session.session_id,rawToken:raw};
  }
  async context(sessionKey){const raw=this.rawFromSessionKey(sessionKey);if(!raw)return null;const session=await this.repository.getSessionByTokenHash(sha256(raw));if(!session||session.revoked_at||Date.parse(session.expires_at)<=Date.now())return null;await this.repository.touchSession(session.session_id);return mapContext(await this.repository.contextForSession(session.session_id));}
  csrf(sessionKey){const raw=this.rawFromSessionKey(sessionKey);return raw?this.csrfForRawToken(raw):null;}
  async verifyCsrf(sessionKey,provided){const raw=this.rawFromSessionKey(sessionKey);if(!raw||!provided)return false;const session=await this.repository.getSessionByTokenHash(sha256(raw));return Boolean(session)&&sha256(String(provided))===session.csrf_hash&&sha256(this.csrfForRawToken(raw))===session.csrf_hash;}
  async logout(sessionKey,correlationId){const context=await this.context(sessionKey);if(!context)return {cookie:clearSessionCookie({secure:this.secureCookies}),revoked:false};await this.repository.revokeSession(context.session.sessionId,'logout');await this.auditLedger?.append({eventType:'auth.logout.v1',correlationId,actor:{type:'user',id:context.user.userId},tenantId:context.organization.organizationId,workspaceId:context.workspace.workspaceId,outcome:'success',details:{sessionId:context.session.sessionId}});return {cookie:clearSessionCookie({secure:this.secureCookies}),revoked:true};}
  async refresh(sessionKey,request,correlationId){const context=await this.context(sessionKey);if(!context)throw Object.assign(new Error('Session is not active'),{status:401,code:'session_inactive'});const raw=this.rawFromSessionKey(sessionKey);const {token,signed}=issueSessionToken(this.sessionSecret),csrf=this.csrfForRawToken(token),meta=this.requestMetadata(request);const session=await this.repository.rotateSession(context.session.sessionId,{tokenHash:sha256(token),csrfHash:sha256(csrf),expiresAt:addMsIso(this.sessionTtlMs),userAgent:meta.userAgent,ipHash:meta.ipHash});await this.auditLedger?.append({eventType:'auth.session.rotated.v1',correlationId,actor:{type:'user',id:context.user.userId},tenantId:context.organization.organizationId,workspaceId:context.workspace.workspaceId,outcome:'success',details:{oldSessionId:context.session.sessionId,newSessionId:session.session_id}});return {context:await this.context(this.sessionKey(token)),csrf,cookie:serializeSessionCookie(signed,{secure:this.secureCookies,maxAgeSeconds:this.sessionTtlMs/1000})};}
}
