import crypto from 'node:crypto';
import { PostgresProductionRepository } from '../src/production/postgres-production-repository.mjs';
import { ProductionJobQueue } from '../src/production/job-queue.mjs';
import { hashPassword } from '../src/production/password-hasher.mjs';
import { PostgresDecisionProvenanceStore } from '../src/evidence/postgres-decision-provenance-store.mjs';

if(!process.env.DATABASE_URL)throw new Error('DATABASE_URL is required');
if(!process.env.REDIS_URL)throw new Error('REDIS_URL is required');
const suffix=crypto.randomUUID().slice(0,8);
const repository=new PostgresProductionRepository({databaseUrl:process.env.DATABASE_URL});
await repository.connect();
const queue=new ProductionJobQueue({repository,redisUrl:process.env.REDIS_URL,mode:'redis',nodeEnv:'test'});
try{
  const db=await repository.health(),redis=await queue.health();
  if(!db.ok||!redis.ok)throw new Error(`Dependencies are unhealthy: ${JSON.stringify({db,redis})}`);
  const registration=await repository.createRegistration({
    email:`integration-${suffix}@qelly.test`,passwordHash:await hashPassword('Integration!Password1'),displayName:'Integration User',
    organizationName:`Integration Org ${suffix}`,organizationSlug:`integration-org-${suffix}`,workspaceName:'Integration Workspace',workspaceSlug:'integration'
  });
  const job=await queue.enqueue({tenantId:registration.organizationId,workspaceId:registration.workspaceId,jobType:'notification.inapp',payload:{userId:registration.userId,tenantId:registration.organizationId,workspaceId:registration.workspaceId,title:'Integration ready',body:'PostgreSQL and Redis integration'},idempotencyKey:`integration-${suffix}`});
  const reserved=await queue.reserve({workerId:`integration-${suffix}`,types:['notification.inapp'],timeoutSeconds:2});
  if(!reserved||reserved.job_id!==job.job_id)throw new Error('Redis-signaled reservation did not return the queued job');
  await queue.complete(job.job_id,{integration:true});
  const completed=await repository.getJob(job.job_id);if(completed.status!=='completed')throw new Error('Job did not complete');
  const evidenceStore=new PostgresDecisionProvenanceStore({repository});
  const scope={userId:registration.userId,tenantId:registration.organizationId,workspaceId:registration.workspaceId};
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
  console.log(JSON.stringify({status:'production-dependency-integration-passed',database:db.driver,redis:redis.driver,userId:registration.userId,jobId:job.job_id,decisionProvenance:{graphId:graph.graphId,nodes:graph.nodes.length,edges:graph.edges.length,traversalNodes:traversal.nodes.length,exportSha256:evidencePackage.verification.sha256,tenantIsolation:true}},null,2));
}finally{queue.close();repository.close();}
