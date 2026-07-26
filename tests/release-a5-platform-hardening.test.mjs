import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {SqliteProductionRepository} from '../src/production/sqlite-production-repository.mjs';
import {PostgresProductionRepository} from '../src/production/postgres-production-repository.mjs';
import {VersionedKeyringSecretProtector} from '../src/production/secret-protector.mjs';
import {SecretRotationService} from '../src/production/secret-rotation-service.mjs';
import {LocalObjectStorage,FoundationMalwareScanner,ClamAvTcpScanner} from '../src/production/object-storage.mjs';
import {DeliveryService,SignedWebhookAdapter} from '../src/production/delivery-service.mjs';
import {OutboundNetworkPolicy} from '../src/production/network-policy.mjs';
import {PlatformAssuranceService} from '../src/production/platform-assurance-service.mjs';
import {ProductionJobQueue} from '../src/production/job-queue.mjs';
import {startServer} from '../src/server/server.mjs';

const temp=prefix=>mkdtemp(path.join(os.tmpdir(),prefix));
async function principal(repo,email='a5@example.com'){return repo.createRegistration({email,passwordHash:'x',displayName:'A5 User',organizationName:'A5 Org',organizationSlug:`a5-${crypto.randomUUID().slice(0,8)}`,workspaceName:'Main',workspaceSlug:'main'});}

test('A5 versioned keyring protects, reads, and rewraps envelopes without exposing key material',()=>{
 const oldProtector=new VersionedKeyringSecretProtector({keys:{old:'old-secret-material-abcdefghijklmnopqrstuvwxyz'},activeKeyId:'old',nodeEnv:'test'});
 const envelope=oldProtector.protect('TOP-SECRET',{purpose:'mfa:user'});assert.match(envelope,/^qelly:v2:old:/);
 const rotating=new VersionedKeyringSecretProtector({keys:{old:'old-secret-material-abcdefghijklmnopqrstuvwxyz',next:'next-secret-material-abcdefghijklmnopqrstuvwxyz'},activeKeyId:'next',nodeEnv:'test'});
 assert.equal(rotating.unprotect(envelope,{purpose:'mfa:user'}),'TOP-SECRET');const rewrapped=rotating.rewrap(envelope,{purpose:'mfa:user'});assert.match(rewrapped,/^qelly:v2:next:/);assert.equal(rotating.unprotect(rewrapped,{purpose:'mfa:user'}),'TOP-SECRET');assert.equal(rotating.status().keyMaterialExposed,false);
});

test('A5 secret rotation service rewraps stored MFA factors to configured active key',async()=>{
 const repo=new SqliteProductionRepository();const user=await principal(repo);const old=new VersionedKeyringSecretProtector({keys:{old:'old-secret-material-abcdefghijklmnopqrstuvwxyz'},activeKeyId:'old',nodeEnv:'test'});await repo.upsertMfaFactor({userId:user.userId,secret:old.protect('MFA-SECRET',{purpose:`mfa:${user.userId}`}),status:'active'});
 const protector=new VersionedKeyringSecretProtector({keys:{old:'old-secret-material-abcdefghijklmnopqrstuvwxyz',next:'next-secret-material-abcdefghijklmnopqrstuvwxyz'},activeKeyId:'next',nodeEnv:'test'}),service=new SecretRotationService({repository:repo,secretProtector:protector});const before=await service.status();assert.equal(before.rewrapRequired,true);const result=await service.rewrapMfaSecrets({actor:user.userId,tenantId:user.organizationId,workspaceId:user.workspaceId,correlationId:'a5'});assert.equal(result.rotated,1);const stored=await repo.getMfaFactor(user.userId);assert.match(stored.secret,/^qelly:v2:next:/);repo.close();
});

test('A5 manual quarantine supports explicit rescan release and discard',async()=>{
 const root=await temp('qelly-a5-quarantine-');const storage=new LocalObjectStorage({root,scanner:new FoundationMalwareScanner()});
 const staged=await storage.quarantine({tenantId:'org',workspaceId:'ws',fileName:'review.csv',mimeType:'text/csv',content:Buffer.from('a,b\n1,2')});assert.equal(staged.status,'quarantined');assert.match(staged.key,/^\.quarantine\//);
 const released=await storage.rescan(staged.key,{fileName:staged.fileName,mimeType:staged.mimeType});assert.equal(released.status,'released');assert.equal((await storage.get(released.key)).content.toString(),'a,b\n1,2');
 const discard=await storage.quarantine({tenantId:'org',workspaceId:'ws',fileName:'discard.txt',content:Buffer.from('discard')});assert.equal((await storage.discard(discard.key)).status,'discarded');
 await rm(root,{recursive:true,force:true});
});

test('A5 ClamAV adapter declares INSTREAM provider boundary',()=>{const scanner=new ClamAvTcpScanner({host:'clamav',port:3310});const status=scanner.status();assert.equal(status.mode,'clamav-tcp-instream');assert.equal(status.streaming,true);});

test('A5 delivery sandbox verifies HMAC signatures without external transmission',()=>{
 const adapter=new SignedWebhookAdapter({signingSecret:'a5-signing-secret-abcdefghijklmnopqrstuvwxyz',networkPolicy:new OutboundNetworkPolicy({allowPrivate:true,allowHttp:true})});const service=new DeliveryService({repository:{},mode:'external',webhookAdapter:adapter});const evidence=service.sandboxEvidence();assert.equal(evidence.passed,true);assert.equal(evidence.externalTransmission,false);assert.equal(evidence.signatureAlgorithm,'HMAC-SHA256');
});

test('A5 assurance service exercises idempotent concurrency and checksum restore',async()=>{
 const root=await temp('qelly-a5-assurance-'),repo=new SqliteProductionRepository({filePath:path.join(root,'qelly.sqlite')}),user=await principal(repo),queue=new ProductionJobQueue({repository:repo,mode:'database',nodeEnv:'test'});const service=new PlatformAssuranceService({runtimeDir:root,repository:repo,jobQueue:queue,objectStorage:new LocalObjectStorage({root:path.join(root,'objects')}),deliveryService:new DeliveryService({repository:repo})});
 const concurrency=await service.runConcurrencyExercise({tenantId:user.organizationId,workspaceId:user.workspaceId,actor:user.userId,correlationId:'conc',iterations:32});assert.equal(concurrency.passed,true);assert.equal(concurrency.uniqueJobs,1);
 const backup=await service.runBackupRestoreDrill({tenantId:user.organizationId,workspaceId:user.workspaceId,actor:user.userId,correlationId:'backup'});assert.equal(backup.passed,true);assert.equal(backup.sha256,backup.restoredSha256);repo.close();await rm(root,{recursive:true,force:true});
});

test('A5 repositories expose secret and quarantine parity plus migration contract',async()=>{for(const name of ['listMfaFactors','updateMfaSecret','getSecureImport','updateSecureImport']){assert.equal(typeof SqliteProductionRepository.prototype[name],'function');assert.equal(typeof PostgresProductionRepository.prototype[name],'function');}const sql=await readFile(new URL('../packages/migrations/104_release_a5_platform_hardening.sql',import.meta.url),'utf8');assert.match(sql,/scan_provider/);assert.match(sql,/updated_at/);});

test('Inherited hardening surfaces remain available after public-market expansion',async()=>{
 const dir=await temp('qelly-a5-server-');const environment={...process.env,NODE_ENV:'test',QELLY_PRODUCTION_FOUNDATION_ENABLED:'true',QELLY_PRODUCTION_IDENTITY_ENABLED:'true',QELLY_DEVELOPMENT_IDENTITY_ENABLED:'false',QELLY_DATABASE_MODE:'sqlite',QELLY_JOB_QUEUE_MODE:'database',QELLY_SESSION_SECRET:'release-a5-test-session-secret-0000000001',QELLY_PASSWORD_PEPPER:'a5-pepper',QELLY_SECRET_KEYRING_JSON:JSON.stringify({old:'old-secret-material-abcdefghijklmnopqrstuvwxyz',next:'next-secret-material-abcdefghijklmnopqrstuvwxyz'}),QELLY_SECRET_ACTIVE_KEY_ID:'next'};const started=await startServer({port:0,runtimePath:dir,environment}),base=`http://${started.host}:${started.port}`;
 try{const config=await (await fetch(base+'/api/v1/config')).json();assert.equal(config.release,'27.0.0');assert.ok(config.routes.length>=60);assert.ok(config.apiRoutes.length>=175);assert.ok(config.apiRoutes.includes('/api/v1/public/markets/overview'));const reg=await fetch(base+'/api/v1/auth/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:'server-a5@example.com',password:'Qelly-A5-Password-2026!',displayName:'A5 User',organizationName:'A5 Org',workspaceName:'A5 Workspace'})}),cookie=reg.headers.get('set-cookie').split(';')[0];for(const endpoint of ['/api/v1/security/secret-protection/status','/api/v1/secure-imports/quarantine','/api/v1/platform/assurance','/api/v1/platform/staging-manifest'])assert.equal((await fetch(base+endpoint,{headers:{Cookie:cookie}})).status,200);}finally{await new Promise(r=>started.server.close(r));started.runtime.productionRepository?.close?.();await rm(dir,{recursive:true,force:true});}
});

test('A5 frontend registers secret rotation, quarantine review, and staging assurance',async()=>{const [registry,app]=await Promise.all(['../apps/web/public/assets/route-registry.mjs','../apps/web/public/assets/app.js'].map(x=>readFile(new URL(x,import.meta.url),'utf8')));for(const route of ['secret-rotation','quarantine-review','staging-assurance'])assert.match(registry,new RegExp(route));for(const renderer of ['renderSecretRotation','renderQuarantineReview','renderStagingAssurance'])assert.match(app,new RegExp(renderer));});
