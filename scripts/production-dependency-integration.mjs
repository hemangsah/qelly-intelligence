import crypto from 'node:crypto';
import { PostgresProductionRepository } from '../src/production/postgres-production-repository.mjs';
import { ProductionJobQueue } from '../src/production/job-queue.mjs';
import { hashPassword } from '../src/production/password-hasher.mjs';
import { PostgresDecisionProvenanceStore } from '../src/evidence/postgres-decision-provenance-store.mjs';
import { PostgresDocumentStore } from '../src/production/postgres-document-store.mjs';
import { PostgresAuditLedger } from '../src/production/postgres-audit-ledger.mjs';
import { WorkspaceOperationsStore, emptyWorkspaceOperationsSeed } from '../src/workspace/workspace-operations-store.mjs';

if(!process.env.DATABASE_URL)throw new Error('DATABASE_URL is required');
if(!process.env.REDIS_URL)throw new Error('REDIS_URL is required');
const suffix=crypto.randomUUID().slice(0,8);
const repository=new PostgresProductionRepository({databaseUrl:process.env.DATABASE_URL,environment:process.env});
await repository.connect();
const queue=new ProductionJobQueue({repository,redisUrl:process.env.REDIS_URL,mode:'redis',nodeEnv:'test',namespace:`qelly:ci:${suffix}`,environment:process.env,leaseMs:5000});
try{
  const db=await repository.health(),redis=await queue.health();
  if(!db.ok||!redis.ok)throw new Error(`Dependencies are unhealthy: ${JSON.stringify({db,redis})}`);
  if(db.latestMigration!=='108_saved_calculation_lifecycle.sql')throw new Error(`Expected migration 108, received ${db.latestMigration}`);
  const registration=await repository.createRegistration({
    email:`integration-${suffix}@qelly.test`,passwordHash:await hashPassword('Integration!Password1'),displayName:'Integration User',
    organizationName:`Integration Org ${suffix}`,organizationSlug:`integration-org-${suffix}`,workspaceName:'Integration Workspace',workspaceSlug:'integration'
  });
  const job=await queue.enqueue({tenantId:registration.organizationId,workspaceId:registration.workspaceId,jobType:'notification.inapp',payload:{userId:registration.userId,tenantId:registration.organizationId,workspaceId:registration.workspaceId,title:'Integration ready',body:'PostgreSQL and Redis integration'},idempotencyKey:`integration-${suffix}`});
  const reserved=await queue.reserve({workerId:`integration-${suffix}`,types:['notification.inapp'],timeoutSeconds:2});
  if(!reserved||reserved.job_id!==job.job_id)throw new Error('Redis-signaled reservation did not return the queued job');
  await queue.complete(job.job_id,{integration:true});
  const completed=await repository.getJob(job.job_id);if(completed.status!=='completed')throw new Error('Job did not complete');
  const duplicate=await queue.enqueue({tenantId:registration.organizationId,workspaceId:registration.workspaceId,jobType:'notification.inapp',payload:{userId:registration.userId},idempotencyKey:`integration-${suffix}`});
  if(duplicate.job_id!==job.job_id)throw new Error('Queue idempotency returned a different job');
  const concurrentJobs=await Promise.all(Array.from({length:8},()=>queue.enqueue({tenantId:registration.organizationId,workspaceId:registration.workspaceId,jobType:'notification.inapp',payload:{userId:registration.userId,tenantId:registration.organizationId,workspaceId:registration.workspaceId,title:'Concurrent integration job'},idempotencyKey:`concurrent-${suffix}`})));
  if(new Set(concurrentJobs.map((item)=>item.job_id)).size!==1)throw new Error('Concurrent queue idempotency created more than one job');
  const concurrentClaim=await queue.reserve({workerId:`integration-${suffix}`,types:['notification.inapp'],timeoutSeconds:1});
  if(concurrentClaim?.job_id!==concurrentJobs[0].job_id)throw new Error('Concurrent idempotent job was not claimable exactly once');
  await queue.complete(concurrentClaim.job_id,{concurrencyVerified:true});

  const delayed=await queue.enqueue({tenantId:registration.organizationId,workspaceId:registration.workspaceId,jobType:'notification.inapp',payload:{userId:registration.userId},idempotencyKey:`delayed-${suffix}`,availableAt:new Date(Date.now()+150).toISOString(),maxAttempts:3});
  await new Promise(resolve=>setTimeout(resolve,200));
  const delayedClaim=await queue.reserve({workerId:`integration-${suffix}`,types:['notification.inapp'],timeoutSeconds:1});
  if(delayedClaim?.job_id!==delayed.job_id)throw new Error('Delayed Redis job was not promoted');
  const retried=await queue.fail(delayed.job_id,new Error('retry exercise'),{retryDelayMs:150});if(retried.status!=='queued')throw new Error('Retryable job did not return to queued');
  await new Promise(resolve=>setTimeout(resolve,200));
  const retryClaim=await queue.reserve({workerId:`integration-${suffix}`,types:['notification.inapp'],timeoutSeconds:1});if(retryClaim?.job_id!==delayed.job_id)throw new Error('Retried job was not reclaimed');
  await queue.complete(delayed.job_id,{retryVerified:true});

  const deadCandidate=await queue.enqueue({tenantId:registration.organizationId,workspaceId:registration.workspaceId,jobType:'notification.inapp',payload:{userId:registration.userId},idempotencyKey:`dead-${suffix}`,maxAttempts:1});
  const deadClaim=await queue.reserve({workerId:`integration-${suffix}`,types:['notification.inapp'],timeoutSeconds:1});if(deadClaim?.job_id!==deadCandidate.job_id)throw new Error('Dead-letter candidate was not claimed');
  const dead=await queue.fail(deadCandidate.job_id,new Error('terminal exercise'));if(dead.status!=='dead')throw new Error('Exhausted job was not dead-lettered');

  const recoveryCandidate=await queue.enqueue({tenantId:registration.organizationId,workspaceId:registration.workspaceId,jobType:'notification.inapp',payload:{userId:registration.userId},idempotencyKey:`recovery-${suffix}`});
  const recoveryClaim=await queue.reserve({workerId:`crashed-${suffix}`,types:['notification.inapp'],timeoutSeconds:1});if(recoveryClaim?.job_id!==recoveryCandidate.job_id)throw new Error('Recovery candidate was not claimed');
  await repository.query(`UPDATE qelly_jobs SET locked_at=NOW()-INTERVAL '10 minutes' WHERE job_id=$1`,[recoveryCandidate.job_id]);
  const recovery=await queue.recover({staleAfterMs:5000});if(recovery.recovered!==1)throw new Error('Stale worker job was not recovered');
  const recoveredClaim=await queue.reserve({workerId:`replacement-${suffix}`,types:['notification.inapp'],timeoutSeconds:1});if(recoveredClaim?.job_id!==recoveryCandidate.job_id)throw new Error('Recovered job was not reclaimed');
  await queue.complete(recoveryCandidate.job_id,{restartRecoveryVerified:true});
  await queue.heartbeat(`integration-${suffix}`);const workerHealth=await queue.workerHealth(`integration-${suffix}`);if(!workerHealth.ok)throw new Error('Worker heartbeat was not visible');

  const scope={userId:registration.userId,tenantId:registration.organizationId,workspaceId:registration.workspaceId};
  const portfolios=await repository.listPortfolios(scope);if(portfolios.length!==1||portfolios[0].positions.length!==5)throw new Error('PostgreSQL portfolio persistence failed');
  const auditLedger=new PostgresAuditLedger({repository});
  const workspaceStore=new WorkspaceOperationsStore({storeFactory:(_scope,documentKey)=>new PostgresDocumentStore({repository,documentKey:`${documentKey}-${suffix}`,documentType:'workspace-operations',seedFactory:emptyWorkspaceOperationsSeed}),auditLedger,persistenceMode:'postgresql-jsonb'});
  const watchlist=await workspaceStore.createWatchlist(scope,{name:'CI watchlist',description:'PostgreSQL persistence'},`watchlist-${suffix}`);
  const alert=await workspaceStore.createAlertRule(scope,{name:'CI price alert',canonicalId:'QI-CRYPTO-BTC',metric:'price',operator:'greater_than',threshold:1,severity:'medium'},`alert-${suffix}`);
  if((await workspaceStore.listWatchlists(scope)).items[0]?.watchlistId!==watchlist.watchlistId||(await workspaceStore.listAlertRules(scope)).items[0]?.ruleId!==alert.ruleId)throw new Error('Watchlist or alert persistence failed');
  if((await workspaceStore.listWatchlists({...scope,workspaceId:`other-${suffix}`})).items.length)throw new Error('Workspace operations isolation failed');

  const counterKey=`concurrency-${suffix}`;
  const counterA=new PostgresDocumentStore({repository,documentKey:counterKey,documentType:'integration-counter',seedFactory:()=>({count:0})});
  const counterB=new PostgresDocumentStore({repository,documentKey:counterKey,documentType:'integration-counter',seedFactory:()=>({count:0})});
  await Promise.all(Array.from({length:12},(_,index)=>(index%2?counterA:counterB).update((value)=>({count:value.count+1}))));
  if((await counterA.read()).count!==12)throw new Error('Concurrent multi-instance PostgreSQL document transactions lost updates');
  const rollbackKey=`rollback-${suffix}`;
  await repository.client.transaction(async()=>{await repository.query(`INSERT INTO qelly_runtime_documents(document_key,document_type,body_json) VALUES($1,'rollback-test','{}'::jsonb)`,[rollbackKey]);throw new Error('rollback exercise');}).catch((error)=>{if(error.message!=='rollback exercise')throw error;});
  if((await repository.query('SELECT 1 FROM qelly_runtime_documents WHERE document_key=$1',[rollbackKey])).rows.length)throw new Error('PostgreSQL transaction rollback failed');
  const evidenceStore=new PostgresDecisionProvenanceStore({repository});
  const graph=await evidenceStore.explainMove(scope,{
    asset:{
      canonicalId:'QI-CRYPTO-BTC',symbol:'BTC',name:'Bitcoin',assetClass:'crypto',categories:['crypto'],
      price:68000,change24h:1.25,open24h:67160,high24h:68400,low24h:66900,volume24h:1000,quoteVolume24h:68000000,quoteCurrency:'USDT',
      source:{provider:'ci-fixture',attribution:'Qelly CI fixture',sourceUrl:null,entitlement:'internal-test',license:'test-only',observedAt:new Date().toISOString(),ingestedAt:new Date().toISOString(),freshness:'current',qualityState:'verified-fixture',confidence:1,cacheState:'miss',degraded:false,fallbackReason:null,normalizationVersion:'ci-v1'}
    },
    thesis:'Exercise PostgreSQL Decision Provenance persistence in CI.',
    consideredAction:'monitor',
    horizon:'24h',
    confidence:0.5,
    notes:'No live execution.'
  },`integration-${suffix}`);
  if(!graph.integrity.valid||graph.nodes.length<6||graph.edges.length<6)throw new Error('PostgreSQL Decision Provenance graph integrity failed');
  const traversal=await evidenceStore.traverse(scope,graph.graphId,{direction:'both',depth:3});
  const evidencePackage=await evidenceStore.exportPackage(scope,graph.graphId,`integration-export-${suffix}`);
  if(!traversal.nodes.length||!/^[a-f0-9]{64}$/.test(evidencePackage.verification.sha256))throw new Error('PostgreSQL Decision Provenance traversal or export failed');
  const isolated=await evidenceStore.list({...scope,tenantId:`other-${suffix}`});
  if(isolated.total!==0)throw new Error('PostgreSQL Decision Provenance tenant isolation failed');
  const otherRegistration=await repository.createRegistration({
    email:`integration-other-${suffix}@qelly.test`,passwordHash:await hashPassword('Integration!Password2'),displayName:'Other Integration User',
    organizationName:`Other Integration Org ${suffix}`,organizationSlug:`integration-other-org-${suffix}`,workspaceName:'Other Integration Workspace',workspaceSlug:'integration'
  });
  await auditLedger.append({eventType:'integration.audit.other-tenant.v1',correlationId:`other-audit-${suffix}`,actor:{type:'test',id:otherRegistration.userId},tenantId:otherRegistration.organizationId,workspaceId:otherRegistration.workspaceId,outcome:'success'});
  const scopedAudit=await auditLedger.list(100,scope);
  if(!scopedAudit.length||scopedAudit.some((record)=>record.tenantId!==scope.tenantId||record.workspaceId!==scope.workspaceId)||scopedAudit.some((record)=>record.tenantId===otherRegistration.organizationId))throw new Error('PostgreSQL audit listing scope isolation failed');
  const audit=await auditLedger.verify();if(!audit.valid||audit.records<3)throw new Error('PostgreSQL audit-chain persistence failed');
  console.log(JSON.stringify({status:'production-dependency-integration-passed',database:db.driver,migration:db.latestMigration,redis:redis.driver,userId:registration.userId,jobId:job.job_id,portfolio:{persisted:true,positions:portfolios[0].positions.length},workspaceState:{watchlistId:watchlist.watchlistId,alertId:alert.ruleId,workspaceIsolation:true,concurrentUpdates:12,rollback:true},queue:{delayed:true,retry:true,deadLetter:true,restartRecovery:true,workerHeartbeat:true,idempotency:true,concurrentIdempotency:true},audit:{valid:audit.valid,records:audit.records,scopeIsolation:true},decisionProvenance:{graphId:graph.graphId,nodes:graph.nodes.length,edges:graph.edges.length,traversalNodes:traversal.nodes.length,exportSha256:evidencePackage.verification.sha256,tenantIsolation:true}},null,2));
}finally{await queue.removeWorker(`integration-${suffix}`).catch(()=>{});queue.close();await repository.close();}
