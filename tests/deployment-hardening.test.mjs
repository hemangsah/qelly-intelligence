import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, rm } from 'node:fs/promises';
import crypto from 'node:crypto';
import { inspectDeploymentEnvironment } from '../src/production/deployment-environment.mjs';
import { PostgresPoolClient, postgresConnectionOptions, postgresTlsOptions } from '../src/production/postgres-pool-client.mjs';
import { VersionedKeyringSecretProtector } from '../src/production/secret-protector.mjs';
import { ObservabilityService } from '../src/observability/observability-service.mjs';
import { SignedWebhookAdapter, WebhookReplayGuard } from '../src/production/delivery-service.mjs';
import { S3CompatibleObjectStorage } from '../src/production/object-storage.mjs';
import { serializeSessionCookie } from '../src/production/session-cookie.mjs';
import { retryDelayMs } from '../apps/worker/worker.mjs';
import { startServer } from '../src/server/server.mjs';
import { ProductionJobQueue } from '../src/production/job-queue.mjs';

function productionEnvironment(overrides={}){
  const frontend='https://preview.acme.dev';
  return {
    NODE_ENV:'production',QELLY_DEPLOYMENT_ENVIRONMENT:'preview',
    QELLY_PRODUCTION_FOUNDATION_ENABLED:'true',QELLY_PRODUCTION_IDENTITY_ENABLED:'true',QELLY_DEVELOPMENT_IDENTITY_ENABLED:'false',
    QELLY_DATABASE_MODE:'postgres',QELLY_JOB_QUEUE_MODE:'redis',QELLY_OBJECT_STORAGE_MODE:'s3',QELLY_MALWARE_SCANNER_MODE:'clamav',QELLY_REQUIRE_EXTERNAL_MALWARE_SCANNER:'true',QELLY_DELIVERY_MODE:'external',QELLY_SESSION_COOKIE_SAME_SITE:'None',QELLY_STRICT_PRODUCTION_DEPENDENCIES:'true',QELLY_REQUIRE_ACTIVE_WORKER:'true',QELLY_POSTGRES_TLS_REJECT_UNAUTHORIZED:'true',QELLY_REDIS_TLS_REJECT_UNAUTHORIZED:'true',
    DATABASE_URL:'postgresql://qelly_app:strong-password@pool.db.acme.dev:5432/qelly?sslmode=verify-full',
    QELLY_MIGRATION_DATABASE_URL:'postgresql://qelly_migrator:strong-password@direct.db.acme.dev:5432/qelly?sslmode=verify-full',
    REDIS_URL:'rediss://default:strong-password@redis.acme.dev:6379/0',
    QELLY_WORKER_ID:'qelly-preview-worker-1',
    QELLY_SESSION_SECRET:'s'.repeat(48),QELLY_PASSWORD_PEPPER:'p'.repeat(32),
    QELLY_SECRET_KEYRING_JSON:JSON.stringify({'preview-2026-01':'a'.repeat(64)}),QELLY_SECRET_ACTIVE_KEY_ID:'preview-2026-01',
    S3_ENDPOINT:'https://objects.acme.dev',S3_BUCKET:'qelly-preview-private',S3_REGION:'ap-south-1',S3_ACCESS_KEY_ID:'AKIASCOPEDVALUE',S3_SECRET_ACCESS_KEY:'o'.repeat(40),
    CLAMAV_HOST:'clamav.private.internal',
    QELLY_WEBHOOK_SIGNING_SECRET:'w'.repeat(48),QELLY_EMAIL_API_URL:'https://email.acme.dev/send',QELLY_EMAIL_HEALTH_URL:'https://email.acme.dev/health',QELLY_EMAIL_API_TOKEN:'t'.repeat(32),
    QELLY_OUTBOUND_ALLOWED_ORIGINS:'https://email.acme.dev,https://hooks.acme.dev',
    QELLY_FRONTEND_ORIGINS:frontend,QELLY_WEBAUTHN_RP_ID:'preview.acme.dev',QELLY_WEBAUTHN_ORIGINS:frontend,
    QELLY_LIVE_TRADING_ENABLED:'false',QELLY_ASSET_TRANSFERS_ENABLED:'false',QELLY_WITHDRAWALS_ENABLED:'false',QELLY_PRIVATE_KEYS_ENABLED:'false',QELLY_RECOVERY_PHRASES_ENABLED:'false',
    ...overrides
  };
}

test('strict deployment environment accepts only complete encrypted external dependencies',()=>{
  const valid=inspectDeploymentEnvironment(productionEnvironment());assert.equal(valid.ok,true);
  const invalid=inspectDeploymentEnvironment(productionEnvironment({REDIS_URL:'redis://redis.acme.dev:6379',DATABASE_URL:'postgresql://qelly:password@db.acme.dev/qelly',QELLY_POSTGRES_TLS_REJECT_UNAUTHORIZED:'false',S3_REGION:'<storage-region>'}));
  assert.equal(invalid.ok,false);assert.ok(invalid.failures.some((item)=>item.includes('REDIS_URL')));assert.ok(invalid.failures.some((item)=>item.includes('sslmode')));assert.ok(invalid.failures.some((item)=>item.includes('QELLY_POSTGRES_TLS_REJECT_UNAUTHORIZED')));assert.ok(invalid.failures.some((item)=>item.includes('S3_REGION')));
});

test('PostgreSQL TLS policy rejects plaintext production URLs',()=>{
  assert.throws(()=>postgresTlsOptions({databaseUrl:'postgresql://qelly:password@db.acme.dev/qelly',environment:{NODE_ENV:'production'}}),error=>error.code==='postgres_tls_required');
  assert.deepEqual(postgresTlsOptions({databaseUrl:'postgresql://qelly:password@db.acme.dev/qelly?sslmode=verify-full',environment:{NODE_ENV:'production'}}),{rejectUnauthorized:true});
  const ca='-----BEGIN CERTIFICATE-----\nfixture\n-----END CERTIFICATE-----';
  const options=postgresConnectionOptions({databaseUrl:'postgresql://qelly:password@db.acme.dev:5432/qelly?sslmode=verify-full',environment:{NODE_ENV:'production',QELLY_POSTGRES_TLS_CA_BASE64:Buffer.from(ca).toString('base64')},applicationName:'test'});
  assert.equal(options.host,'db.acme.dev');assert.equal(options.database,'qelly');assert.equal(options.ssl.ca,ca);assert.equal(options.ssl.rejectUnauthorized,true);assert.equal('connectionString' in options,false);
});

test('PostgreSQL transaction isolation accepts only fixed safe levels',async()=>{
  const client=new PostgresPoolClient({databaseUrl:'postgresql://qelly:password@db.acme.dev/qelly',environment:{NODE_ENV:'test'}});
  try{
    await assert.rejects(()=>client.transaction(()=>undefined,{isolationLevel:'READ COMMITTED; DROP TABLE users'}),error=>error.code==='postgres_isolation_level_invalid');
  }finally{await client.close();}
});

test('production keyrings require exact 32-byte encoded material',()=>{
  assert.throws(()=>new VersionedKeyringSecretProtector({keys:{active:'not-long-enough-to-be-a-real-key'},activeKeyId:'active',nodeEnv:'production'}),error=>error.code==='secret_key_material_invalid');
  const protector=new VersionedKeyringSecretProtector({keys:{active:'b'.repeat(64)},activeKeyId:'active',nodeEnv:'production'});
  const envelope=protector.protect('secret',{purpose:'test'});assert.equal(protector.unprotect(envelope,{purpose:'test'}),'secret');
});

test('structured deployment logs recursively redact credentials',()=>{
  const lines=[],output={log:(line)=>lines.push(line),warn:(line)=>lines.push(line),error:(line)=>lines.push(line)};
  const service=new ObservabilityService({structuredOutput:true,output});
  const record=service.log('info','deployment.test',{authorization:'Bearer abc',nested:{password:'hidden',url:'postgresql://user:pass@db.acme.dev/qelly'},message:'failed at rediss://default:redis-pass@cache.acme.dev/0',safe:'visible'});
  assert.equal(record.details.authorization,'[REDACTED]');assert.equal(record.details.nested.password,'[REDACTED]');assert.doesNotMatch(JSON.stringify(record),/user:pass|redis-pass|Bearer abc|hidden/);assert.equal(JSON.parse(lines[0]).details.safe,'visible');
});

test('signed webhook verifier rejects incorrect stale and duplicate deliveries',()=>{
  let clock=2_000_000;const adapter=new SignedWebhookAdapter({signingSecret:'w'.repeat(48),replayGuard:new WebhookReplayGuard({clock:()=>clock,windowMs:300000})});
  const signed=adapter.signedRequest({title:'Test',body:'Body',tenantId:'tenant',workspaceId:'workspace'},{timestamp:String(clock),deliveryId:'delivery-1'});
  assert.deepEqual(adapter.validateSignedRequest(signed),{valid:true,reason:null});
  assert.equal(adapter.validateSignedRequest(signed).reason,'duplicate_delivery');
  assert.equal(adapter.validateSignedRequest({...signed,deliveryId:'delivery-2',signature:'0'.repeat(64)}).reason,'signature_invalid');
  const stale=adapter.signedRequest({title:'Test',body:'Body',tenantId:'tenant',workspaceId:'workspace'},{timestamp:String(clock-300001),deliveryId:'delivery-stale'});
  assert.equal(adapter.validateSignedRequest(stale).reason,'stale_timestamp');
});

test('S3 signed downloads are scoped to released objects and expire quickly',()=>{
  const store=new S3CompatibleObjectStorage({endpoint:'https://objects.acme.dev',bucket:'qelly-private',region:'ap-south-1',accessKeyId:'AKID',secretAccessKey:'secret'});
  const signed=store.presignGet('released/tenant/workspace/hash-file.csv',{expiresSeconds:120,date:new Date('2026-07-26T00:00:00.000Z')});
  const url=new URL(signed.url);assert.equal(url.searchParams.get('X-Amz-Expires'),'120');assert.match(url.pathname,/released\/tenant\/workspace/);assert.ok(url.searchParams.get('X-Amz-Signature'));assert.doesNotMatch(signed.url,/secret/);
  assert.throws(()=>store.presignGet('quarantine/tenant/workspace/file'),error=>error.code==='object_not_released');
});

test('S3 releases are hash-idempotent, tenant-scoped, and absent after an interrupted upload',async()=>{
  const objects=new Map();let interruptNextPut=false;
  const fetchImpl=async(url,{method='GET',body}={})=>{
    const key=new URL(url).pathname;
    if(method==='PUT'){
      if(interruptNextPut){interruptNextPut=false;return new Response('',{status:503});}
      objects.set(key,Buffer.from(body));return new Response('',{status:200});
    }
    if(method==='GET'){const content=objects.get(key);return content?new Response(content,{status:200}):new Response('',{status:404});}
    if(method==='DELETE'){objects.delete(key);return new Response(null,{status:204});}
    return new Response('',{status:200});
  };
  const store=new S3CompatibleObjectStorage({endpoint:'https://objects.acme.dev',bucket:'qelly-private',region:'ap-south-1',accessKeyId:'AKID',secretAccessKey:'secret',fetchImpl});
  const input={tenantId:'tenant-a',workspaceId:'workspace-a',fileName:'data.csv',mimeType:'text/csv',content:Buffer.from('a,b\n1,2')};
  const first=await store.put(input),duplicate=await store.put(input),otherTenant=await store.put({...input,tenantId:'tenant-b'});
  assert.equal(first.key,duplicate.key);assert.notEqual(first.key,otherTenant.key);assert.match(first.key,/^released\/tenant-a\/workspace-a\//);
  const releasedBefore=[...objects.keys()].filter((key)=>key.includes('/released/')).sort();
  interruptNextPut=true;
  await assert.rejects(()=>store.put({...input,fileName:'interrupted.csv',content:Buffer.from('partial')}),error=>error.code==='object_storage_request_failed');
  assert.deepEqual([...objects.keys()].filter((key)=>key.includes('/released/')).sort(),releasedBefore);
});

test('session cookie supports secure credentialed preview origins',()=>{
  const cookie=serializeSessionCookie('signed-value',{secure:true,sameSite:'None'});assert.match(cookie,/HttpOnly/);assert.match(cookie,/SameSite=None/);assert.match(cookie,/Secure/);
});

test('worker retry delay is bounded exponential backoff',()=>{
  assert.equal(retryDelayMs(1,{random:()=>0.5}),1000);assert.equal(retryDelayMs(2,{random:()=>0.5}),2000);assert.equal(retryDelayMs(20,{random:()=>0.5}),300000);
});

test('Redis dispatch atomically records the marker and queue placement',async()=>{
  const calls=[],queue=new ProductionJobQueue({repository:{},mode:'redis',redisUrl:'redis://127.0.0.1:6379/0',nodeEnv:'test'});
  queue.redis={command:async(parts)=>{calls.push(parts);return 1;},close(){}};
  try{
    assert.equal(await queue.dispatch({job_id:'job-atomic',available_at:new Date(Date.now()+60000).toISOString()}),true);
    assert.equal(calls.length,1);assert.equal(calls[0][0],'EVAL');assert.match(calls[0][1],/redis\.call\('SET'/);assert.match(calls[0][1],/redis\.call\('ZADD'/);
  }finally{queue.close();}
  const durableQueue=new ProductionJobQueue({repository:{createJob:async(input)=>({job_id:'job-durable',job_type:input.jobType,status:'queued',available_at:new Date().toISOString()})},mode:'redis',redisUrl:'redis://127.0.0.1:6379/0',nodeEnv:'test'});
  durableQueue.redis={command:async()=>{throw Object.assign(new Error('Redis unavailable'),{code:'redis_unavailable'});},close(){}};
  try{
    const durable=await durableQueue.enqueue({jobType:'notification.email'});
    assert.equal(durable.job_id,'job-durable');assert.equal(durable.dispatch_pending,true);assert.equal(durable.dispatch_error_code,'redis_unavailable');
  }finally{durableQueue.close();}
});

test('deployment manifests separate static and persistent workloads',async()=>{
  const [vercel,migration,compose]=await Promise.all([
    readFile(new URL('../vercel.json',import.meta.url),'utf8').then(JSON.parse),
    readFile(new URL('../packages/migrations/106_deployment_runtime_state.sql',import.meta.url),'utf8'),
    readFile(new URL('../deploy/staging/docker-compose.staging.yml',import.meta.url),'utf8')
  ]);
  assert.equal(vercel.outputDirectory,'dist/frontend');assert.match(migration,/qelly_runtime_documents/);assert.match(migration,/qelly_portfolios/);assert.match(migration,/qelly_audit_records/);assert.doesNotMatch(compose,/image:\s*(?:postgres|redis|minio|clamav)/);
});

test('CORS preflight allows only an explicit preview origin',async()=>{
  const runtimePath=`/tmp/qelly-cors-${crypto.randomUUID()}`;
  const environment={...process.env,NODE_ENV:'test',QELLY_DEPLOYMENT_ENVIRONMENT:'test',QELLY_PRODUCTION_FOUNDATION_ENABLED:'true',QELLY_PRODUCTION_IDENTITY_ENABLED:'true',QELLY_DEVELOPMENT_IDENTITY_ENABLED:'false',QELLY_DATABASE_MODE:'sqlite',QELLY_JOB_QUEUE_MODE:'database',QELLY_SESSION_SECRET:'c'.repeat(48),QELLY_FRONTEND_ORIGINS:'https://preview.acme.dev'};
  const started=await startServer({port:0,runtimePath,environment}),base=`http://${started.host}:${started.port}`;
  try{
    const allowed=await fetch(`${base}/api/v1/config`,{method:'OPTIONS',headers:{Origin:'https://preview.acme.dev','Access-Control-Request-Method':'GET'}});assert.equal(allowed.status,204);assert.equal(allowed.headers.get('access-control-allow-origin'),'https://preview.acme.dev');assert.equal(allowed.headers.get('access-control-allow-credentials'),'true');
    const denied=await fetch(`${base}/api/v1/config`,{method:'OPTIONS',headers:{Origin:'https://evil.acme.dev','Access-Control-Request-Method':'GET'}});assert.equal(denied.status,403);
    const browserConfig=await fetch(`${base}/qelly-config.js`);assert.equal(browserConfig.status,200);assert.match(browserConfig.headers.get('content-type'),/text\/javascript/);assert.match(await browserConfig.text(),/__QELLY_CONFIG__/);
  }finally{await new Promise((resolve)=>started.server.close(resolve));await started.runtime.productionRepository?.close?.();await rm(runtimePath,{recursive:true,force:true});}
});
