import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {hashPassword,verifyPassword,validatePasswordPolicy} from '../src/production/password-hasher.mjs';
import {issueSessionToken,verifySignedSession,serializeSessionCookie} from '../src/production/session-cookie.mjs';
import {SqliteProductionRepository} from '../src/production/sqlite-production-repository.mjs';
import {ProductionJobQueue} from '../src/production/job-queue.mjs';
import {processJob} from '../apps/worker/worker.mjs';
import {startServer} from '../src/server/server.mjs';

const secret='0123456789abcdef0123456789abcdef';
const env=(extra={})=>({...process.env,NODE_ENV:'test',QELLY_PRODUCTION_FOUNDATION_ENABLED:'true',QELLY_PRODUCTION_IDENTITY_ENABLED:'true',QELLY_DEVELOPMENT_IDENTITY_ENABLED:'false',QELLY_DATABASE_MODE:'sqlite',QELLY_JOB_QUEUE_MODE:'database',QELLY_SESSION_SECRET:secret,QELLY_SECRET_PROTECTION_KEY:'a3-test-secret-protection-key-0123456789',QELLY_ALLOW_LOCAL_OBJECT_STORAGE_IN_PRODUCTION:'true',QELLY_ALLOW_LOCAL_DELIVERY_IN_PRODUCTION:'true',...extra});
const temp=()=>mkdtemp(path.join(os.tmpdir(),'qelly-release-a1-'));
const cookieOnly=(value)=>String(value).split(';')[0];

async function register(base,email='founder@qelly.test'){
  const response=await fetch(base+'/api/v1/auth/register',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email,password:'Strong!Password1',displayName:'Qelly Founder',organizationName:'Qelly Test Lab',workspaceName:'Institutional Research',baseCurrency:'USD',timezone:'UTC'})});
  const body=await response.json();return {response,body,cookie:cookieOnly(response.headers.get('set-cookie')),csrf:body.csrf?.token};
}

test('Release A1 password policy and scrypt verification are enforced',async()=>{
  assert.equal(validatePasswordPolicy('weak').valid,false);
  const encoded=await hashPassword('Strong!Password1');
  assert.match(encoded,/^scrypt\$/);assert.equal(await verifyPassword('Strong!Password1',encoded),true);assert.equal(await verifyPassword('wrong',encoded),false);
});

test('Release A1 signed session cookies reject tampering',()=>{
  const issued=issueSessionToken(secret);assert.equal(verifySignedSession(issued.signed,secret),issued.token);assert.equal(verifySignedSession(`${issued.signed}x`,secret),null);assert.match(serializeSessionCookie(issued.signed,{secure:true}),/HttpOnly/);assert.match(serializeSessionCookie(issued.signed,{secure:true}),/Secure/);
});

test('SQLite production repository shutdown is idempotent',async()=>{
  const dir=await temp();
  try{
    const repository=new SqliteProductionRepository({filePath:path.join(dir,'shutdown.sqlite')});
    repository.close();
    repository.close();
    assert.equal(repository.closed,true);
  }finally{await rm(dir,{recursive:true,force:true});}
});

test('SQLite development repository creates tenant-scoped registration transaction',async()=>{
  const repo=new SqliteProductionRepository();
  try{
    const passwordHash=await hashPassword('Strong!Password1');const created=await repo.createRegistration({email:'tenant@example.test',passwordHash,displayName:'Tenant User',organizationName:'Tenant Org',organizationSlug:'tenant-org',workspaceName:'Research',workspaceSlug:'research'});
    assert.ok(created.userId);assert.equal(await repo.count('users'),1);assert.equal(await repo.count('organizations'),1);assert.equal(await repo.count('workspaces'),1);assert.equal((await repo.findMembershipForUser(created.userId)).roles[0],'organization-admin');
  }finally{repo.close();}
});

test('persistent job queue is idempotent and worker creates one in-app notification',async()=>{
  const repo=new SqliteProductionRepository();const queue=new ProductionJobQueue({repository:repo,mode:'database',nodeEnv:'test'});
  try{
    const passwordHash=await hashPassword('Strong!Password1');const principal=await repo.createRegistration({email:'worker@example.test',passwordHash,displayName:'Worker User',organizationName:'Worker Org',organizationSlug:'worker-org',workspaceName:'Ops',workspaceSlug:'ops'});
    const input={tenantId:principal.organizationId,workspaceId:principal.workspaceId,jobType:'notification.inapp',payload:{userId:principal.userId,tenantId:principal.organizationId,workspaceId:principal.workspaceId,title:'Foundation ready',body:'Worker delivered'},idempotencyKey:'worker-notification-1'};
    const first=await queue.enqueue(input),second=await queue.enqueue(input);assert.equal(first.job_id,second.job_id);
    const job=await queue.reserve({workerId:'test-worker',types:['notification.inapp']});assert.equal(job.job_id,first.job_id);
    const runtime={productionRepository:repo};const result=await processJob(runtime,job);await queue.complete(job.job_id,result);
    assert.equal((await repo.listNotifications({userId:principal.userId,tenantId:principal.organizationId,workspaceId:principal.workspaceId})).length,1);
    assert.equal((await repo.getJob(first.job_id)).status,'completed');
  }finally{repo.close();}
});

test('production identity gateway rejects fixture identity and exposes public auth status',async()=>{
  const dir=await temp();const started=await startServer({port:0,runtimePath:dir,environment:env()});const base=`http://${started.host}:${started.port}`;
  try{
    let response=await fetch(base+'/api/v1/auth/status',{headers:{'X-Qelly-Session-Id':'sess-local-primary'}});assert.equal(response.status,200);assert.equal((await response.json()).authenticated,false);
    response=await fetch(base+'/api/v1/session/context',{headers:{'X-Qelly-Session-Id':'sess-local-primary'}});assert.equal(response.status,401);
  }finally{await new Promise(resolve=>started.server.close(resolve));started.runtime.productionRepository?.close?.();await rm(dir,{recursive:true,force:true});}
});

test('production registration, cookie session, CSRF, rotation, jobs and logout work end to end',async()=>{
  const dir=await temp();const started=await startServer({port:0,runtimePath:dir,environment:env()});const base=`http://${started.host}:${started.port}`;
  try{
    const registration=await register(base);assert.equal(registration.response.status,201);assert.match(registration.cookie,/^qelly_session=/);assert.ok(registration.csrf);assert.equal(registration.body.registrationDelivery?.queued,true);
    assert.ok((await started.runtime.jobQueue.list()).some((job)=>job.job_type==='notification.email'&&job.idempotency_key?.startsWith('registration-welcome:')));
    let response=await fetch(base+'/api/v1/session/context',{headers:{cookie:registration.cookie}});assert.equal(response.status,200);const context=await response.json();assert.equal(context.mode,'production-platform-foundation');assert.equal(context.organization.name,'Qelly Test Lab');
    response=await fetch(base+'/api/v1/jobs/notifications',{method:'POST',headers:{cookie:registration.cookie,'content-type':'application/json','x-qelly-csrf':registration.csrf,'idempotency-key':'api-notification-1'},body:JSON.stringify({title:'Release A1 ready',body:'Persistent job created'})});assert.equal(response.status,202);const queued=await response.json();
    const reserved=await started.runtime.jobQueue.reserve({workerId:'api-test-worker',types:['notification.inapp']});const result=await processJob(started.runtime,reserved);await started.runtime.jobQueue.complete(reserved.job_id,result);assert.equal(reserved.job_id,queued.job_id);
    response=await fetch(base+'/api/v1/production-notifications',{headers:{cookie:registration.cookie}});assert.equal(response.status,200);assert.equal((await response.json()).items.length,1);
    response=await fetch(base+'/api/v1/auth/refresh',{method:'POST',headers:{cookie:registration.cookie,'content-type':'application/json','x-qelly-csrf':registration.csrf},body:'{}'});assert.equal(response.status,200);const refreshed=await response.json(),newCookie=cookieOnly(response.headers.get('set-cookie'));assert.ok(refreshed.csrf.token);
    assert.equal((await fetch(base+'/api/v1/session/context',{headers:{cookie:registration.cookie}})).status,401);
    assert.equal((await fetch(base+'/api/v1/session/context',{headers:{cookie:newCookie}})).status,200);
    response=await fetch(base+'/api/v1/auth/logout',{method:'POST',headers:{cookie:newCookie,'content-type':'application/json','x-qelly-csrf':refreshed.csrf.token},body:'{}'});assert.equal(response.status,200);assert.equal((await fetch(base+'/api/v1/session/context',{headers:{cookie:newCookie}})).status,401);
  }finally{await new Promise(resolve=>started.server.close(resolve));started.runtime.productionRepository?.close?.();await rm(dir,{recursive:true,force:true});}
});

test('registration rejects duplicates and protected mutations reject missing CSRF',async()=>{
  const dir=await temp();const started=await startServer({port:0,runtimePath:dir,environment:env()});const base=`http://${started.host}:${started.port}`;
  try{
    const first=await register(base,'duplicate@qelly.test');assert.equal(first.response.status,201);
    const second=await register(base,'duplicate@qelly.test');assert.equal(second.response.status,409);
    const response=await fetch(base+'/api/v1/jobs/notifications',{method:'POST',headers:{cookie:first.cookie,'content-type':'application/json','idempotency-key':'missing-csrf-1'},body:JSON.stringify({title:'Blocked',body:'Missing proof'})});assert.equal(response.status,403);
  }finally{await new Promise(resolve=>started.server.close(resolve));started.runtime.productionRepository?.close?.();await rm(dir,{recursive:true,force:true});}
});

test('Release A1 packages production contract, migrations, worker and auth routes',async()=>{
  const contract=JSON.parse(await readFile(new URL('../packages/contracts/production-platform-foundation.contract.json',import.meta.url),'utf8'));assert.equal(contract.version,'23.0.0');assert.equal(contract.security.fixtureIdentityInProduction,false);
  const migration=await readFile(new URL('../packages/migrations/100_release_a1_production_foundation.sql',import.meta.url),'utf8');assert.match(migration,/CREATE TABLE IF NOT EXISTS qelly_users/);assert.match(migration,/ENABLE ROW LEVEL SECURITY/);
  for(const route of ['auth-login.mjs','auth-register.mjs','account-session.mjs'])assert.ok(await readFile(new URL(`../apps/web/public/assets/routes/${route}`,import.meta.url),'utf8'));
});
