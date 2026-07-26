import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRuntime } from '../../src/server/runtime.mjs';
import { initializeProductionFoundation } from '../../src/production/production-foundation.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const runtimeDir=process.env.QELLY_RUNTIME_DIR??path.join(root,'runtime');
const packageDir=path.join(root,'packages');
const workerId=process.env.QELLY_WORKER_ID??`worker-${process.pid}`;
const pollMs=Math.max(100,Number(process.env.QELLY_WORKER_POLL_MS??500));
let stopping=false;

export async function processJob(runtime,job){
  if(job.job_type==='notification.inapp'){
    const payload=job.payload;
    if(!payload.userId||!payload.tenantId||!payload.workspaceId||!payload.title)throw new Error('notification.inapp payload is incomplete');
    const notification=await runtime.productionRepository.createNotification({userId:payload.userId,tenantId:payload.tenantId,workspaceId:payload.workspaceId,kind:payload.kind??'system',title:payload.title,body:payload.body??'',sourceJobId:job.job_id});
    return {notificationId:notification.notification_id,delivery:'in-app',externalDelivery:false};
  }
  if(job.job_type==='notification.digest'){
    const payload=job.payload;
    const notification=await runtime.productionRepository.createNotification({userId:payload.userId,tenantId:payload.tenantId,workspaceId:payload.workspaceId,kind:'digest',title:payload.title??'Qelly scheduled digest',body:payload.body??'Your scheduled Qelly digest is ready.',sourceJobId:job.job_id});
    return {notificationId:notification.notification_id,delivery:'in-app',externalDelivery:false};
  }
  if(job.job_type==='notification.email'||job.job_type==='notification.webhook'){
    const p=job.payload;return runtime.deliveryService.deliver({channel:job.job_type.split('.')[1],userId:p.userId,tenantId:p.tenantId,workspaceId:p.workspaceId,destination:p.destination,title:p.title,body:p.body,sourceJobId:job.job_id});
  }
  throw new Error(`Unsupported job type: ${job.job_type}`);
}

export async function runWorker({once=false}={}){
  const runtime=createRuntime({runtimeDir,packageDir});await runtime.schemaRegistry.init();await initializeProductionFoundation(runtime,{runtimeDir});
  if(!runtime.jobQueue)throw new Error('Job queue is unavailable');
  runtime.observability.log('info','worker.started',{workerId,queueMode:runtime.jobQueue.mode});
  let processed=0;
  while(!stopping){
    const job=await runtime.jobQueue.reserve({workerId,types:['notification.inapp','notification.digest','notification.email','notification.webhook'],timeoutSeconds:1});
    if(!job){if(once)break;await new Promise((resolve)=>setTimeout(resolve,pollMs));continue;}
    try{const result=await processJob(runtime,job);await runtime.jobQueue.complete(job.job_id,result);processed+=1;await runtime.auditLedger.append({eventType:'job.completed.v1',correlationId:job.job_id,actor:{type:'service',id:workerId},tenantId:job.tenant_id,workspaceId:job.workspace_id,outcome:'success',details:{jobId:job.job_id,jobType:job.job_type,result}});}catch(error){const failed=await runtime.jobQueue.fail(job.job_id,error,{retryDelayMs:1000*Math.max(1,job.attempts)});await runtime.auditLedger.append({eventType:'job.failed.v1',correlationId:job.job_id,actor:{type:'service',id:workerId},tenantId:job.tenant_id,workspaceId:job.workspace_id,outcome:'failure',details:{jobId:job.job_id,jobType:job.job_type,status:failed?.status,error:error.message}});}
    if(once)break;
  }
  runtime.jobQueue.close();runtime.productionRepository?.close?.();return {workerId,processed};
}

process.on('SIGINT',()=>{stopping=true;});process.on('SIGTERM',()=>{stopping=true;});
if(process.argv[1]&&fileURLToPath(import.meta.url)===path.resolve(process.argv[1])){runWorker({once:process.argv.includes('--once')}).then((result)=>{console.log(JSON.stringify(result));}).catch((error)=>{console.error(error);process.exitCode=1;});}
