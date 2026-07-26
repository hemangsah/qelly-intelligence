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
let activeJobId=null;

export function retryDelayMs(attempt,{baseMs=1000,maxMs=300000,jitterRatio=0.2,random=Math.random}={}){
  const exponential=Math.min(maxMs,Math.max(1,baseMs)*2**Math.max(0,Number(attempt||1)-1));
  const jitter=exponential*Math.max(0,Math.min(Number(jitterRatio)||0,0.5))*((Number(random())*2)-1);
  return Math.max(baseMs,Math.min(maxMs,Math.round(exponential+jitter)));
}

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
  await runtime.jobQueue.recover();
  await runtime.jobQueue.heartbeat(workerId);
  runtime.observability.log('info','worker.started',{workerId,queueMode:runtime.jobQueue.mode});
  const heartbeatMs=Math.max(1000,Math.min(Number(process.env.QELLY_WORKER_HEARTBEAT_MS??10000),Math.floor(runtime.jobQueue.leaseMs/3)));
  const heartbeat=setInterval(()=>runtime.jobQueue.heartbeat(workerId,{jobId:activeJobId}).catch((error)=>runtime.observability.log('error','worker.heartbeat.failed',{workerId,error:error.message})),heartbeatMs);
  heartbeat.unref?.();
  const recoveryMs=Math.max(30000,Math.min(Number(process.env.QELLY_WORKER_RECOVERY_MS??60000),600000));
  const recovery=setInterval(()=>runtime.jobQueue.recover().catch((error)=>runtime.observability.log('error','worker.recovery.failed',{workerId,error:error.message})),recoveryMs);
  recovery.unref?.();
  let processed=0;
  try{
    while(!stopping){
      const job=await runtime.jobQueue.reserve({workerId,types:['notification.inapp','notification.digest','notification.email','notification.webhook'],timeoutSeconds:1});
      if(!job){if(once)break;await new Promise((resolve)=>setTimeout(resolve,pollMs));continue;}
      activeJobId=job.job_id;
      try{const result=await processJob(runtime,job);await runtime.jobQueue.complete(job.job_id,result);processed+=1;await runtime.auditLedger.append({eventType:'job.completed.v1',correlationId:job.job_id,actor:{type:'service',id:workerId},tenantId:job.tenant_id,workspaceId:job.workspace_id,outcome:'success',details:{jobId:job.job_id,jobType:job.job_type,result}});}catch(error){const delay=retryDelayMs(job.attempts);const failed=await runtime.jobQueue.fail(job.job_id,error,{retryDelayMs:delay});await runtime.auditLedger.append({eventType:'job.failed.v1',correlationId:job.job_id,actor:{type:'service',id:workerId},tenantId:job.tenant_id,workspaceId:job.workspace_id,outcome:'failure',details:{jobId:job.job_id,jobType:job.job_type,status:failed?.status,retryDelayMs:failed?.status==='queued'?delay:null,error:error.message}});}
      finally{activeJobId=null;}
      if(once)break;
    }
  }finally{
    clearInterval(heartbeat);
    clearInterval(recovery);
    await runtime.jobQueue.removeWorker(workerId).catch(()=>{});
    runtime.jobQueue.close();await runtime.productionRepository?.close?.();
  }
  return {workerId,processed,shutdown:'graceful'};
}

process.on('SIGINT',()=>{stopping=true;});process.on('SIGTERM',()=>{stopping=true;});
if(process.argv[1]&&fileURLToPath(import.meta.url)===path.resolve(process.argv[1])){runWorker({once:process.argv.includes('--once')}).then((result)=>{console.log(JSON.stringify(result));}).catch((error)=>{console.error(error);process.exitCode=1;});}
