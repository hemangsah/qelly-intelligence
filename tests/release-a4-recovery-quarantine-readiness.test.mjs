import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import {mkdtemp,rm,readdir,readFile} from 'node:fs/promises';
import {SqliteProductionRepository} from '../src/production/sqlite-production-repository.mjs';
import {PostgresProductionRepository} from '../src/production/postgres-production-repository.mjs';
import {AccountRecoveryService} from '../src/production/account-recovery-service.mjs';
import {hashPassword,verifyPassword} from '../src/production/password-hasher.mjs';
import {OutboundNetworkPolicy} from '../src/production/network-policy.mjs';
import {LocalObjectStorage} from '../src/production/object-storage.mjs';
import {startServer} from '../src/server/server.mjs';

const temp=prefix=>mkdtemp(path.join(os.tmpdir(),prefix));
async function registration(repo,email='recover@example.com'){
  const passwordHash=await hashPassword('Old-Qelly-Password-2026!',{});
  const created=await repo.createRegistration({email,passwordHash,displayName:'Recovery User',organizationName:'Recovery Org',organizationSlug:`recovery-${crypto.randomUUID().slice(0,8)}`,workspaceName:'Main',workspaceSlug:'main'});
  return {...created,email};
}

test('A4 account recovery challenge resets password and revokes every active session',async()=>{
  const repo=new SqliteProductionRepository();const user=await registration(repo);const membership=await repo.findMembershipForUser(user.userId);
  await repo.createSession({tokenHash:'token-a',csrfHash:'csrf-a',userId:user.userId,organizationId:user.organizationId,workspaceId:user.workspaceId,authenticationMethod:'password',expiresAt:new Date(Date.now()+3600000).toISOString()});
  const jobs=[];const service=new AccountRecoveryService({repository:repo,jobQueue:{enqueue:async job=>(jobs.push(job),job)},passwordPepper:'',environment:{NODE_ENV:'test',QELLY_EXPOSE_RECOVERY_CODE_IN_DEVELOPMENT:'true'}});
  const requested=await service.request({email:user.email},'recovery-request');assert.ok(requested.challengeId);assert.match(requested.developmentCode,/^[0-9]{6}$/);assert.equal(jobs.length,1);assert.equal(jobs[0].tenantId,membership.organization_id);
  const result=await service.reset({challengeId:requested.challengeId,code:requested.developmentCode,newPassword:'New-Qelly-Password-2026!'},'recovery-reset');assert.equal(result.reset,true);assert.equal(result.revokedSessions,1);
  const row=await repo.findUserById(user.userId);assert.equal(await verifyPassword('New-Qelly-Password-2026!',row.password_hash,{}),true);assert.ok((await repo.getSessionById((repo.db.prepare('SELECT session_id FROM sessions LIMIT 1').get()).session_id)).revoked_at);
  await assert.rejects(()=>service.reset({challengeId:requested.challengeId,code:requested.developmentCode,newPassword:'Another-Qelly-Password-2026!'},'replay'),e=>e.code==='account_recovery_used');repo.close();
});

test('A4 recovery request is non-enumerating for unknown accounts',async()=>{const repo=new SqliteProductionRepository();const service=new AccountRecoveryService({repository:repo,jobQueue:{enqueue:async()=>{}},environment:{NODE_ENV:'test',QELLY_EXPOSE_RECOVERY_CODE_IN_DEVELOPMENT:'true'}});const result=await service.request({email:'missing@example.com'},'missing');assert.equal(result.accepted,true);assert.equal(result.challengeId,null);assert.equal(result.developmentCode,null);repo.close();});

test('A4 outbound policy blocks loopback private metadata and non-HTTPS targets',async()=>{
  const policy=new OutboundNetworkPolicy({resolveHost:async host=>host==='public.example'?[{address:'93.184.216.34',family:4}]:[{address:'127.0.0.1',family:4}]});
  await assert.rejects(()=>policy.validate('http://public.example/hook'),e=>e.code==='outbound_https_required');
  await assert.rejects(()=>policy.validate('https://private.example/hook'),e=>e.code==='outbound_private_destination_blocked');
  await assert.rejects(()=>policy.validate('https://169.254.169.254/latest/meta-data'),e=>e.code==='outbound_private_destination_blocked');
  const ok=await policy.validate('https://public.example/hook');assert.equal(ok.origin,'https://public.example');
});

test('A4 local object storage quarantines before release and rejects malware signatures',async()=>{
  const root=await temp('qelly-a4-storage-');const storage=new LocalObjectStorage({root});
  const clean=await storage.put({tenantId:'org',workspaceId:'ws',fileName:'clean.csv',mimeType:'text/csv',content:Buffer.from('a,b\n1,2')});assert.equal(clean.status,'released');assert.equal(clean.quarantineStatus,'released');
  const quarantine=await readdir(path.join(root,'quarantine'));assert.equal(quarantine.length,0);
  await assert.rejects(()=>storage.put({tenantId:'org',workspaceId:'ws',fileName:'bad.txt',content:Buffer.from('EICAR-STANDARD-ANTIVIRUS-TEST-FILE')}),e=>e.code==='malware_detected');await rm(root,{recursive:true,force:true});
});

test('A4 repositories expose recovery parity and migration contract',async()=>{for(const name of ['createAccountRecoveryChallenge','getAccountRecoveryChallenge','consumeAccountRecoveryChallenge','updateUserPassword','revokeAllUserSessions']){assert.equal(typeof SqliteProductionRepository.prototype[name],'function');assert.equal(typeof PostgresProductionRepository.prototype[name],'function');}const sql=await readFile(new URL('../packages/migrations/103_release_a4_recovery_quarantine_network_policy.sql',import.meta.url),'utf8');assert.match(sql,/qelly_account_recovery_challenges/);});

test('A4 server exposes public recovery and authenticated readiness surfaces',async()=>{const dir=await temp('qelly-a4-server-');const started=await startServer({port:0,runtimePath:dir,environment:{...process.env,NODE_ENV:'test',QELLY_PRODUCTION_FOUNDATION_ENABLED:'true',QELLY_PRODUCTION_IDENTITY_ENABLED:'true',QELLY_DEVELOPMENT_IDENTITY_ENABLED:'false',QELLY_DATABASE_MODE:'sqlite',QELLY_JOB_QUEUE_MODE:'database',QELLY_SESSION_SECRET:'release-a4-test-session-secret-0000000001',QELLY_PASSWORD_PEPPER:'a4-pepper',QELLY_EXPOSE_RECOVERY_CODE_IN_DEVELOPMENT:'true'}});const base=`http://${started.host}:${started.port}`;try{const config=await (await fetch(base+'/api/v1/config')).json();assert.equal(config.release,'27.0.0');assert.ok(config.routes.length>=60);assert.ok(config.apiRoutes.length>=175);assert.ok(config.apiRoutes.includes('/api/v1/public/markets/overview'));assert.equal((await fetch(base+'/api/v1/auth/recovery/request',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:'missing@example.com'})})).status,202);assert.equal((await fetch(base+'/api/v1/platform/readiness')).status,401);const reg=await fetch(base+'/api/v1/auth/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:'a4@example.com',password:'Qelly-A4-Password-2026!',displayName:'A4 User',organizationName:'A4 Org',workspaceName:'A4 Workspace'})});const cookie=reg.headers.get('set-cookie').split(';')[0];assert.equal((await fetch(base+'/api/v1/platform/readiness',{headers:{Cookie:cookie}})).status,200);}finally{await new Promise(r=>started.server.close(r));started.runtime.productionRepository?.close?.();await rm(dir,{recursive:true,force:true});}});

test('A4 frontend registers recovery and readiness route modules',async()=>{const [registry,app,login]=await Promise.all(['../apps/web/public/assets/route-registry.mjs','../apps/web/public/assets/app.js','../apps/web/public/assets/routes/auth-login.mjs'].map(x=>readFile(new URL(x,import.meta.url),'utf8')));for(const route of ['auth-recovery','platform-readiness'])assert.match(registry,new RegExp(route));assert.match(app,/renderAuthRecovery/);assert.match(app,/renderPlatformReadiness/);assert.match(login,/data-recovery/);});
