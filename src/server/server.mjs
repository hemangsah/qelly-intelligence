import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import { marketOverview, marketRows, instruments as legacyInstruments, watchlist, assetDossier } from './fixtures.mjs';
import { validatePreference } from './preferences-store.mjs';
import { createRuntime as buildRuntime } from './runtime.mjs';
import { release, productVersion, routes, apiRoutes, contracts } from './route-manifest.mjs';
import { initializeProductionFoundation, productionFoundationHealth } from '../production/production-foundation.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '../..');
const publicDir = path.join(rootDir, 'apps/web/public');
const packageDir = path.join(rootDir, 'packages');
const defaultRuntimeDir = path.join(rootDir, 'runtime');
const publicApiPaths = new Set(['/api/v1/config','/api/v1/auth/status','/api/v1/auth/register','/api/v1/auth/login','/api/v1/auth/passkeys/authenticate/options','/api/v1/auth/passkeys/authenticate/verify','/api/v1/auth/recovery/request','/api/v1/auth/recovery/status','/api/v1/auth/recovery/reset','/api/v1/production-foundation/status','/api/v1/public/markets/overview','/api/v1/public/markets/assets','/api/v1/public/providers']);
function isPublicApiPath(pathname){return publicApiPaths.has(pathname)||/^\/api\/v1\/public\/markets\/assets\/[^/]+(?:\/candles)?$/.test(pathname);}

const securityHeaders = {
  'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' wss://stream.binance.com:9443; font-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
  'X-Frame-Options': 'DENY', 'X-Content-Type-Options':'nosniff', 'Referrer-Policy':'no-referrer',
  'Permissions-Policy':'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
  'Cross-Origin-Opener-Policy':'same-origin', 'Cross-Origin-Resource-Policy':'same-origin',
  'X-Permitted-Cross-Domain-Policies':'none'
};

export function createRuntime(runtimeDir) { return buildRuntime({runtimeDir,packageDir}); }

function correlationId(request) { return request.headers['x-correlation-id']?.slice(0,128) || crypto.randomUUID(); }
function json(response, status, body, id, extra={}) {
  response.writeHead(status,{...securityHeaders,'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Correlation-Id':id,...extra});
  response.end(JSON.stringify(body,null,2));
}
function error(response,status,code,message,id,details=null,retryable=false){ json(response,status,{error:{code,message,details,retryable},correlationId:id,timestamp:new Date().toISOString()},id); }
async function bodyJson(request, limit=256000){
  let size=0; const chunks=[];
  for await (const chunk of request){ size+=chunk.length; if(size>limit) throw Object.assign(new Error('Request body too large'),{status:413,code:'request_too_large'}); chunks.push(chunk); }
  if(!chunks.length) return {};
  try{return JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw Object.assign(new Error('Malformed JSON body'),{status:400,code:'malformed_json'});}
}
async function requireCsrf(runtime, request, sid, pathname) {
  if (['GET','HEAD','OPTIONS'].includes(request.method)) return;
  const origin=String(request.headers.origin??'').replace(/\/$/,'');
  if (request.headers['sec-fetch-site'] === 'cross-site'&&!runtime.corsAllowedOrigins?.has(origin)) throw Object.assign(new Error('Cross-site state change blocked'),{status:403,code:'csrf_blocked'});
  if (['/api/v1/auth/register','/api/v1/auth/login','/api/v1/auth/passkeys/authenticate/options','/api/v1/auth/passkeys/authenticate/verify','/api/v1/auth/recovery/request','/api/v1/auth/recovery/reset'].includes(pathname)) return;
  if (!sid || !(await runtime.identityService.verifyCsrf(sid, request.headers['x-qelly-csrf']))) throw Object.assign(new Error('Missing or invalid session-bound CSRF proof'),{status:403,code:'csrf_invalid'});
}
function requestOrigin(request){const explicit=String(request.headers.origin??'').replace(/\/$/,'');if(explicit)return explicit;const proto=request.socket?.encrypted?'https':'http';return `${proto}://${request.headers.host??'localhost:4480'}`;}
function idempotencyKey(request) {
  const value=request.headers['idempotency-key'];
  if(!value||String(value).length<8||String(value).length>128) throw Object.assign(new Error('A valid Idempotency-Key header is required'),{status:400,code:'idempotency_key_required'});
  return String(value);
}
async function idempotent(runtime, request, body, handler) {
  const key=idempotencyKey(request); const fingerprint=runtime.idempotencyStore.fingerprint(body);
  const existing=runtime.idempotencyStore.get(key,fingerprint); if(existing)return {...existing,idempotency:{replayed:true,key}};
  const value=await handler(); runtime.idempotencyStore.put(key,fingerprint,value); return {...value,idempotency:{replayed:false,key}};
}
async function scopedContext(runtime,sid,action){const {context}=await runtime.identityService.require(sid,action);return {context,scope:{userId:context.user.userId,tenantId:context.organization.organizationId,workspaceId:context.workspace.workspaceId}};}
async function serveFile(response, filePath, id){
  try{
    const info=await stat(filePath); if(!info.isFile()) throw new Error('not-file');
    const ext=path.extname(filePath).toLowerCase();
    const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.csv':'text/csv; charset=utf-8','.md':'text/markdown; charset=utf-8','.d.ts':'text/plain; charset=utf-8'};
    response.writeHead(200,{...securityHeaders,'Content-Type':types[ext]||'application/octet-stream','Cache-Control':ext==='.html'?'no-store':'public, max-age=300','X-Correlation-Id':id});
    response.end(await readFile(filePath));
  }catch{ error(response,404,'not_found','Resource not found',id); }
}

export function createServer({runtime=createRuntime(defaultRuntimeDir)}={}){
  return http.createServer(async (request,response)=>{
    const id=correlationId(request); const url=new URL(request.url,'http://127.0.0.1');
    const requestCorsOrigin=String(request.headers.origin??'').replace(/\/$/,'');
    const corsAllowed=Boolean(requestCorsOrigin&&runtime.corsAllowedOrigins?.has(requestCorsOrigin));
    if(corsAllowed){response.setHeader('Access-Control-Allow-Origin',requestCorsOrigin);response.setHeader('Access-Control-Allow-Credentials','true');response.setHeader('Vary','Origin');}
    if(request.method==='OPTIONS'){
      if(!corsAllowed)return error(response,403,'cors_origin_forbidden','Cross-origin request origin is not allowlisted',id);
      response.writeHead(204,{...securityHeaders,'Access-Control-Allow-Methods':'GET,HEAD,POST,PUT,PATCH,DELETE,OPTIONS','Access-Control-Allow-Headers':'Content-Type,X-Qelly-CSRF,Idempotency-Key,X-Correlation-Id','Access-Control-Max-Age':'600','X-Correlation-Id':id});response.end();return;
    }
    const resolvedIdentity=await runtime.identityService.resolveRequest(request);
    const sid=resolvedIdentity.sessionKey;
    const finishObservation=runtime.observability.startRequest({correlationId:id,method:request.method,path:url.pathname});
    response.once('finish',()=>finishObservation({statusCode:response.statusCode}));
    const rate=runtime.requestLimiter.consume(`${request.socket.remoteAddress}:${url.pathname}`,1);
    if(!rate.allowed)return error(response,429,'rate_limited','Local request rate limit exceeded',id,rate,true);
    try{
      await requireCsrf(runtime,request,sid,url.pathname);
      if(request.method==='GET' && url.pathname==='/api/health') {
        const foundation=await productionFoundationHealth(runtime);
        return json(response,200,{status:'ok',project:'Qelly Intelligence',release,mode:runtime.productionFoundation,safety:{liveTrading:false,transfers:false,withdrawals:false,privateKeys:false,recoveryPhrases:false,productionSecretsInBrowser:false,externalProviders:'optional-public-read-only',licensedFeeds:false},dependencies:foundation.dependencies,truthBoundary:'Qelly provides a tested local security and persistence foundation plus documented public read-only market adapters. External infrastructure and licensed providers operate only when explicitly configured. Live trading, custody, transfers, withdrawals, private keys and recovery phrases remain disabled.'},id);
      }
      if(request.method==='GET' && url.pathname==='/api/ready') {
        const foundation=await productionFoundationHealth(runtime);
        const ready=Boolean(foundation.ready);
        return json(response,ready?200:503,{ready,release,mode:runtime.productionFoundation,dependencies:{...foundation.dependencies,productionIdentity:runtime.productionFoundation?.productionIdentityEnabled?'enabled':'disabled',localIdentityRuntime:runtime.productionFoundation?.developmentIdentityEnabled?'ready':'disabled',localProviderRuntime:'ready',persistentInstrumentMaster:'ready-local-atomic-json',persistentTimeSeries:'ready-local-atomic-json',streamJournal:'ready-local-atomic-json',observability:'ready-local-in-process',externalTelemetry:'disabled',externalProviders:'optional-read-only',licensedEntitlements:'not-configured',liveMarketData:runtime.liveMarketService.status().mode,auditCanonicalization:'ready-recursive-v2',schemaValidation:'ready-runtime'}},id);
      }
      if(request.method==='GET' && url.pathname==='/api/v1/config') {
        const context=await runtime.identityService.context(sid).catch(()=>null);
        return json(response,200,{productName:'Qelly Intelligence',productVersion,release,routes,apiRoutes,themes:['scalper-velocity','investor-compound','aggressive-alpha','quant-operator','research-oracle','signal-access'],defaultRoute:context?'discovery-hub':'market',csrf:{header:'X-Qelly-CSRF',token:sid?runtime.identityService.issueCsrf(sid):null,mode:sid?(String(sid).startsWith('prod:')?'database-session-derived':'random-session-bound-local-token'):'unavailable-until-authenticated',expiresHours:8},auth:{authenticated:Boolean(context),mode:resolvedIdentity.mode,productionIdentityEnabled:Boolean(runtime.productionFoundation?.productionIdentityEnabled),developmentIdentityEnabled:Boolean(runtime.productionFoundation?.developmentIdentityEnabled)},states:['default','loading','empty','partial','error','offline','stale','delayed','simulated','mobile','reduced-motion','high-contrast'],waveStatus:{wave0:'verified and frozen',wave1:'implemented foundation',wave2:'implemented local identity/security foundation',wave3:'implemented deterministic provider, entitlement, quality and persistent instrument foundation',wave4:'implemented persistent time-series, replayable streams and local observability',wave5:'implemented deterministic public discovery and federated search',wave6:'implemented advanced asset intelligence local foundation',wave7:'implemented local workspace operations',part21:'implemented guided onboarding, notification schedules, formula screeners, attribution, imports, research versions and migration contracts',part22:'locked sovereign burgundy gradient, six persona operating modes and read-only public live-market adapters',releaseA1:'production-platform foundation: database-backed identity and jobs',releaseA2:'MFA enrollment, secure object storage imports, delivery attempts, backup/restore and deployment hardening',releaseA3:'passkeys, encrypted MFA secrets, recovery-code consumption, PostgreSQL parity, S3-compatible storage and signed delivery operations',releaseA4:'single-use account recovery, quarantine-before-release imports, outbound SSRF policy and consolidated readiness evidence',releaseA5:'versioned secret rewrapping, manual quarantine review, delivery sandbox verification, concurrency and backup/restore assurance drills, and staging manifests'},liveTrading:false,developmentIdentity:{enabled:Boolean(runtime.productionFoundation?.developmentIdentityEnabled),header:'X-Qelly-Session-Id',defaultFixtureSession:runtime.productionFoundation?.developmentIdentityEnabled?'sess-local-primary':null},schemaValidation:runtime.schemaRegistry.coverage()},id);
      }

      if(request.method==='GET' && url.pathname==='/api/v1/public/providers') {
        return json(response,200,{catalog:runtime.publicMarketService.catalog(),status:runtime.publicMarketService.status()},id);
      }
      if(request.method==='GET' && url.pathname==='/api/v1/public/markets/overview') {
        return json(response,200,await runtime.publicMarketService.overview(),id,{'Cache-Control':'public, max-age=10, stale-while-revalidate=30'});
      }
      if(request.method==='GET' && url.pathname==='/api/v1/public/markets/assets') {
        return json(response,200,await runtime.publicMarketService.assets({q:url.searchParams.get('q')??'',sort:url.searchParams.get('sort')??'rank',direction:url.searchParams.get('direction')??'asc',limit:url.searchParams.get('limit')??100}),id,{'Cache-Control':'public, max-age=10, stale-while-revalidate=30'});
      }
      if(request.method==='GET' && /^\/api\/v1\/public\/markets\/assets\/[^/]+$/.test(url.pathname)) {
        const assetId=decodeURIComponent(url.pathname.split('/').at(-1));
        return json(response,200,await runtime.publicMarketService.asset(assetId),id,{'Cache-Control':'public, max-age=10, stale-while-revalidate=30'});
      }
      if(request.method==='GET' && /^\/api\/v1\/public\/markets\/assets\/[^/]+\/candles$/.test(url.pathname)) {
        const assetId=decodeURIComponent(url.pathname.split('/').at(-2));
        const asset=await runtime.publicMarketService.asset(assetId);
        const result=await runtime.liveMarketService.candles({provider:url.searchParams.get('provider')??'binance',symbol:asset.providerSymbol,interval:url.searchParams.get('interval')??'1h',limit:url.searchParams.get('limit')??168,mode:url.searchParams.get('mode')??'auto'});
        return json(response,200,{...result,canonicalId:asset.canonicalId,assetName:asset.name},id,{'Cache-Control':'public, max-age=10, stale-while-revalidate=30'});
      }

      if(!sid && url.pathname.startsWith('/api/v1/') && !isPublicApiPath(url.pathname)) return error(response,401,'session_required','A session header is required when development identity is disabled',id);

      if(request.method==='GET' && url.pathname==='/api/v1/evidence/graphs') {
        const {scope}=await scopedContext(runtime,sid,'evidence:read');
        return json(response,200,await runtime.decisionProvenanceStore.list(scope,{limit:url.searchParams.get('limit')??25}),id);
      }
      if(request.method==='POST' && url.pathname==='/api/v1/evidence/explain-move') {
        const body=await bodyJson(request);runtime.schemaRegistry.validate('evidence-explain-move-input',body,{status:400,code:'request_schema_invalid'});
        const {scope}=await scopedContext(runtime,sid,'evidence:write');
        const result=await idempotent(runtime,request,body,async()=>{
          const asset=await runtime.publicMarketService.asset(body.canonicalId);
          return runtime.decisionProvenanceStore.explainMove(scope,{asset,thesis:body.thesis,consideredAction:body.consideredAction,horizon:body.horizon,confidence:body.confidence,notes:body.notes},id);
        });
        return json(response,201,result,id);
      }
      if(request.method==='GET' && /^\/api\/v1\/evidence\/graphs\/[^/]+\/traverse$/.test(url.pathname)) {
        const {scope}=await scopedContext(runtime,sid,'evidence:read');const graphId=decodeURIComponent(url.pathname.split('/')[5]);
        return json(response,200,await runtime.decisionProvenanceStore.traverse(scope,graphId,{nodeId:url.searchParams.get('nodeId'),direction:url.searchParams.get('direction')??'both',depth:url.searchParams.get('depth')??2}),id);
      }
      if(request.method==='GET' && /^\/api\/v1\/evidence\/graphs\/[^/]+\/export$/.test(url.pathname)) {
        const {scope}=await scopedContext(runtime,sid,'evidence:read');const graphId=decodeURIComponent(url.pathname.split('/')[5]);
        return json(response,200,await runtime.decisionProvenanceStore.exportPackage(scope,graphId,id),id,{'Content-Disposition':`attachment; filename="qelly-evidence-${graphId}.json"`});
      }
      if(request.method==='GET' && /^\/api\/v1\/evidence\/graphs\/[^/]+$/.test(url.pathname)) {
        const {scope}=await scopedContext(runtime,sid,'evidence:read');const graphId=decodeURIComponent(url.pathname.split('/').at(-1));
        return json(response,200,await runtime.decisionProvenanceStore.graph(scope,graphId),id);
      }
      if(request.method==='GET' && url.pathname==='/api/v1/auth/status') {
        const context=await runtime.identityService.context(sid).catch(()=>null);
        return json(response,200,{authenticated:Boolean(context),mode:resolvedIdentity.mode,context,productionFoundation:runtime.productionFoundation},id);
      }
      if(request.method==='POST' && url.pathname==='/api/v1/auth/register') {
        if(!runtime.productionAuthService)throw Object.assign(new Error('Production authentication foundation is unavailable'),{status:503,code:'production_auth_unavailable'});
        const body=await bodyJson(request);runtime.schemaRegistry.validate('auth-register-input',body,{status:400,code:'request_schema_invalid'});
        const result=await runtime.productionAuthService.register(body,request,id);return json(response,201,{context:result.context,csrf:{header:'X-Qelly-CSRF',token:result.csrf},registrationDelivery:result.registrationDelivery,mode:'production-foundation'},id,{'Set-Cookie':result.cookie});
      }
      if(request.method==='POST' && url.pathname==='/api/v1/auth/login') {
        if(!runtime.productionAuthService)throw Object.assign(new Error('Production authentication foundation is unavailable'),{status:503,code:'production_auth_unavailable'});
        const body=await bodyJson(request);runtime.schemaRegistry.validate('auth-login-input',body,{status:400,code:'request_schema_invalid'});
        const result=await runtime.productionAuthService.login(body,request,id);return json(response,200,{context:result.context,csrf:{header:'X-Qelly-CSRF',token:result.csrf},mode:'production-foundation'},id,{'Set-Cookie':result.cookie});
      }
      if(request.method==='POST' && url.pathname==='/api/v1/auth/recovery/request') {
        if(!runtime.accountRecoveryService)throw Object.assign(new Error('Account recovery service is unavailable'),{status:503,code:'account_recovery_unavailable'});
        const body=await bodyJson(request);runtime.schemaRegistry.validate('account-recovery-request',body,{status:400,code:'request_schema_invalid'});return json(response,202,await runtime.accountRecoveryService.request(body,id),id);
      }
      if(request.method==='GET' && url.pathname==='/api/v1/auth/recovery/status') {
        if(!runtime.accountRecoveryService)throw Object.assign(new Error('Account recovery service is unavailable'),{status:503,code:'account_recovery_unavailable'});return json(response,200,await runtime.accountRecoveryService.status(url.searchParams.get('challengeId')),id);
      }
      if(request.method==='POST' && url.pathname==='/api/v1/auth/recovery/reset') {
        if(!runtime.accountRecoveryService)throw Object.assign(new Error('Account recovery service is unavailable'),{status:503,code:'account_recovery_unavailable'});const body=await bodyJson(request);runtime.schemaRegistry.validate('account-recovery-reset',body,{status:400,code:'request_schema_invalid'});return json(response,200,await runtime.accountRecoveryService.reset(body,id),id);
      }
      if(request.method==='POST' && url.pathname==='/api/v1/auth/logout') {
        if(!runtime.productionAuthService||!String(sid??'').startsWith('prod:'))throw Object.assign(new Error('Production session required'),{status:401,code:'production_session_required'});
        const result=await runtime.productionAuthService.logout(sid,id);return json(response,200,{revoked:result.revoked},id,{'Set-Cookie':result.cookie});
      }
      if(request.method==='POST' && url.pathname==='/api/v1/auth/refresh') {
        if(!runtime.productionAuthService||!String(sid??'').startsWith('prod:'))throw Object.assign(new Error('Production session required'),{status:401,code:'production_session_required'});
        const result=await runtime.productionAuthService.refresh(sid,request,id);return json(response,200,{context:result.context,csrf:{header:'X-Qelly-CSRF',token:result.csrf}},id,{'Set-Cookie':result.cookie});
      }
      if(request.method==='GET' && url.pathname==='/api/v1/auth/mfa/status'){const {context}=await runtime.identityService.require(sid,'identity:read');return json(response,200,await runtime.mfaService.status(context.user.userId),id);}
      if(request.method==='POST' && url.pathname==='/api/v1/auth/mfa/enroll'){const {context}=await runtime.identityService.require(sid,'identity:write');return json(response,200,await runtime.mfaService.begin(context.user,id),id);}
      if(request.method==='POST' && url.pathname==='/api/v1/auth/mfa/confirm'){const body=await bodyJson(request);runtime.schemaRegistry.validate('mfa-confirm-input',body,{status:400,code:'request_schema_invalid'});const {context}=await runtime.identityService.require(sid,'identity:write');return json(response,200,await runtime.mfaService.confirm(context.user,body.code,id),id);}
      if(request.method==='POST' && url.pathname==='/api/v1/auth/mfa/disable'){const body=await bodyJson(request);runtime.schemaRegistry.validate('mfa-confirm-input',body,{status:400,code:'request_schema_invalid'});const {context}=await runtime.identityService.require(sid,'identity:write');return json(response,200,await runtime.mfaService.disable(context.user,body.code,id),id);}
      if(request.method==='POST' && url.pathname==='/api/v1/auth/mfa/recovery/consume'){const body=await bodyJson(request);runtime.schemaRegistry.validate('mfa-recovery-input',body,{status:400,code:'request_schema_invalid'});const {context}=await runtime.identityService.require(sid,'identity:write');return json(response,200,await runtime.mfaService.consumeRecoveryCode(context.user,body.code,id),id);}
      if(request.method==='POST' && url.pathname==='/api/v1/auth/mfa/recovery/regenerate'){const body=await bodyJson(request);runtime.schemaRegistry.validate('mfa-confirm-input',body,{status:400,code:'request_schema_invalid'});const {context}=await runtime.identityService.require(sid,'identity:write');return json(response,200,await runtime.mfaService.regenerateRecoveryCodes(context.user,body.code,id),id);}
      if(request.method==='GET' && url.pathname==='/api/v1/auth/passkeys'){const {context}=await runtime.identityService.require(sid,'identity:read');return json(response,200,{items:await runtime.passkeyService.list(context.user.userId),rpId:runtime.passkeyService.rpId},id);}
      if(request.method==='POST' && url.pathname==='/api/v1/auth/passkeys/register/options'){const body=await bodyJson(request);const {context}=await runtime.identityService.require(sid,'identity:write');return json(response,200,await runtime.passkeyService.beginRegistration(context.user,{origin:requestOrigin(request),label:body.label}),id);}
      if(request.method==='POST' && url.pathname==='/api/v1/auth/passkeys/register/verify'){const body=await bodyJson(request);runtime.schemaRegistry.validate('passkey-registration-input',body,{status:400,code:'request_schema_invalid'});const {context}=await runtime.identityService.require(sid,'identity:write');return json(response,201,await runtime.passkeyService.verifyRegistration(context.user,body,id),id);}
      if(request.method==='POST' && url.pathname==='/api/v1/auth/passkeys/authenticate/options'){const body=await bodyJson(request);runtime.schemaRegistry.validate('passkey-auth-options-input',body,{status:400,code:'request_schema_invalid'});return json(response,200,await runtime.passkeyService.beginAuthentication({email:body.email,origin:requestOrigin(request)}),id);}
      if(request.method==='POST' && url.pathname==='/api/v1/auth/passkeys/authenticate/verify'){const body=await bodyJson(request);runtime.schemaRegistry.validate('passkey-authentication-input',body,{status:400,code:'request_schema_invalid'});const verified=await runtime.passkeyService.verifyAuthentication(body,id);const result=await runtime.productionAuthService.issueForUser(verified.userId,request,id,{authenticationMethod:'passkey',assurance:'high'});return json(response,200,{context:result.context,csrf:{header:'X-Qelly-CSRF',token:result.csrf},mode:'production-passkey'},id,{'Set-Cookie':result.cookie});}
      if(request.method==='DELETE' && /^\/api\/v1\/auth\/passkeys\/[^/]+$/.test(url.pathname)){const {context}=await runtime.identityService.require(sid,'identity:write');return json(response,200,await runtime.passkeyService.revoke(context.user,decodeURIComponent(url.pathname.split('/').at(-1)),id),id);}
      if(request.method==='GET' && url.pathname==='/api/v1/secure-imports'){const {context}=await runtime.identityService.require(sid,'workspace:read');return json(response,200,{items:await runtime.productionRepository.listSecureImports({userId:context.user.userId,tenantId:context.organization.organizationId,workspaceId:context.workspace.workspaceId})},id);}
      if(request.method==='GET' && url.pathname==='/api/v1/secure-imports/quarantine'){const {context}=await runtime.identityService.require(sid,'workspace:read');return json(response,200,{items:await runtime.productionRepository.listSecureImports({userId:context.user.userId,tenantId:context.organization.organizationId,workspaceId:context.workspace.workspaceId,status:'quarantined'}),scanner:runtime.objectStorage?.scanner?.status?.()??{mode:runtime.objectStorage?.scanner?.mode??'unavailable'}},id);}
      if(request.method==='POST' && url.pathname==='/api/v1/secure-imports'){const body=await bodyJson(request,14*1024*1024);runtime.schemaRegistry.validate('secure-import-input',body,{status:400,code:'request_schema_invalid'});const {context}=await runtime.identityService.require(sid,'workspace:write');const content=Buffer.from(body.contentBase64??'','base64');const object=await runtime.objectStorage.put({tenantId:context.organization.organizationId,workspaceId:context.workspace.workspaceId,fileName:body.fileName,mimeType:body.mimeType,content});const record=await runtime.productionRepository.createSecureImport({userId:context.user.userId,tenantId:context.organization.organizationId,workspaceId:context.workspace.workspaceId,object});await runtime.auditLedger.append({eventType:'import.secure.stored.v1',correlationId:id,actor:{type:'user',id:context.user.userId},tenantId:context.organization.organizationId,workspaceId:context.workspace.workspaceId,outcome:'success',details:{importId:record.import_id,sha256:record.sha256,size:record.size,status:record.status}});return json(response,201,record,id);}
      if(request.method==='POST' && url.pathname==='/api/v1/secure-imports/quarantine'){const body=await bodyJson(request,14*1024*1024);runtime.schemaRegistry.validate('secure-import-input',body,{status:400,code:'request_schema_invalid'});const {context}=await runtime.identityService.require(sid,'workspace:write');const content=Buffer.from(body.contentBase64??'','base64');const object=await runtime.objectStorage.quarantine({tenantId:context.organization.organizationId,workspaceId:context.workspace.workspaceId,fileName:body.fileName,mimeType:body.mimeType,content});const record=await runtime.productionRepository.createSecureImport({userId:context.user.userId,tenantId:context.organization.organizationId,workspaceId:context.workspace.workspaceId,object});await runtime.auditLedger.append({eventType:'import.secure.quarantined.v1',correlationId:id,actor:{type:'user',id:context.user.userId},tenantId:context.organization.organizationId,workspaceId:context.workspace.workspaceId,outcome:'success',details:{importId:record.import_id,sha256:record.sha256,size:record.size}});return json(response,201,record,id);}
      if(request.method==='POST' && /^\/api\/v1\/secure-imports\/[^/]+\/rescan$/.test(url.pathname)){const {context}=await runtime.identityService.require(sid,'workspace:write');const importId=decodeURIComponent(url.pathname.split('/')[4]),record=await runtime.productionRepository.getSecureImport(importId);if(!record||record.user_id!==context.user.userId||record.tenant_id!==context.organization.organizationId||record.workspace_id!==context.workspace.workspaceId)throw Object.assign(new Error('Secure import not found'),{status:404,code:'secure_import_not_found'});if(record.status!=='quarantined')throw Object.assign(new Error('Secure import is not quarantined'),{status:409,code:'secure_import_not_quarantined'});const object=await runtime.objectStorage.rescan(record.object_key,{fileName:record.file_name,mimeType:record.mime_type});const updated=await runtime.productionRepository.updateSecureImport({importId,objectKey:object.key,status:'released',scanProvider:object.scanner,scanResult:object.scanResult});await runtime.auditLedger.append({eventType:'import.secure.released.v1',correlationId:id,actor:{type:'user',id:context.user.userId},tenantId:context.organization.organizationId,workspaceId:context.workspace.workspaceId,outcome:'success',details:{importId,scanner:object.scanner}});return json(response,200,updated,id);}
      if(request.method==='DELETE' && /^\/api\/v1\/secure-imports\/[^/]+\/quarantine$/.test(url.pathname)){const {context}=await runtime.identityService.require(sid,'workspace:write');const importId=decodeURIComponent(url.pathname.split('/')[4]),record=await runtime.productionRepository.getSecureImport(importId);if(!record||record.user_id!==context.user.userId||record.tenant_id!==context.organization.organizationId||record.workspace_id!==context.workspace.workspaceId)throw Object.assign(new Error('Secure import not found'),{status:404,code:'secure_import_not_found'});if(record.status!=='quarantined')throw Object.assign(new Error('Secure import is not quarantined'),{status:409,code:'secure_import_not_quarantined'});await runtime.objectStorage.discard(record.object_key);const updated=await runtime.productionRepository.updateSecureImport({importId,status:'discarded',scanResult:'discarded-by-user'});await runtime.auditLedger.append({eventType:'import.secure.discarded.v1',correlationId:id,actor:{type:'user',id:context.user.userId},tenantId:context.organization.organizationId,workspaceId:context.workspace.workspaceId,outcome:'success',details:{importId}});return json(response,200,updated,id);}
      if(request.method==='GET' && /^\/api\/v1\/secure-imports\/[^/]+\/download$/.test(url.pathname)){const {context}=await runtime.identityService.require(sid,'workspace:read');const importId=decodeURIComponent(url.pathname.split('/')[4]),record=await runtime.productionRepository.getSecureImport(importId);if(!record||record.user_id!==context.user.userId||record.tenant_id!==context.organization.organizationId||record.workspace_id!==context.workspace.workspaceId)throw Object.assign(new Error('Secure import not found'),{status:404,code:'secure_import_not_found'});if(record.status!=='released')throw Object.assign(new Error('Secure import is not released'),{status:409,code:'secure_import_not_released'});const download=await runtime.objectStorage.signedDownload(record.object_key,{expiresSeconds:url.searchParams.get('expiresSeconds')??300});await runtime.auditLedger.append({eventType:'import.secure.download-authorized.v1',correlationId:id,actor:{type:'user',id:context.user.userId},tenantId:context.organization.organizationId,workspaceId:context.workspace.workspaceId,outcome:'success',details:{importId,expiresAt:download.expiresAt??null}});return json(response,200,{importId,fileName:record.file_name,mimeType:record.mime_type,...download},id);}
      if(request.method==='DELETE' && /^\/api\/v1\/secure-imports\/[^/]+$/.test(url.pathname)){const {context}=await runtime.identityService.require(sid,'workspace:write');const importId=decodeURIComponent(url.pathname.split('/')[4]),record=await runtime.productionRepository.getSecureImport(importId);if(!record||record.user_id!==context.user.userId||record.tenant_id!==context.organization.organizationId||record.workspace_id!==context.workspace.workspaceId)throw Object.assign(new Error('Secure import not found'),{status:404,code:'secure_import_not_found'});if(record.status!=='released')throw Object.assign(new Error('Secure import is not released'),{status:409,code:'secure_import_not_released'});await runtime.objectStorage.delete(record.object_key);const updated=await runtime.productionRepository.updateSecureImport({importId,status:'deleted',scanResult:'deleted-by-user'});await runtime.auditLedger.append({eventType:'import.secure.deleted.v1',correlationId:id,actor:{type:'user',id:context.user.userId},tenantId:context.organization.organizationId,workspaceId:context.workspace.workspaceId,outcome:'success',details:{importId}});return json(response,200,updated,id);}
      if(request.method==='GET' && url.pathname==='/api/v1/storage/status'){await runtime.identityService.require(sid,'workspace:read');return json(response,200,{...(await runtime.objectStorage.health()),mode:runtime.objectStorage.mode,truthBoundary:runtime.objectStorage.mode==='local-filesystem'?'Local filesystem adapter; not distributed object storage.':'S3-compatible SigV4 adapter configured.'},id);}
      if(request.method==='GET' && url.pathname==='/api/v1/delivery/providers'){await runtime.identityService.require(sid,'notification:read');return json(response,200,runtime.deliveryService.providers(),id);}
      if(request.method==='GET' && url.pathname==='/api/v1/delivery-attempts'){const {context}=await runtime.identityService.require(sid,'notification:read');return json(response,200,{items:await runtime.productionRepository.listDeliveryAttempts({userId:context.user.userId,tenantId:context.organization.organizationId,workspaceId:context.workspace.workspaceId})},id);}
      if(request.method==='POST' && url.pathname==='/api/v1/jobs/delivery'){const body=await bodyJson(request);runtime.schemaRegistry.validate('delivery-job-input',body,{status:400,code:'request_schema_invalid'});const {context}=await runtime.identityService.require(sid,'job:write');const channel=body.channel==='webhook'?'webhook':'email';const job=await runtime.jobQueue.enqueue({tenantId:context.organization.organizationId,workspaceId:context.workspace.workspaceId,jobType:`notification.${channel}`,payload:{userId:context.user.userId,tenantId:context.organization.organizationId,workspaceId:context.workspace.workspaceId,destination:body.destination,title:body.title,body:body.body},idempotencyKey:request.headers['idempotency-key']??null});return json(response,202,job,id);}
      if(request.method==='GET' && url.pathname==='/api/v1/production-foundation/status') return json(response,200,await productionFoundationHealth(runtime),id);
      if(request.method==='GET' && url.pathname==='/api/v1/security/secret-protection/status'){await runtime.identityService.require(sid,'identity:read');return json(response,200,await runtime.secretRotationService.status(),id);}
      if(request.method==='POST' && url.pathname==='/api/v1/security/secret-protection/rewrap'){const {context}=await runtime.identityService.require(sid,'identity:write');return json(response,200,await runtime.secretRotationService.rewrapMfaSecrets({actor:context.user.userId,tenantId:context.organization.organizationId,workspaceId:context.workspace.workspaceId,correlationId:id}),id);}
      if(request.method==='GET' && url.pathname==='/api/v1/platform/assurance'){await runtime.identityService.require(sid,'job:read');return json(response,200,await runtime.platformAssuranceService.status(),id);}
      if(request.method==='POST' && url.pathname==='/api/v1/platform/assurance/concurrency'){const body=await bodyJson(request);runtime.schemaRegistry.validate('assurance-concurrency-input',body,{status:400,code:'request_schema_invalid'});const {context}=await runtime.identityService.require(sid,'job:write');return json(response,200,await runtime.platformAssuranceService.runConcurrencyExercise({tenantId:context.organization.organizationId,workspaceId:context.workspace.workspaceId,actor:context.user.userId,correlationId:id,iterations:body.iterations}),id);}
      if(request.method==='POST' && url.pathname==='/api/v1/platform/assurance/backup-restore'){const {context}=await runtime.identityService.require(sid,'job:write');return json(response,200,await runtime.platformAssuranceService.runBackupRestoreDrill({tenantId:context.organization.organizationId,workspaceId:context.workspace.workspaceId,actor:context.user.userId,correlationId:id}),id);}
      if(request.method==='POST' && url.pathname==='/api/v1/platform/assurance/delivery-sandbox'){const {context}=await runtime.identityService.require(sid,'job:write');return json(response,200,await runtime.platformAssuranceService.deliverySandboxEvidence({tenantId:context.organization.organizationId,workspaceId:context.workspace.workspaceId,actor:context.user.userId,correlationId:id}),id);}
      if(request.method==='GET' && url.pathname==='/api/v1/platform/staging-manifest'){await runtime.identityService.require(sid,'job:read');return serveFile(response,path.join(rootDir,'deploy','staging','manifest.json'),id);}
      if(request.method==='GET' && url.pathname==='/api/v1/platform/readiness') {
        await runtime.identityService.require(sid,'job:read');
        const foundation=await productionFoundationHealth(runtime);const providers=runtime.deliveryService?.providers?.()??{};
        const gates=[
          {id:'database',label:'Transactional database',status:foundation.dependencies.database.ok?'ready':'blocked',detail:foundation.dependencies.database.driver},
          {id:'jobs',label:'Persistent worker queue',status:foundation.dependencies.jobs.ok?'ready':'blocked',detail:foundation.dependencies.jobs.driver},
          {id:'storage',label:'Quarantined object storage',status:foundation.dependencies.objectStorage.ok?'ready':'blocked',detail:`${foundation.dependencies.objectStorage.driver} · ${foundation.dependencies.objectStorage.quarantine??'unknown'}`},
          {id:'delivery',label:'Outbound delivery policy',status:providers.outboundPolicy?'ready':'partial',detail:providers.outboundPolicy?.policy??'local sink only'},
          {id:'recovery',label:'Account recovery',status:runtime.accountRecoveryService?'ready':'blocked',detail:'single-use challenge + session revocation'},
          {id:'passkeys',label:'Passkeys',status:runtime.passkeyService?'ready':'blocked',detail:'ES256 WebAuthn foundation'},
          {id:'secrets',label:'Versioned secret protection',status:foundation.dependencies.secrets?.protector?.rotationSupported?'ready':'partial',detail:foundation.dependencies.secrets?.protector?.mode??'unavailable'},
          {id:'scanner',label:'Malware scanner',status:foundation.dependencies.objectStorage?.scanner==='clamav-tcp-instream'?'ready':'partial',detail:foundation.dependencies.objectStorage?.scanner??'unavailable'},
          {id:'assurance',label:'Assurance drills',status:runtime.platformAssuranceService?'ready':'blocked',detail:'concurrency + backup/restore + delivery sandbox'},
          {id:'staging',label:'Cloud staging',status:'deferred',detail:'manifests included; external deployment and credentials required'}
        ];
        return json(response,200,{release,gates,summary:{ready:gates.filter(x=>x.status==='ready').length,partial:gates.filter(x=>x.status==='partial').length,deferred:gates.filter(x=>x.status==='deferred').length,blocked:gates.filter(x=>x.status==='blocked').length},safety:{liveTrading:false,custody:false,transfers:false,withdrawals:false,privateKeys:false,recoveryPhrases:false}},id);
      }
      if(request.method==='GET' && url.pathname==='/api/v1/jobs') { const {context}=await runtime.identityService.require(sid,'job:read'); return json(response,200,{items:await runtime.jobQueue.list({tenantId:context.organization.organizationId,limit:Number(url.searchParams.get('limit')??100)}),queueMode:runtime.jobQueue.mode},id); }
      if(request.method==='GET' && /^\/api\/v1\/jobs\/[^/]+$/.test(url.pathname)) { const {context}=await runtime.identityService.require(sid,'job:read'); const job=await runtime.productionRepository.getJob(decodeURIComponent(url.pathname.split('/').at(-1))); if(!job||job.tenant_id!==context.organization.organizationId)throw Object.assign(new Error('Job not found'),{status:404,code:'job_not_found'}); return json(response,200,job,id); }
      if(request.method==='POST' && url.pathname==='/api/v1/jobs/notifications') { const body=await bodyJson(request);runtime.schemaRegistry.validate('notification-job-input',body,{status:400,code:'request_schema_invalid'});const {context}=await runtime.identityService.require(sid,'job:write');const job=await runtime.jobQueue.enqueue({tenantId:context.organization.organizationId,workspaceId:context.workspace.workspaceId,jobType:body.digest?'notification.digest':'notification.inapp',payload:{userId:context.user.userId,tenantId:context.organization.organizationId,workspaceId:context.workspace.workspaceId,kind:body.kind,title:body.title,body:body.body},idempotencyKey:request.headers['idempotency-key']??null});await runtime.auditLedger.append({eventType:'job.queued.v1',correlationId:id,actor:{type:'user',id:context.user.userId},tenantId:context.organization.organizationId,workspaceId:context.workspace.workspaceId,outcome:'success',details:{jobId:job.job_id,jobType:job.job_type}});return json(response,202,job,id); }
      if(request.method==='GET' && url.pathname==='/api/v1/production-notifications') { const {context}=await runtime.identityService.require(sid,'notification:read'); return json(response,200,{items:await runtime.productionRepository.listNotifications({userId:context.user.userId,tenantId:context.organization.organizationId,workspaceId:context.workspace.workspaceId,limit:Number(url.searchParams.get('limit')??100)})},id); }
      if(request.method==='GET' && ['/api/v1/session/context','/api/v1/identity/context'].includes(url.pathname)) {
        const context=await runtime.identityService.context(sid); if(!context)return error(response,401,'session_not_found','Local session not found',id); return json(response,200,context,id);
      }
      if(request.method==='GET' && url.pathname==='/api/v1/workspaces') return json(response,200,{items:await runtime.identityService.listWorkspaces(sid)},id);
      if(request.method==='GET' && url.pathname==='/api/v1/sessions') return json(response,200,{items:await runtime.identityService.listSessions(sid)},id);
      if(request.method==='GET' && url.pathname==='/api/v1/devices') return json(response,200,{items:await runtime.identityService.listDevices(sid)},id);
      if(request.method==='POST' && url.pathname==='/api/v1/auth/step-up/simulate') return json(response,200,await runtime.identityService.simulateStepUp(sid,id),id);
      if(request.method==='DELETE' && url.pathname.startsWith('/api/v1/sessions/')) return json(response,200,await runtime.identityService.revokeSession(sid,decodeURIComponent(url.pathname.split('/').at(-1)),id),id);
      if(request.method==='POST' && /^\/api\/v1\/workspaces\/[^/]+\/switch$/.test(url.pathname)) {
        const workspaceId=decodeURIComponent(url.pathname.split('/')[4]); return json(response,200,await runtime.identityService.switchWorkspace(sid,workspaceId,id),id);
      }
      if(request.method==='POST' && url.pathname==='/api/v1/access/evaluate') {
        const body=await bodyJson(request); return json(response,200,await runtime.identityService.evaluate(sid,body.action,body.resource??{}),id);
      }
      if(request.method==='GET' && url.pathname==='/api/v1/privacy/consents') return json(response,200,{items:await runtime.identityService.listConsents(sid)},id);
      if(request.method==='PUT' && url.pathname.startsWith('/api/v1/privacy/consents/')) {
        const body=await bodyJson(request); return json(response,200,await runtime.identityService.updateConsent(sid,decodeURIComponent(url.pathname.split('/').at(-1)),body.status,id),id);
      }
      if(request.method==='GET' && url.pathname==='/api/v1/privacy/data-inventory') return json(response,200,await runtime.identityService.privacyInventory(sid),id);

      if(request.method==='GET' && url.pathname==='/api/v1/live-markets/catalog') { await runtime.identityService.require(sid,'provider:read'); return json(response,200,runtime.liveMarketService.catalog(),id); }
      if(request.method==='GET' && url.pathname==='/api/v1/live-markets/status') { await runtime.identityService.require(sid,'provider:read'); return json(response,200,runtime.liveMarketService.status(),id); }
      if(request.method==='GET' && url.pathname==='/api/v1/live-markets/candles') {
        await runtime.identityService.require(sid,'provider:read');
        const result=await runtime.liveMarketService.candles({provider:url.searchParams.get('provider')??'fixture',symbol:url.searchParams.get('symbol')??'BTCUSDT',interval:url.searchParams.get('interval')??'1m',limit:url.searchParams.get('limit')??240,mode:url.searchParams.get('mode')??'auto'});
        return json(response,200,result,id,{ 'X-Qelly-Data-Mode':result.source.mode });
      }
      if(request.method==='GET' && url.pathname==='/api/v1/live-markets/ticker') {
        await runtime.identityService.require(sid,'provider:read');
        const result=await runtime.liveMarketService.ticker({provider:url.searchParams.get('provider')??'fixture',symbol:url.searchParams.get('symbol')??'BTCUSDT',interval:url.searchParams.get('interval')??'1m',mode:url.searchParams.get('mode')??'auto'});
        return json(response,200,result,id,{ 'X-Qelly-Data-Mode':result.source.mode });
      }

      if(request.method==='GET' && url.pathname==='/api/v1/market/overview') return json(response,200,marketOverview,id);
      if(request.method==='GET' && url.pathname==='/api/v1/rankings') {
        const assetClass=url.searchParams.get('assetClass'); const rows=assetClass?marketRows.filter((row)=>row.assetClass===assetClass):marketRows;
        return json(response,200,{items:rows,nextCursor:null,total:rows.length,mode:'deterministic-fixture'},id);
      }
      if(request.method==='GET' && url.pathname==='/api/v1/search'){
        return json(response,200,runtime.discoveryService.search({q:url.searchParams.get('q')??'',types:url.searchParams.get('types')??'',assetClass:url.searchParams.get('assetClass'),limit:url.searchParams.get('limit')??25,cursor:url.searchParams.get('cursor')}),id);
      }
      if(request.method==='GET' && url.pathname==='/api/v1/search/suggestions') return json(response,200,{items:runtime.discoveryService.suggestions(url.searchParams.get('q')??'')},id);
      if(request.method==='GET' && url.pathname.startsWith('/api/v1/assets/')) {
        const canonicalId=decodeURIComponent(url.pathname.split('/').at(-1)); const dossier=assetDossier(canonicalId);
        try { const history=await runtime.timeSeriesStore.query({canonicalId:dossier.instrument.canonicalId,interval:url.searchParams.get('interval')??'1h',limit:64}); dossier.chart={series:history.points.map((point)=>({label:point.at,value:Number(point.close),...point})),metadata:history.metadata}; } catch {}
        return json(response,200,dossier,id);
      }
      if(request.method==='GET' && url.pathname==='/api/v1/watchlist') return json(response,200,{id:'watchlist-demo',name:'Institutional monitor',items:watchlist,mode:'local-fixture'},id);

      if(request.method==='GET' && url.pathname==='/api/v1/workspace/watchlists') { const {scope}=await scopedContext(runtime,sid,'watchlist:read'); return json(response,200,await runtime.workspaceOperationsStore.listWatchlists(scope),id); }
      if(request.method==='POST' && url.pathname==='/api/v1/workspace/watchlists') { const body=await bodyJson(request); runtime.schemaRegistry.validate('watchlist-input',body,{status:400,code:'request_schema_invalid'}); const {scope}=await scopedContext(runtime,sid,'watchlist:write'); return json(response,200,await idempotent(runtime,request,body,()=>runtime.workspaceOperationsStore.createWatchlist(scope,body,id)),id); }
      if(request.method==='GET' && /^\/api\/v1\/workspace\/watchlists\/[^/]+$/.test(url.pathname)) { const {scope}=await scopedContext(runtime,sid,'watchlist:read'); return json(response,200,await runtime.workspaceOperationsStore.getWatchlist(scope,decodeURIComponent(url.pathname.split('/').at(-1))),id); }
      if(request.method==='PATCH' && /^\/api\/v1\/workspace\/watchlists\/[^/]+$/.test(url.pathname)) { const body=await bodyJson(request); const {scope}=await scopedContext(runtime,sid,'watchlist:write'); return json(response,200,await idempotent(runtime,request,body,()=>runtime.workspaceOperationsStore.updateWatchlist(scope,decodeURIComponent(url.pathname.split('/').at(-1)),body,id)),id); }
      if(request.method==='DELETE' && /^\/api\/v1\/workspace\/watchlists\/[^/]+$/.test(url.pathname)) { const watchlistId=decodeURIComponent(url.pathname.split('/').at(-1)); const {scope}=await scopedContext(runtime,sid,'watchlist:write'); return json(response,200,await idempotent(runtime,request,{watchlistId},()=>runtime.workspaceOperationsStore.deleteWatchlist(scope,watchlistId,id)),id); }
      if(request.method==='POST' && /^\/api\/v1\/workspace\/watchlists\/[^/]+\/items$/.test(url.pathname)) { const body=await bodyJson(request); runtime.schemaRegistry.validate('watchlist-item-input',body,{status:400,code:'request_schema_invalid'}); const {scope}=await scopedContext(runtime,sid,'watchlist:write'); const watchlistId=decodeURIComponent(url.pathname.split('/')[5]); return json(response,200,await idempotent(runtime,request,body,()=>runtime.workspaceOperationsStore.addWatchlistItem(scope,watchlistId,body,id)),id); }
      if(request.method==='DELETE' && /^\/api\/v1\/workspace\/watchlists\/[^/]+\/items\/[^/]+$/.test(url.pathname)) { const parts=url.pathname.split('/'); const watchlistId=decodeURIComponent(parts[5]),canonicalId=decodeURIComponent(parts[7]); const {scope}=await scopedContext(runtime,sid,'watchlist:write'); return json(response,200,await idempotent(runtime,request,{watchlistId,canonicalId},()=>runtime.workspaceOperationsStore.removeWatchlistItem(scope,watchlistId,canonicalId,id)),id); }

      if(request.method==='GET' && url.pathname==='/api/v1/alerts/rules') { const {scope}=await scopedContext(runtime,sid,'alert:read'); return json(response,200,await runtime.workspaceOperationsStore.listAlertRules(scope),id); }
      if(request.method==='POST' && url.pathname==='/api/v1/alerts/rules') { const body=await bodyJson(request); runtime.schemaRegistry.validate('alert-rule-input',body,{status:400,code:'request_schema_invalid'}); const {scope}=await scopedContext(runtime,sid,'alert:write'); return json(response,200,await idempotent(runtime,request,body,()=>runtime.workspaceOperationsStore.createAlertRule(scope,body,id)),id); }
      if(request.method==='PATCH' && /^\/api\/v1\/alerts\/rules\/[^/]+$/.test(url.pathname)) { const body=await bodyJson(request); const {scope}=await scopedContext(runtime,sid,'alert:write'); const ruleId=decodeURIComponent(url.pathname.split('/').at(-1)); return json(response,200,await idempotent(runtime,request,body,()=>runtime.workspaceOperationsStore.updateAlertRule(scope,ruleId,body,id)),id); }
      if(request.method==='DELETE' && /^\/api\/v1\/alerts\/rules\/[^/]+$/.test(url.pathname)) { const ruleId=decodeURIComponent(url.pathname.split('/').at(-1)); const {scope}=await scopedContext(runtime,sid,'alert:write'); return json(response,200,await idempotent(runtime,request,{ruleId},()=>runtime.workspaceOperationsStore.deleteAlertRule(scope,ruleId,id)),id); }
      if(request.method==='POST' && url.pathname==='/api/v1/alerts/evaluate') { const {scope}=await scopedContext(runtime,sid,'alert:write'); return json(response,200,await idempotent(runtime,request,{scope},()=>runtime.workspaceOperationsStore.evaluateAlerts(scope,id)),id); }
      if(request.method==='GET' && url.pathname==='/api/v1/notifications') { const {scope}=await scopedContext(runtime,sid,'notification:read'); return json(response,200,await runtime.workspaceOperationsStore.listNotifications(scope,{status:url.searchParams.get('status')??'all',limit:url.searchParams.get('limit')??100}),id); }
      if(request.method==='PUT' && /^\/api\/v1\/notifications\/[^/]+\/read$/.test(url.pathname)) { const notificationId=decodeURIComponent(url.pathname.split('/')[4]); const {scope}=await scopedContext(runtime,sid,'notification:write'); return json(response,200,await runtime.workspaceOperationsStore.markNotificationRead(scope,notificationId,id),id); }
      if(request.method==='POST' && url.pathname==='/api/v1/notifications/read-all') { const {scope}=await scopedContext(runtime,sid,'notification:write'); return json(response,200,await idempotent(runtime,request,{scope},()=>runtime.workspaceOperationsStore.markAllNotificationsRead(scope,id)),id); }

      if(request.method==='GET' && url.pathname==='/api/v1/screeners/catalog') { await runtime.identityService.require(sid,'screener:read'); return json(response,200,runtime.screenerService.catalog(),id); }
      if(request.method==='POST' && url.pathname==='/api/v1/screeners/run') { const body=await bodyJson(request); runtime.schemaRegistry.validate('screener-request',body,{status:400,code:'request_schema_invalid'}); await runtime.identityService.require(sid,'screener:read'); return json(response,200,runtime.screenerService.run(body),id); }
      if(request.method==='GET' && url.pathname==='/api/v1/screeners/saved') { const {scope}=await scopedContext(runtime,sid,'screener:read'); return json(response,200,await runtime.workspaceOperationsStore.listSavedScreeners(scope),id); }
      if(request.method==='POST' && url.pathname==='/api/v1/screeners/saved') { const body=await bodyJson(request); runtime.schemaRegistry.validate('saved-screener-input',body,{status:400,code:'request_schema_invalid'}); const {scope}=await scopedContext(runtime,sid,'screener:write'); return json(response,200,await idempotent(runtime,request,body,()=>runtime.workspaceOperationsStore.saveScreener(scope,body,id)),id); }
      if(request.method==='DELETE' && /^\/api\/v1\/screeners\/saved\/[^/]+$/.test(url.pathname)) { const savedScreenerId=decodeURIComponent(url.pathname.split('/').at(-1)); const {scope}=await scopedContext(runtime,sid,'screener:write'); return json(response,200,await idempotent(runtime,request,{savedScreenerId},()=>runtime.workspaceOperationsStore.deleteScreener(scope,savedScreenerId,id)),id); }

      if(request.method==='GET' && url.pathname==='/api/v1/portfolio/overview') { const {scope}=await scopedContext(runtime,sid,'portfolio:read'); return json(response,200,await runtime.portfolioService.overview(scope),id); }
      if(request.method==='GET' && url.pathname==='/api/v1/portfolio/holdings') { const {scope}=await scopedContext(runtime,sid,'portfolio:read'); return json(response,200,await runtime.portfolioService.holdings(scope),id); }
      if(request.method==='GET' && url.pathname==='/api/v1/portfolio/performance') { const {scope}=await scopedContext(runtime,sid,'portfolio:read'); return json(response,200,await runtime.portfolioService.performance(scope,{range:url.searchParams.get('range')??'1y'}),id); }
      if(request.method==='GET' && url.pathname==='/api/v1/portfolio/risk') { const {scope}=await scopedContext(runtime,sid,'portfolio:read'); return json(response,200,await runtime.portfolioService.risk(scope),id); }

      if(request.method==='GET' && url.pathname==='/api/v1/research/workspaces') { const {scope}=await scopedContext(runtime,sid,'research:read'); return json(response,200,await runtime.workspaceOperationsStore.listResearchWorkspaces(scope),id); }
      if(request.method==='POST' && url.pathname==='/api/v1/research/workspaces') { const body=await bodyJson(request); runtime.schemaRegistry.validate('research-workspace-input',body,{status:400,code:'request_schema_invalid'}); const {scope}=await scopedContext(runtime,sid,'research:write'); return json(response,200,await idempotent(runtime,request,body,()=>runtime.workspaceOperationsStore.createResearchWorkspace(scope,body,id)),id); }
      if(request.method==='GET' && /^\/api\/v1\/research\/workspaces\/[^/]+$/.test(url.pathname)) { const {scope}=await scopedContext(runtime,sid,'research:read'); return json(response,200,await runtime.workspaceOperationsStore.getResearchWorkspace(scope,decodeURIComponent(url.pathname.split('/').at(-1))),id); }
      if(request.method==='PATCH' && /^\/api\/v1\/research\/workspaces\/[^/]+$/.test(url.pathname)) { const body=await bodyJson(request); const {scope}=await scopedContext(runtime,sid,'research:write'); const researchWorkspaceId=decodeURIComponent(url.pathname.split('/').at(-1)); return json(response,200,await idempotent(runtime,request,body,()=>runtime.workspaceOperationsStore.updateResearchWorkspace(scope,researchWorkspaceId,body,id)),id); }
      if(request.method==='DELETE' && /^\/api\/v1\/research\/workspaces\/[^/]+$/.test(url.pathname)) { const researchWorkspaceId=decodeURIComponent(url.pathname.split('/').at(-1)); const {scope}=await scopedContext(runtime,sid,'research:write'); return json(response,200,await idempotent(runtime,request,{researchWorkspaceId},()=>runtime.workspaceOperationsStore.deleteResearchWorkspace(scope,researchWorkspaceId,id)),id); }
      if(request.method==='POST' && /^\/api\/v1\/research\/workspaces\/[^/]+\/items$/.test(url.pathname)) { const body=await bodyJson(request); runtime.schemaRegistry.validate('research-item-input',body,{status:400,code:'request_schema_invalid'}); const {scope}=await scopedContext(runtime,sid,'research:write'); const researchWorkspaceId=decodeURIComponent(url.pathname.split('/')[5]); return json(response,200,await idempotent(runtime,request,body,()=>runtime.workspaceOperationsStore.addResearchItem(scope,researchWorkspaceId,body,id)),id); }


      if(request.method==='GET' && url.pathname==='/api/v1/onboarding/catalog') { await runtime.identityService.require(sid,'preference:read'); return json(response,200,runtime.onboardingStore.catalog(),id); }
      if(request.method==='GET' && url.pathname==='/api/v1/onboarding/profile') { const {scope}=await scopedContext(runtime,sid,'preference:read'); return json(response,200,await runtime.onboardingStore.get(scope),id); }
      if(request.method==='PUT' && url.pathname==='/api/v1/onboarding/profile') { const body=await bodyJson(request); runtime.schemaRegistry.validate('onboarding-profile-input',body,{status:400,code:'request_schema_invalid'}); const {scope}=await scopedContext(runtime,sid,'preference:write'); return json(response,200,await idempotent(runtime,request,body,()=>runtime.onboardingStore.update(scope,body,id)),id); }
      if(request.method==='POST' && url.pathname==='/api/v1/onboarding/complete') { const {scope}=await scopedContext(runtime,sid,'preference:write'); return json(response,200,await idempotent(runtime,request,{scope},()=>runtime.onboardingStore.complete(scope,id)),id); }
      if(request.method==='DELETE' && url.pathname==='/api/v1/onboarding/profile') { const {scope}=await scopedContext(runtime,sid,'preference:write'); return json(response,200,await idempotent(runtime,request,{scope},()=>runtime.onboardingStore.reset(scope,id)),id); }

      if(request.method==='GET' && url.pathname==='/api/v1/notification-schedules/catalog') { await runtime.identityService.require(sid,'alert:read'); return json(response,200,runtime.notificationScheduleStore.catalog(),id); }
      if(request.method==='GET' && url.pathname==='/api/v1/notification-schedules') { const {scope}=await scopedContext(runtime,sid,'alert:read'); return json(response,200,await runtime.notificationScheduleStore.list(scope),id); }
      if(request.method==='POST' && url.pathname==='/api/v1/notification-schedules') { const body=await bodyJson(request); runtime.schemaRegistry.validate('notification-schedule-input',body,{status:400,code:'request_schema_invalid'}); const {scope}=await scopedContext(runtime,sid,'alert:write'); return json(response,200,await idempotent(runtime,request,body,()=>runtime.notificationScheduleStore.create(scope,body,id)),id); }
      if(request.method==='PATCH' && /^\/api\/v1\/notification-schedules\/[^/]+$/.test(url.pathname)) { const body=await bodyJson(request); const {scope}=await scopedContext(runtime,sid,'alert:write'); const scheduleId=decodeURIComponent(url.pathname.split('/').at(-1)); return json(response,200,await idempotent(runtime,request,body,()=>runtime.notificationScheduleStore.update(scope,scheduleId,body,id)),id); }
      if(request.method==='DELETE' && /^\/api\/v1\/notification-schedules\/[^/]+$/.test(url.pathname)) { const scheduleId=decodeURIComponent(url.pathname.split('/').at(-1)); const {scope}=await scopedContext(runtime,sid,'alert:write'); return json(response,200,await idempotent(runtime,request,{scheduleId},()=>runtime.notificationScheduleStore.remove(scope,scheduleId,id)),id); }
      if(request.method==='POST' && url.pathname==='/api/v1/notification-schedules/run-due') { const body=await bodyJson(request); const {scope}=await scopedContext(runtime,sid,'alert:write'); const result=await idempotent(runtime,request,body,()=>runtime.notificationScheduleStore.runDue(scope,{at:body.at},id)); if(!result.idempotency?.replayed) for(const delivery of result.deliveries) await runtime.workspaceOperationsStore.createSystemNotification(scope,{type:'scheduled',severity:'info',title:delivery.title,message:delivery.message,scheduleId:delivery.scheduleId,source:'qelly-local-scheduler'},id); return json(response,200,result,id); }

      if(request.method==='GET' && url.pathname==='/api/v1/screeners/formulas/catalog') { await runtime.identityService.require(sid,'screener:read'); return json(response,200,runtime.screenerService.formulaCatalog(),id); }
      if(request.method==='POST' && url.pathname==='/api/v1/screeners/formulas/run') { const body=await bodyJson(request); runtime.schemaRegistry.validate('formula-screener-request',body,{status:400,code:'request_schema_invalid'}); await runtime.identityService.require(sid,'screener:read'); return json(response,200,runtime.screenerService.runFormula(body),id); }

      if(request.method==='GET' && url.pathname==='/api/v1/portfolio/attribution') { const {scope}=await scopedContext(runtime,sid,'portfolio:read'); return json(response,200,await runtime.portfolioService.attribution(scope,{range:url.searchParams.get('range')??'1y'}),id); }

      if(request.method==='GET' && url.pathname==='/api/v1/imports/templates') { await runtime.identityService.require(sid,'workspace:read'); return json(response,200,runtime.importService.templates(),id); }
      if(request.method==='GET' && url.pathname==='/api/v1/imports') { const {scope}=await scopedContext(runtime,sid,'workspace:read'); return json(response,200,await runtime.importService.list(scope),id); }
      if(request.method==='POST' && url.pathname==='/api/v1/imports/preview') { const body=await bodyJson(request); runtime.schemaRegistry.validate('import-request',body,{status:400,code:'request_schema_invalid'}); await runtime.identityService.require(sid,'workspace:read'); return json(response,200,runtime.importService.preview(body),id); }
      if(request.method==='POST' && url.pathname==='/api/v1/imports/commit') { const body=await bodyJson(request); runtime.schemaRegistry.validate('import-request',body,{status:400,code:'request_schema_invalid'}); const action=body.kind==='watchlist'?'watchlist:write':body.kind==='portfolio'?'portfolio:write':'research:write'; const {scope}=await scopedContext(runtime,sid,action); return json(response,200,await idempotent(runtime,request,body,()=>runtime.importService.commit(scope,body,id)),id); }
      if(request.method==='GET' && /^\/api\/v1\/imports\/[^/]+$/.test(url.pathname)) { const {scope}=await scopedContext(runtime,sid,'workspace:read'); return json(response,200,await runtime.importService.get(scope,decodeURIComponent(url.pathname.split('/').at(-1))),id); }

      if(request.method==='GET' && /^\/api\/v1\/research\/workspaces\/[^/]+\/versions$/.test(url.pathname)) { const {scope}=await scopedContext(runtime,sid,'research:read'); const researchWorkspaceId=decodeURIComponent(url.pathname.split('/')[5]); return json(response,200,await runtime.researchVersionStore.list(scope,researchWorkspaceId),id); }
      if(request.method==='POST' && /^\/api\/v1\/research\/workspaces\/[^/]+\/versions$/.test(url.pathname)) { const body=await bodyJson(request); runtime.schemaRegistry.validate('research-version-input',body,{status:400,code:'request_schema_invalid'}); const {scope}=await scopedContext(runtime,sid,'research:write'); const researchWorkspaceId=decodeURIComponent(url.pathname.split('/')[5]); const snapshot=await runtime.workspaceOperationsStore.getResearchWorkspace(scope,researchWorkspaceId); return json(response,200,await idempotent(runtime,request,body,()=>runtime.researchVersionStore.capture(scope,researchWorkspaceId,snapshot,body,id)),id); }
      if(request.method==='GET' && /^\/api\/v1\/research\/workspaces\/[^/]+\/versions\/[^/]+$/.test(url.pathname)) { const {scope}=await scopedContext(runtime,sid,'research:read'); const parts=url.pathname.split('/'); return json(response,200,await runtime.researchVersionStore.get(scope,decodeURIComponent(parts[5]),decodeURIComponent(parts[7])),id); }
      if(request.method==='POST' && /^\/api\/v1\/research\/workspaces\/[^/]+\/versions\/[^/]+\/restore$/.test(url.pathname)) { const {scope}=await scopedContext(runtime,sid,'research:write'); const parts=url.pathname.split('/'); const researchWorkspaceId=decodeURIComponent(parts[5]),versionId=decodeURIComponent(parts[7]); return json(response,200,await idempotent(runtime,request,{researchWorkspaceId,versionId},async()=>{ const snapshot=await runtime.researchVersionStore.markRestored(scope,researchWorkspaceId,versionId,id); return runtime.workspaceOperationsStore.restoreResearchWorkspace(scope,researchWorkspaceId,snapshot,id); }),id); }
      if(request.method==='GET' && url.pathname==='/api/v1/research/version-diff') { const {scope}=await scopedContext(runtime,sid,'research:read'); return json(response,200,await runtime.researchVersionStore.compare(scope,url.searchParams.get('workspaceId'),url.searchParams.get('left'),url.searchParams.get('right')),id); }

      if(request.method==='GET' && url.pathname==='/api/v1/platform/migrations/plan') { await runtime.identityService.require(sid,'observability:read'); return json(response,200,runtime.migrationPlanService.plan(),id); }
      if(request.method==='GET' && url.pathname==='/api/v1/platform/migrations/status') { await runtime.identityService.require(sid,'observability:read'); return json(response,200,runtime.migrationPlanService.status(),id); }


      if(request.method==='GET' && url.pathname==='/api/v1/discovery/overview') return json(response,200,runtime.discoveryService.overview(),id);
      if(request.method==='GET' && url.pathname==='/api/v1/discovery/rankings') return json(response,200,runtime.discoveryService.rankings({assetClass:url.searchParams.get('assetClass'),category:url.searchParams.get('category'),region:url.searchParams.get('region'),sort:url.searchParams.get('sort')??'marketCap',direction:url.searchParams.get('direction')??'desc',q:url.searchParams.get('q')??'',limit:url.searchParams.get('limit')??25,cursor:url.searchParams.get('cursor')}),id);
      if(request.method==='GET' && url.pathname==='/api/v1/discovery/categories') return json(response,200,runtime.discoveryService.categories({assetClass:url.searchParams.get('assetClass'),limit:url.searchParams.get('limit')??50,cursor:url.searchParams.get('cursor')}),id);
      if(request.method==='GET' && /^\/api\/v1\/discovery\/categories\/[^/]+$/.test(url.pathname)) return json(response,200,runtime.discoveryService.category(decodeURIComponent(url.pathname.split('/').at(-1))),id);
      if(request.method==='GET' && url.pathname==='/api/v1/discovery/venues') return json(response,200,runtime.discoveryService.venues({type:url.searchParams.get('type'),assetClass:url.searchParams.get('assetClass'),limit:url.searchParams.get('limit')??25,cursor:url.searchParams.get('cursor')}),id);
      if(request.method==='GET' && /^\/api\/v1\/discovery\/venues\/[^/]+$/.test(url.pathname)) return json(response,200,runtime.discoveryService.venue(decodeURIComponent(url.pathname.split('/').at(-1))),id);
      if(request.method==='GET' && url.pathname==='/api/v1/discovery/dex') return json(response,200,runtime.discoveryService.dex({chain:url.searchParams.get('chain'),sort:url.searchParams.get('sort')??'change24h',limit:url.searchParams.get('limit')??25,cursor:url.searchParams.get('cursor')}),id);
      if(request.method==='GET' && /^\/api\/v1\/discovery\/dex\/[^/]+$/.test(url.pathname)) return json(response,200,runtime.discoveryService.dexPair(decodeURIComponent(url.pathname.split('/').at(-1))),id);
      if(request.method==='GET' && url.pathname==='/api/v1/discovery/global-charts') return json(response,200,runtime.discoveryService.charts(),id);
      if(request.method==='GET' && url.pathname==='/api/v1/discovery/prediction-markets') return json(response,200,runtime.discoveryService.predictionMarkets({category:url.searchParams.get('category')}),id);
      if(request.method==='POST' && url.pathname==='/api/v1/discovery/converter') return json(response,200,runtime.discoveryService.converter(await bodyJson(request)),id);
      if(request.method==='GET' && url.pathname==='/api/v1/discovery/news') return json(response,200,runtime.discoveryService.news({q:url.searchParams.get('q')??'',topic:url.searchParams.get('topic'),assetId:url.searchParams.get('assetId'),limit:url.searchParams.get('limit')??25,cursor:url.searchParams.get('cursor')}),id);
      if(request.method==='GET' && url.pathname==='/api/v1/discovery/research') return json(response,200,runtime.discoveryService.research({q:url.searchParams.get('q')??'',collection:url.searchParams.get('collection'),author:url.searchParams.get('author'),limit:url.searchParams.get('limit')??25,cursor:url.searchParams.get('cursor')}),id);
      if(request.method==='GET' && /^\/api\/v1\/discovery\/research\/[^/]+$/.test(url.pathname)) return json(response,200,runtime.discoveryService.article(decodeURIComponent(url.pathname.split('/').at(-1))),id);
      if(request.method==='GET' && url.pathname==='/api/v1/discovery/methodologies') return json(response,200,runtime.discoveryService.methodologies(),id);
      if(request.method==='GET' && /^\/api\/v1\/discovery\/methodologies\/[^/]+$/.test(url.pathname)) return json(response,200,runtime.discoveryService.methodology(decodeURIComponent(url.pathname.split('/').at(-1))),id);
      if(request.method==='GET' && url.pathname==='/api/v1/discovery/coverage') return json(response,200,runtime.discoveryService.coverage(),id);
      if(request.method==='GET' && url.pathname==='/api/v1/discovery/status') return json(response,200,runtime.discoveryService.status(),id);
      if(request.method==='GET' && url.pathname==='/api/v1/discovery/saved') { const {context}=await runtime.identityService.require(sid,'discovery:read'); return json(response,200,await runtime.savedDiscoveryStore.read({userId:context.user.userId,workspaceId:context.workspace.workspaceId}),id); }
      if(request.method==='POST' && url.pathname==='/api/v1/discovery/saved/searches') { const body=await bodyJson(request); const {context}=await runtime.identityService.require(sid,'discovery:write'); const result=await idempotent(runtime,request,body,()=>runtime.savedDiscoveryStore.saveSearch({userId:context.user.userId,tenantId:context.organization.organizationId,workspaceId:context.workspace.workspaceId,name:body.name,query:body.query,filters:body.filters??{},correlationId:id})); return json(response,200,result,id); }
      if(request.method==='POST' && url.pathname==='/api/v1/discovery/saved/screens') { const body=await bodyJson(request); const {context}=await runtime.identityService.require(sid,'discovery:write'); const result=await idempotent(runtime,request,body,()=>runtime.savedDiscoveryStore.saveScreen({userId:context.user.userId,tenantId:context.organization.organizationId,workspaceId:context.workspace.workspaceId,name:body.name,definition:body.definition??{},correlationId:id})); return json(response,200,result,id); }
      if(request.method==='PUT' && url.pathname==='/api/v1/discovery/saved/compare-tray') { const body=await bodyJson(request); const {context}=await runtime.identityService.require(sid,'discovery:write'); const result=await idempotent(runtime,request,body,()=>runtime.savedDiscoveryStore.updateCompareTray({userId:context.user.userId,tenantId:context.organization.organizationId,workspaceId:context.workspace.workspaceId,canonicalIds:body.canonicalIds??[],correlationId:id})); return json(response,200,result,id); }


      if(request.method==='GET' && url.pathname==='/api/v1/asset-intelligence/layouts') {
        const {context}=await runtime.identityService.require(sid,'market:read'); return json(response,200,await runtime.chartLayoutStore.list({userId:context.user.userId,workspaceId:context.workspace.workspaceId}),id);
      }
      if(request.method==='POST' && url.pathname==='/api/v1/asset-intelligence/layouts') {
        const body=await bodyJson(request); runtime.schemaRegistry.validate('chart-layout-input',body,{status:400,code:'request_schema_invalid'}); const {context}=await runtime.identityService.require(sid,'discovery:write');
        const result=await idempotent(runtime,request,body,()=>runtime.chartLayoutStore.save({userId:context.user.userId,tenantId:context.organization.organizationId,workspaceId:context.workspace.workspaceId,...body,correlationId:id})); return json(response,200,result,id);
      }
      if(request.method==='DELETE' && /^\/api\/v1\/asset-intelligence\/layouts\/[^/]+$/.test(url.pathname)) {
        const {context}=await runtime.identityService.require(sid,'discovery:write'); const layoutId=decodeURIComponent(url.pathname.split('/').at(-1));
        const result=await idempotent(runtime,request,{layoutId},()=>runtime.chartLayoutStore.remove({userId:context.user.userId,tenantId:context.organization.organizationId,workspaceId:context.workspace.workspaceId,layoutId,correlationId:id})); return json(response,200,result,id);
      }
      if(request.method==='POST' && url.pathname==='/api/v1/asset-intelligence/compare/series') {
        const body=await bodyJson(request); runtime.schemaRegistry.validate('asset-comparison-request',body,{status:400,code:'request_schema_invalid'}); await runtime.identityService.require(sid,'market:read'); return json(response,200,runtime.advancedAssetService.compareSeries(body.canonicalIds,{range:body.range??'1y'}),id);
      }
      if(request.method==='POST' && url.pathname==='/api/v1/asset-intelligence/compare/snapshots') {
        const body=await bodyJson(request); runtime.schemaRegistry.validate('asset-comparison-request',body,{status:400,code:'request_schema_invalid'}); await runtime.identityService.require(sid,'market:read'); return json(response,200,{items:body.canonicalIds.map(value=>runtime.advancedAssetService.snapshot(value)),truth:{investmentAdvice:false,externalProviders:false}},id);
      }
      if(request.method==='GET' && /^\/api\/v1\/asset-intelligence\/[^/]+\/filings\/[^/]+$/.test(url.pathname)) {
        await runtime.identityService.require(sid,'market:read'); const parts=url.pathname.split('/'); return json(response,200,runtime.advancedAssetService.filing(decodeURIComponent(parts[4]),decodeURIComponent(parts[6])),id);
      }
      if(request.method==='GET' && /^\/api\/v1\/asset-intelligence\/[^/]+\/(chart|financials|earnings|estimates|corporate-actions|event-calendar)$/.test(url.pathname)) {
        await runtime.identityService.require(sid,'market:read'); const parts=url.pathname.split('/'); const canonicalId=decodeURIComponent(parts[4]); const action=parts[5];
        if(action==='chart')return json(response,200,runtime.advancedAssetService.chart(canonicalId,{range:url.searchParams.get('range')??'1y',interval:url.searchParams.get('interval')??'1d',indicators:(url.searchParams.get('indicators')??'sma,bollinger,macd').split(','),adjusted:url.searchParams.get('adjusted')!=='false'}),id);
        if(action==='financials')return json(response,200,runtime.advancedAssetService.financials(canonicalId,{frequency:url.searchParams.get('frequency')??'annual'}),id);
        if(action==='earnings')return json(response,200,runtime.advancedAssetService.earnings(canonicalId),id);
        if(action==='estimates')return json(response,200,runtime.advancedAssetService.estimates(canonicalId),id);
        if(action==='corporate-actions')return json(response,200,runtime.advancedAssetService.corporateActions(canonicalId),id);
        return json(response,200,runtime.advancedAssetService.eventCalendar(canonicalId,{from:url.searchParams.get('from')??'2026-07-01',to:url.searchParams.get('to')??'2026-12-31',types:(url.searchParams.get('types')??'').split(',').filter(Boolean)}),id);
      }

      if(request.method==='GET' && url.pathname==='/api/v1/schemas/coverage') return json(response,200,runtime.schemaRegistry.coverage(),id);
      if(request.method==='GET' && url.pathname==='/api/v1/asset-intelligence/studies') return json(response,200,runtime.assetIntelligenceService.studies(),id);
      if(request.method==='POST' && url.pathname==='/api/v1/asset-intelligence/compare') {
        const body=await bodyJson(request); return json(response,200,runtime.assetIntelligenceService.compare(body.canonicalIds??[]),id);
      }
      if(request.method==='GET' && /^\/api\/v1\/asset-intelligence\/[^/]+\/(overview|fundamentals|events|filings|peers|technicals)$/.test(url.pathname)) {
        await runtime.identityService.require(sid,'market:read'); const parts=url.pathname.split('/'); const canonicalId=decodeURIComponent(parts[4]); const action=parts[5];
        if(action==='overview')return json(response,200,runtime.assetIntelligenceService.overview(canonicalId),id);
        if(action==='fundamentals')return json(response,200,runtime.assetIntelligenceService.fundamentals(canonicalId),id);
        if(action==='events')return json(response,200,runtime.assetIntelligenceService.events(canonicalId),id);
        if(action==='filings')return json(response,200,runtime.advancedAssetService.filings(canonicalId),id);
        if(action==='peers')return json(response,200,runtime.assetIntelligenceService.peers(canonicalId),id);
        return json(response,200,runtime.assetIntelligenceService.technicals(canonicalId,{study:url.searchParams.get('study')??'sma',length:url.searchParams.get('length')??20}),id);
      }

      if(request.method==='GET' && ['/api/v1/providers/status','/api/v1/providers/runtime'].includes(url.pathname)) return json(response,200,{items:runtime.providerRuntime.registry(),externalCallsPerformed:false,productionCredentialsConfigured:false,credentialValuesExposed:false},id);
      if(request.method==='GET' && /^\/api\/v1\/providers\/[^/]+\/diagnostics$/.test(url.pathname)) {
        await runtime.identityService.require(sid,'provider:diagnose'); const providerId=decodeURIComponent(url.pathname.split('/')[4]); const item=runtime.providerRuntime.registry().find((entry)=>entry.providerId===providerId);
        if(!item)return error(response,404,'provider_not_found','Provider not found',id); return json(response,200,item,id);
      }
      if(request.method==='POST' && url.pathname==='/api/v1/providers/execute') {
        const body=await bodyJson(request); const {context}=await runtime.identityService.require(sid,'provider:read');
        const capability=String(body.capability??'quote'); if(!['search','quote','timeseries'].includes(capability))return error(response,400,'capability_not_allowed','Only read-only fixture capabilities are exposed',id);
        const result=await runtime.providerRuntime.execute({capability,request:body.request??{},context:{correlationId:id,tenantId:context.organization.organizationId,workspaceId:context.workspace.workspaceId,territory:'IN',deadlineMs:Math.max(25,Math.min(Number(body.deadlineMs??250),2000)),scenario:body.scenario??null,use:body.use??'display'}});
        return json(response,200,result,id);
      }
      if(request.method==='POST' && /^\/api\/v1\/providers\/[^/]+\/execute$/.test(url.pathname)) {
        const body=await bodyJson(request); const providerId=decodeURIComponent(url.pathname.split('/')[4]); const {context}=await runtime.identityService.require(sid,'provider:read');
        const capability=String(body.capability??'quote'); if(!['search','quote','timeseries'].includes(capability))return error(response,400,'capability_not_allowed','Only read-only fixture capabilities are exposed',id);
        const result=await runtime.providerRuntime.execute({providerId,capability,request:body.request??{},context:{correlationId:id,tenantId:context.organization.organizationId,workspaceId:context.workspace.workspaceId,territory:'IN',deadlineMs:Math.max(25,Math.min(Number(body.deadlineMs??250),2000)),scenario:body.scenario??null,use:body.use??'display'}});
        return json(response,200,result,id);
      }
      if(request.method==='POST' && url.pathname==='/api/v1/entitlements/evaluate') {
        const body=await bodyJson(request); const {context}=await runtime.identityService.require(sid,'entitlement:evaluate');
        return json(response,200,runtime.entitlementEngine.evaluate({tenantId:context.organization.organizationId,workspaceId:context.workspace.workspaceId,territory:'IN',userClass:'internal-user',...body}),id);
      }

      if(request.method==='GET' && url.pathname==='/api/v1/instruments/summary') { await runtime.identityService.require(sid,'instrument:read'); return json(response,200,await runtime.instrumentStore.summary(),id); }
      if(request.method==='GET' && url.pathname==='/api/v1/instruments/search') {
        await runtime.identityService.require(sid,'instrument:read'); return json(response,200,await runtime.instrumentStore.search({q:url.searchParams.get('q')??'',assetClass:url.searchParams.get('assetClass'),status:url.searchParams.get('status'),limit:url.searchParams.get('limit'),cursor:url.searchParams.get('cursor')}),id);
      }
      if(request.method==='POST' && url.pathname==='/api/v1/instruments/resolve') { await runtime.identityService.require(sid,'instrument:read'); return json(response,200,await runtime.instrumentStore.resolve(await bodyJson(request)),id); }
      if(request.method==='GET' && /^\/api\/v1\/instruments\/[^/]+\/relationships$/.test(url.pathname)) { await runtime.identityService.require(sid,'instrument:read'); return json(response,200,await runtime.instrumentStore.relationships(decodeURIComponent(url.pathname.split('/')[4])),id); }
      if(request.method==='POST' && /^\/api\/v1\/instruments\/[^/]+\/symbol-history$/.test(url.pathname)) {
        const body=await bodyJson(request); const {context}=await runtime.identityService.require(sid,'instrument:govern');
        const result=await idempotent(runtime,request,body,()=>runtime.instrumentStore.recordSymbolChange({canonicalId:decodeURIComponent(url.pathname.split('/')[4]),...body,actorId:context.user.userId,correlationId:id,tenantId:context.organization.organizationId,workspaceId:context.workspace.workspaceId}));
        return json(response,200,result,id);
      }
      if(request.method==='POST' && /^\/api\/v1\/instruments\/[^/]+\/relationships$/.test(url.pathname)) {
        const body=await bodyJson(request); const {context}=await runtime.identityService.require(sid,'instrument:govern');
        const result=await idempotent(runtime,request,body,()=>runtime.instrumentStore.addRelationship({canonicalId:decodeURIComponent(url.pathname.split('/')[4]),...body,actorId:context.user.userId,correlationId:id,tenantId:context.organization.organizationId,workspaceId:context.workspace.workspaceId}));
        return json(response,200,result,id);
      }
      if(request.method==='GET' && /^\/api\/v1\/instruments\/[^/]+$/.test(url.pathname)) { await runtime.identityService.require(sid,'instrument:read'); return json(response,200,await runtime.instrumentStore.get(decodeURIComponent(url.pathname.split('/').at(-1))),id); }

      if(request.method==='GET' && url.pathname==='/api/v1/data-quality/incidents') { await runtime.identityService.require(sid,'quality:read'); return json(response,200,{items:runtime.qualityEngine.listIncidents()},id); }
      if(request.method==='POST' && url.pathname==='/api/v1/data-quality/overrides') {
        const body=await bodyJson(request); const {context}=await runtime.identityService.require(sid,'quality:override');
        const result=await idempotent(runtime,request,body,()=>runtime.qualityEngine.override({...body,actorId:context.user.userId}));
        await runtime.auditLedger.append({eventType:'data-quality.override.created.v1',correlationId:id,actor:{type:'user',id:context.user.userId},tenantId:context.organization.organizationId,workspaceId:context.workspace.workspaceId,details:result});
        return json(response,200,result,id);
      }

      if(request.method==='GET' && url.pathname==='/api/v1/preferences/layout') {
        const {context}=await runtime.identityService.require(sid,'preference:read'); const scope={userId:context.user.userId,tenantId:context.organization.organizationId,workspaceId:context.workspace.workspaceId};
        return json(response,200,await runtime.preferenceStore.read(scope),id);
      }
      if(request.method==='GET' && url.pathname==='/api/v1/preferences/layout/inventory') {
        const {context}=await runtime.identityService.require(sid,'preference:read'); const scope={userId:context.user.userId,tenantId:context.organization.organizationId,workspaceId:context.workspace.workspaceId};
        return json(response,200,await runtime.preferenceStore.inventory(scope),id);
      }
      if(request.method==='PUT' && url.pathname==='/api/v1/preferences/layout'){
        const {context}=await runtime.identityService.require(sid,'preference:write'); const body=await bodyJson(request);
        runtime.schemaRegistry.validate('layout-preference-input',body,{status:400,code:'request_schema_invalid'}); const normalized=validatePreference(body); runtime.schemaRegistry.validate('layout-preference',normalized,{status:400,code:'request_schema_invalid'});
        const scope={userId:context.user.userId,tenantId:context.organization.organizationId,workspaceId:context.workspace.workspaceId};
        const value=await runtime.preferenceStore.write(normalized,scope,request.headers['if-match-revision']);
        await runtime.auditLedger.append({eventType:'layout.preference.updated.v2',correlationId:id,actor:{type:'user',id:context.user.userId},tenantId:context.organization.organizationId,workspaceId:context.workspace.workspaceId,details:{theme:value.theme,density:value.density,motion:value.motion,revision:value.revision,scope:value.scope}});
        return json(response,200,value,id);
      }
      if(request.method==='GET' && url.pathname.startsWith('/api/v1/contracts/')){
        const name=url.pathname.split('/').at(-1); const file=contracts.get(name); if(!file) return error(response,404,'contract_not_found','Unknown contract',id);
        return json(response,200,JSON.parse(await readFile(path.join(packageDir,'contracts',file),'utf8')),id);
      }
      if(request.method==='GET' && url.pathname==='/api/v1/timeseries/summary') { await runtime.identityService.require(sid,'timeseries:read'); return json(response,200,await runtime.timeSeriesStore.summary(),id); }
      if(request.method==='POST' && url.pathname==='/api/v1/timeseries/query') {
        await runtime.identityService.require(sid,'timeseries:read'); const body=await bodyJson(request); return json(response,200,await runtime.timeSeriesStore.query(body),id);
      }
      if(request.method==='GET' && /^\/api\/v1\/timeseries\/[^/]+$/.test(url.pathname)) {
        await runtime.identityService.require(sid,'timeseries:read'); const canonicalId=decodeURIComponent(url.pathname.split('/').at(-1));
        return json(response,200,await runtime.timeSeriesStore.query({canonicalId,interval:url.searchParams.get('interval')??'1h',from:url.searchParams.get('from'),to:url.searchParams.get('to'),limit:url.searchParams.get('limit'),cursor:url.searchParams.get('cursor')}),id);
      }
      if(request.method==='POST' && /^\/api\/v1\/timeseries\/[^/]+\/append$/.test(url.pathname)) {
        const body=await bodyJson(request); runtime.schemaRegistry.validate('timeseries-append-request',body,{status:400,code:'request_schema_invalid'}); const {context}=await runtime.identityService.require(sid,'timeseries:write'); const canonicalId=decodeURIComponent(url.pathname.split('/')[4]);
        const result=await idempotent(runtime,request,body,()=>runtime.timeSeriesStore.append({canonicalId,point:body,actorId:context.user.userId,correlationId:id,tenantId:context.organization.organizationId,workspaceId:context.workspace.workspaceId}));
        return json(response,200,result,id);
      }
      if(request.method==='GET' && url.pathname==='/api/v1/streams/catalog') { await runtime.identityService.require(sid,'stream:read'); return json(response,200,{items:runtime.streamGateway.catalog(),stats:runtime.streamGateway.stats(),productionBrokerConfigured:false},id); }
      if(request.method==='GET' && url.pathname==='/api/v1/streams/replay') {
        await runtime.identityService.require(sid,'stream:read'); return json(response,200,await runtime.streamGateway.replay({channel:url.searchParams.get('channel')??'quotes',afterSequence:url.searchParams.get('afterSequence')??0,resumeToken:url.searchParams.get('resumeToken'),limit:url.searchParams.get('limit')??100}),id);
      }
      if(request.method==='GET' && ['/api/v1/stream/quotes','/api/v1/stream/provider-health'].includes(url.pathname)){
        const action=url.pathname.endsWith('provider-health')?'observability:read':'stream:read'; const {context}=await runtime.identityService.require(sid,action);
        const tenantId=context.organization.organizationId, workspaceId=context.workspace.workspaceId;
        const canonicalIds=(url.searchParams.get('symbols')??marketRows.slice(0,3).map((row)=>row.id).join(',')).split(',').map((value)=>value.trim()).filter(Boolean).slice(0,8);
        const frames=Math.max(1,Math.min(Number(url.searchParams.get('frames')??5),20)); const intervalMs=Math.max(10,Math.min(Number(url.searchParams.get('intervalMs')??180),1000));
        response.writeHead(200,{...securityHeaders,'Content-Type':'text/event-stream; charset=utf-8','Cache-Control':'no-cache, no-transform','Connection':'keep-alive','X-Correlation-Id':id,'X-Accel-Buffering':'no'});
        runtime.streamGateway.connectionOpened(); let closed=false; response.on('close',()=>{closed=true;runtime.streamGateway.connectionClosed();});
        const send=(eventName,value)=>{if(!closed&&!response.writableEnded)response.write(`event: ${eventName}\nid: ${value.resumeToken??value.eventId??''}\ndata: ${JSON.stringify(value)}\n\n`);};
        const initial=url.pathname.endsWith('provider-health')?await runtime.streamGateway.providerHealth({tenantId,workspaceId,correlationId:id}):await runtime.streamGateway.quoteSnapshot({canonicalIds,tenantId,workspaceId,correlationId:id});
        send(initial.eventType,initial);
        for(let index=1;index<frames&&!closed;index+=1){
          await new Promise((resolve)=>setTimeout(resolve,intervalMs));
          const frame=url.pathname.endsWith('provider-health')?await runtime.streamGateway.providerHealth({tenantId,workspaceId,correlationId:id}):await runtime.streamGateway.quoteDelta({canonicalIds,tenantId,workspaceId,correlationId:id,step:index}); send(frame.eventType,frame);
          if(index%3===0){const heartbeat=runtime.streamGateway.heartbeat();send('stream.heartbeat.v1',heartbeat);}
        }
        if(!response.writableEnded)response.end(); return;
      }
      if(request.method==='GET' && url.pathname==='/api/v1/observability/metrics') {
        await runtime.identityService.require(sid,'observability:read'); return json(response,200,runtime.observability.metrics({providerRuntime:runtime.providerRuntime,streamGateway:runtime.streamGateway,timeSeriesSummary:await runtime.timeSeriesStore.summary()}),id);
      }
      if(request.method==='GET' && url.pathname==='/api/v1/observability/overview') {
        await runtime.identityService.require(sid,'observability:read'); return json(response,200,runtime.observability.overview({providerRuntime:runtime.providerRuntime,streamGateway:runtime.streamGateway,timeSeriesSummary:await runtime.timeSeriesStore.summary(),auditIntegrity:await runtime.auditLedger.verify()}),id);
      }
      if(request.method==='GET' && url.pathname==='/api/v1/observability/traces') { await runtime.identityService.require(sid,'observability:read'); return json(response,200,runtime.observability.recentTraces(url.searchParams.get('limit')??100),id); }
      if(request.method==='GET' && url.pathname==='/api/v1/observability/logs') { await runtime.identityService.require(sid,'observability:read'); return json(response,200,runtime.observability.recentLogs(url.searchParams.get('limit')??100),id); }
      if(request.method==='GET' && url.pathname==='/api/v1/audit') { const {context}=await runtime.identityService.require(sid,'audit:read'); return json(response,200,{items:await runtime.auditLedger.list(Number(url.searchParams.get('limit')??100),{tenantId:context.organization.organizationId})},id); }
      if(request.method==='GET' && url.pathname==='/api/v1/audit/verify') { await runtime.identityService.require(sid,'audit:read'); return json(response,200,await runtime.auditLedger.verify(),id); }

      if(request.method==='GET' && url.pathname.startsWith('/packages/')){
        const relative=url.pathname.slice('/packages/'.length); const target=path.resolve(packageDir,relative); if(!target.startsWith(packageDir+path.sep)) return error(response,403,'forbidden','Invalid package path',id); return serveFile(response,target,id);
      }
      if(request.method==='GET' && (url.pathname==='/' || url.pathname==='/index.html')) return serveFile(response,path.join(publicDir,'index.html'),id);
      if(request.method==='GET' && url.pathname==='/qelly-config.js') return serveFile(response,path.join(publicDir,'qelly-config.js'),id);
      if(request.method==='GET' && url.pathname.startsWith('/assets/')){
        const target=path.resolve(publicDir,url.pathname.slice(1)); if(!target.startsWith(publicDir+path.sep)) return error(response,403,'forbidden','Invalid asset path',id); return serveFile(response,target,id);
      }
      if(request.method==='GET' && !url.pathname.startsWith('/api/')) return serveFile(response,path.join(publicDir,'index.html'),id);
      return error(response,404,'route_not_found','API route not found',id);
    }catch(caught){
      const status=Number(caught.status)||500; const code=caught.code||'request_failed';
      const context=await runtime.identityService.context(sid).catch(()=>null);
      await runtime.auditLedger.append({eventType:'request.failed.v1',correlationId:id,actor:{type:context?'user':'anonymous',id:context?.user?.userId??'unknown'},tenantId:context?.organization?.organizationId??null,workspaceId:context?.workspace?.workspaceId??null,outcome:'failure',details:{path:url.pathname,method:request.method,message:caught.message,code}}).catch(()=>{});
      return error(response,status,code,caught.message||'Request failed',id,caught.details??null,Boolean(caught.retryable));
    }
  });
}

export async function startServer({port=Number(process.env.PORT||4480),host=process.env.HOST||'127.0.0.1',runtimePath=process.env.QELLY_RUNTIME_DIR??defaultRuntimeDir,environment=process.env}={}){
  const runtime=createRuntime(runtimePath); await runtime.schemaRegistry.init(); await initializeProductionFoundation(runtime,{runtimeDir:runtimePath,environment}); runtime.schemaRegistry.registerEnforcement({route:'PUT /api/v1/preferences/layout',request:'layout-preference-input',response:'layout-preference'}); runtime.schemaRegistry.registerEnforcement({route:'POST /api/v1/timeseries/:id/append',request:'timeseries-append-request'}); runtime.schemaRegistry.registerEnforcement({route:'POST /api/v1/asset-intelligence/compare/series',request:'asset-comparison-request'}); runtime.schemaRegistry.registerEnforcement({route:'POST /api/v1/asset-intelligence/layouts',request:'chart-layout-input',response:'chart-layout-record'}); runtime.schemaRegistry.registerEnforcement({route:'POST /api/v1/workspace/watchlists',request:'watchlist-input'}); runtime.schemaRegistry.registerEnforcement({route:'POST /api/v1/workspace/watchlists/:id/items',request:'watchlist-item-input'}); runtime.schemaRegistry.registerEnforcement({route:'POST /api/v1/alerts/rules',request:'alert-rule-input'}); runtime.schemaRegistry.registerEnforcement({route:'POST /api/v1/screeners/run',request:'screener-request'}); runtime.schemaRegistry.registerEnforcement({route:'POST /api/v1/research/workspaces',request:'research-workspace-input'}); runtime.schemaRegistry.registerEnforcement({route:'PUT /api/v1/onboarding/profile',request:'onboarding-profile-input'}); runtime.schemaRegistry.registerEnforcement({route:'POST /api/v1/notification-schedules',request:'notification-schedule-input'}); runtime.schemaRegistry.registerEnforcement({route:'POST /api/v1/screeners/formulas/run',request:'formula-screener-request'}); runtime.schemaRegistry.registerEnforcement({route:'POST /api/v1/imports/preview',request:'import-request'}); runtime.schemaRegistry.registerEnforcement({route:'POST /api/v1/research/workspaces/:id/versions',request:'research-version-input'}); runtime.schemaRegistry.registerEnforcement({route:'POST /api/v1/auth/register',request:'auth-register-input'}); runtime.schemaRegistry.registerEnforcement({route:'POST /api/v1/auth/login',request:'auth-login-input'}); runtime.schemaRegistry.registerEnforcement({route:'POST /api/v1/jobs/notifications',request:'notification-job-input'});runtime.schemaRegistry.registerEnforcement({route:'POST /api/v1/auth/mfa/confirm',request:'mfa-confirm-input'});runtime.schemaRegistry.registerEnforcement({route:'POST /api/v1/auth/mfa/disable',request:'mfa-confirm-input'});runtime.schemaRegistry.registerEnforcement({route:'POST /api/v1/secure-imports',request:'secure-import-input'});runtime.schemaRegistry.registerEnforcement({route:'POST /api/v1/jobs/delivery',request:'delivery-job-input'});runtime.schemaRegistry.registerEnforcement({route:'POST /api/v1/auth/mfa/recovery/consume',request:'mfa-recovery-input'});runtime.schemaRegistry.registerEnforcement({route:'POST /api/v1/auth/passkeys/register/verify',request:'passkey-registration-input'});runtime.schemaRegistry.registerEnforcement({route:'POST /api/v1/auth/passkeys/authenticate/options',request:'passkey-auth-options-input'});runtime.schemaRegistry.registerEnforcement({route:'POST /api/v1/auth/passkeys/authenticate/verify',request:'passkey-authentication-input'});runtime.schemaRegistry.registerEnforcement({route:'POST /api/v1/auth/recovery/request',request:'account-recovery-request'});runtime.schemaRegistry.registerEnforcement({route:'POST /api/v1/auth/recovery/reset',request:'account-recovery-reset'});runtime.schemaRegistry.registerEnforcement({route:'POST /api/v1/platform/assurance/concurrency',request:'assurance-concurrency-input'});runtime.schemaRegistry.registerEnforcement({route:'POST /api/v1/evidence/explain-move',request:'evidence-explain-move-input',response:'evidence-graph'}); await runtime.preferenceStore.init(); await runtime.timeSeriesStore.summary(); await runtime.streamGateway.replay({channel:'quotes'}); runtime.observability.log('info','runtime.started',{release,runtimePath:path.basename(runtimePath)});
  if(runtime.productionFoundation?.strictProductionDependencies){const health=await productionFoundationHealth(runtime);if(!health.ready){runtime.jobQueue?.close?.();await runtime.productionRepository?.close?.();throw Object.assign(new Error('Required production dependencies are not ready'),{code:'production_dependencies_unready',details:{productionPolicy:health.productionPolicy,dependencies:Object.fromEntries(Object.entries(health.dependencies).map(([key,value])=>[key,{ok:value?.ok??value?.valid??false,driver:value?.driver??value?.protector?.mode??null,error:value?.error??null}]))}});}}
  const server=createServer({runtime}); await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,host,resolve);});
  return {server,host,port:server.address().port,runtime};
}

if(process.argv[1] && fileURLToPath(import.meta.url)===path.resolve(process.argv[1])){
  const started=await startServer(); console.log(`Qelly Intelligence running at http://${started.host}:${started.port}`);
  let shuttingDown=false;
  const shutdown=async(signal)=>{
    if(shuttingDown)return;shuttingDown=true;started.runtime.observability.log('info','runtime.shutdown.started',{signal});
    const deadline=setTimeout(()=>{console.error(JSON.stringify({level:'error',event:'runtime.shutdown.timeout',signal}));process.exit(1);},Math.max(5000,Number(process.env.QELLY_SHUTDOWN_TIMEOUT_MS??25000)));deadline.unref?.();
    started.server.closeIdleConnections?.();
    await new Promise((resolve)=>started.server.close(resolve));
    started.runtime.jobQueue?.close?.();await started.runtime.productionRepository?.close?.();clearTimeout(deadline);
    started.runtime.observability.log('info','runtime.shutdown.completed',{signal});process.exit(0);
  };
  process.once('SIGTERM',()=>void shutdown('SIGTERM'));process.once('SIGINT',()=>void shutdown('SIGINT'));
}
