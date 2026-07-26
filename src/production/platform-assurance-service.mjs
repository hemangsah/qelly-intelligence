import {copyFile,mkdir,readFile,rm,stat,writeFile} from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { SqliteProductionRepository } from './sqlite-production-repository.mjs';

const hashFile=async(file)=>crypto.createHash('sha256').update(await readFile(file)).digest('hex');
const now=()=>new Date().toISOString();

export class PlatformAssuranceService{
  constructor({runtimeDir,repository,jobQueue,objectStorage,deliveryService,secretRotationService,auditLedger}={}){this.runtimeDir=runtimeDir;this.repository=repository;this.jobQueue=jobQueue;this.objectStorage=objectStorage;this.deliveryService=deliveryService;this.secretRotationService=secretRotationService;this.auditLedger=auditLedger;this.lastDrills={};}
  async status(){
    const [database,jobs,storage,secrets]=await Promise.all([this.repository?.health?.()??{ok:false},this.jobQueue?.health?.()??{ok:false},this.objectStorage?.health?.()??{ok:false},this.secretRotationService?.status?.()??{protector:{mode:'unavailable'}}]);
    return {generatedAt:now(),dependencies:{database,jobs,storage,delivery:this.deliveryService?.providers?.()??{mode:'unavailable'},secrets},drills:this.lastDrills,staging:{dockerCompose:true,stagingCompose:true,healthProbeScript:true,backupRestoreScript:true,externalCredentialsConfigured:false},truthBoundary:'Local drills verify code paths and artifacts. They do not prove cloud infrastructure, independent penetration testing, or disaster-recovery objectives until executed in an external staging environment.'};
  }
  async runConcurrencyExercise({tenantId,workspaceId,actor,correlationId,iterations=24}={}){
    const key=`a5-concurrency-${crypto.randomUUID()}`;
    const jobs=await Promise.all(Array.from({length:Math.max(2,Math.min(Number(iterations)||24,64))},()=>this.jobQueue.enqueue({tenantId,workspaceId,jobType:'assurance.concurrency',payload:{actor,correlationId},idempotencyKey:key})));
    const unique=[...new Set(jobs.map(item=>item.job_id))];const passed=unique.length===1;
    const result={type:'multi-instance-idempotency',startedAt:now(),iterations:jobs.length,uniqueJobs:unique.length,jobId:unique[0],passed,truthBoundary:'This exercises concurrent logical writers against the configured repository and idempotency boundary. It is not a distributed multi-host load test.'};this.lastDrills.concurrency=result;
    await this.auditLedger?.append({eventType:'platform.assurance.concurrency.v1',correlationId,actor:{type:'user',id:actor},tenantId,workspaceId,outcome:passed?'success':'failure',details:result});return result;
  }
  async runBackupRestoreDrill({actor,tenantId,workspaceId,correlationId}={}){
    const source=this.repository?.filePath;
    if(!source||source===':memory:')return {type:'backup-restore',passed:false,status:'deferred',reason:'Configured repository is not a file-backed SQLite runtime',truthBoundary:'PostgreSQL backup/restore requires pg_dump/pg_restore in staging.'};
    const drillDir=path.join(this.runtimeDir,'assurance-drills',`backup-${Date.now()}`);await mkdir(drillDir,{recursive:true});const backup=path.join(drillDir,'qelly.sqlite.backup'),restored=path.join(drillDir,'qelly.sqlite.restored');
    await copyFile(source,backup);const before=await hashFile(backup);await copyFile(backup,restored);const after=await hashFile(restored);const restoredRepo=new SqliteProductionRepository({filePath:restored});const health=await restoredRepo.health();restoredRepo.close();const size=(await stat(backup)).size;const passed=before===after&&health.ok;
    const result={type:'backup-restore',startedAt:now(),status:passed?'verified':'failed',passed,sha256:before,restoredSha256:after,sizeBytes:size,restoredHealth:health,artifact:path.relative(this.runtimeDir,backup),truthBoundary:'This is a checksum-verified SQLite local drill. PostgreSQL PITR, object-storage replication, and regional recovery remain staging exercises.'};this.lastDrills.backupRestore=result;await writeFile(path.join(drillDir,'report.json'),JSON.stringify(result,null,2)+'\n');
    await this.auditLedger?.append({eventType:'platform.assurance.backup-restore.v1',correlationId,actor:{type:'user',id:actor},tenantId,workspaceId,outcome:passed?'success':'failure',details:{passed,sha256:before,sizeBytes:size}});return result;
  }
  async deliverySandboxEvidence({actor,tenantId,workspaceId,correlationId}={}){
    const result=this.deliveryService?.sandboxEvidence?.()??{passed:false,status:'unavailable'};this.lastDrills.delivery=result;await this.auditLedger?.append({eventType:'platform.assurance.delivery-sandbox.v1',correlationId,actor:{type:'user',id:actor},tenantId,workspaceId,outcome:result.passed?'success':'partial',details:result});return result;
  }
}
