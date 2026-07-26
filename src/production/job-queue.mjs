import crypto from 'node:crypto';
import { RedisRespClient } from './redis-resp-client.mjs';

const sleep=(ms)=>new Promise((resolve)=>setTimeout(resolve,ms));

export class ProductionJobQueue{
  constructor({repository,redisUrl=process.env.REDIS_URL,mode=process.env.QELLY_JOB_QUEUE_MODE??(process.env.NODE_ENV==='production'?'redis':'database'),namespace='qelly:jobs:v2',nodeEnv=process.env.NODE_ENV,allowDatabaseQueueInProduction=process.env.QELLY_ALLOW_DATABASE_QUEUE_IN_PRODUCTION==='true',environment=process.env,leaseMs=60000}={}){
    this.repository=repository;this.mode=mode;this.namespace=namespace;this.environment=environment;this.leaseMs=Math.max(10000,Math.min(Number(leaseMs)||60000,3600000));this.redis=redisUrl?new RedisRespClient(redisUrl,{environment}):null;
    if(mode==='redis'&&!this.redis)throw Object.assign(new Error('REDIS_URL is required when QELLY_JOB_QUEUE_MODE=redis'),{code:'redis_configuration_missing'});
    if(nodeEnv==='production'&&mode!=='redis'&&!allowDatabaseQueueInProduction)throw Object.assign(new Error('Production requires Redis-backed jobs'),{code:'production_redis_required'});
  }
  key(name){return `${this.namespace}:${name}`;}
  async health(){if(this.mode==='redis'){const base=await this.redis.health();if(!base.ok)return base;try{const [pending,processing,delayed,dead,workers]=await Promise.all([this.redis.command(['LLEN',this.key('pending')]),this.redis.command(['LLEN',this.key('processing')]),this.redis.command(['ZCARD',this.key('delayed')]),this.redis.command(['LLEN',this.key('dead')]),this.redis.command(['ZCOUNT',this.key('workers'),String(Date.now()-this.leaseMs),'inf'])]);return {...base,queue:{pending,processing,delayed,dead,activeWorkers:workers},namespace:this.namespace};}catch(error){return {...base,ok:false,error:error.message};}}return {ok:true,driver:'database-development-queue'};}
  async dispatch(job,{force=false}={}){
    const marker=this.key(`dispatched:${job.job_id}`),pending=this.key('pending'),delayed=this.key('delayed');
    const availableAt=Date.parse(job.available_at??job.availableAt??new Date().toISOString());
    const delayedDispatch=Number.isFinite(availableAt)&&availableAt>Date.now();
    const script=`if ARGV[1] ~= '1' and redis.call('EXISTS',KEYS[1]) == 1 then return 0 end
redis.call('SET',KEYS[1],'1','PX',ARGV[2])
if ARGV[3] == '1' then redis.call('ZADD',KEYS[3],ARGV[4],ARGV[5]) else redis.call('LPUSH',KEYS[2],ARGV[5]) end
return 1`;
    const result=await this.redis.command(['EVAL',script,'3',marker,pending,delayed,force?'1':'0',String(7*24*60*60*1000),delayedDispatch?'1':'0',String(availableAt),job.job_id]);
    return Number(result)===1;
  }
  async enqueue(input){
    const job=await this.repository.createJob(input);
    if(this.mode==='redis'&&job.status==='queued'){
      try{await this.dispatch(job);}
      catch(error){return {...job,dispatch_pending:true,dispatch_error_code:error.code??'redis_dispatch_unavailable'};}
    }
    return job;
  }
  async promoteDelayed({limit=100}={}){
    if(this.mode!=='redis')return 0;
    const ids=await this.redis.command(['ZRANGEBYSCORE',this.key('delayed'),'-inf',String(Date.now()),'LIMIT','0',String(Math.max(1,Math.min(Number(limit)||100,500)))]);
    let promoted=0;
    const script=`if redis.call('ZREM',KEYS[1],ARGV[1]) == 1 then redis.call('LPUSH',KEYS[2],ARGV[1]); return 1 end
return 0`;
    for(const jobId of ids??[])if(Number(await this.redis.command(['EVAL',script,'2',this.key('delayed'),this.key('pending'),jobId]))===1)promoted+=1;
    return promoted;
  }
  async reserve({workerId=`worker_${crypto.randomUUID()}`,types=[],timeoutSeconds=1}={}){
    if(this.mode==='redis'){
      await this.promoteDelayed();
      const key=this.key('pending'),processing=this.key('processing');
      const result=await this.redis.command(['BRPOPLPUSH',key,processing,Math.max(1,Number(timeoutSeconds))]);
      if(!result)return null;
      const job=await this.repository.getJob(result);
      if(!job||job.status!=='queued'){await this.cleanup(result);return null;}
      if(types.length&&!types.includes(job.job_type)){await this.redis.command(['LREM',processing,'0',result]);await this.redis.command(['LPUSH',key,result]);return null;}
      const reserved=await this.repository.reserveJobById({jobId:result,workerId});
      if(!reserved)await this.cleanup(result);
      else await this.redis.command(['SET',this.key(`lease:${result}`),workerId,'PX',String(this.leaseMs)]);
      return reserved;
    }
    return this.repository.reserveJob({workerId,types});
  }
  async complete(jobId,result={}){const job=await this.repository.completeJob(jobId,result);if(this.mode==='redis')await this.cleanup(jobId);return job;}
  async fail(jobId,error,options={}){const job=await this.repository.failJob(jobId,error,options);if(this.mode==='redis'){await this.cleanup(jobId);if(job?.status==='queued')await this.dispatch(job);else if(job?.status==='dead')await this.redis.command(['LPUSH',this.key('dead'),jobId]);}return job;}
  async cleanup(jobId){await Promise.all([this.redis.command(['LREM',this.key('processing'),'0',jobId]),this.redis.command(['ZREM',this.key('delayed'),jobId]),this.redis.command(['DEL',this.key(`lease:${jobId}`)]),this.redis.command(['DEL',this.key(`dispatched:${jobId}`)])]);}
  async heartbeat(workerId,{jobId=null}={}){if(this.mode!=='redis')return {ok:true,mode:this.mode};const now=Date.now(),operations=[this.redis.command(['SET',this.key(`worker:${workerId}`),String(now),'PX',String(this.leaseMs)]),this.redis.command(['ZADD',this.key('workers'),String(now),workerId]),this.redis.command(['ZREMRANGEBYSCORE',this.key('workers'),'-inf',String(now-this.leaseMs)])];if(jobId){operations.push(this.redis.command(['SET',this.key(`lease:${jobId}`),workerId,'PX',String(this.leaseMs)]));operations.push(this.repository.heartbeatJob({jobId,workerId}));}await Promise.all(operations);return {ok:true,workerId,jobId,at:new Date(now).toISOString(),expiresInMs:this.leaseMs};}
  async workerHealth(workerId){if(this.mode!=='redis')return {ok:true,mode:this.mode};const heartbeat=await this.redis.command(['GET',this.key(`worker:${workerId}`)]);return {ok:Boolean(heartbeat),workerId,lastHeartbeat:heartbeat?new Date(Number(heartbeat)).toISOString():null};}
  async removeWorker(workerId){if(this.mode!=='redis')return;await Promise.all([this.redis.command(['DEL',this.key(`worker:${workerId}`)]),this.redis.command(['ZREM',this.key('workers'),workerId])]);}
  async recover({staleAfterMs=this.leaseMs,limit=100}={}){
    if(this.mode!=='redis')return {recovered:0,orphans:0};
    const stale=await this.repository.recoverStaleJobs({staleAfterMs,limit});
    for(const job of stale){await this.redis.command(['LREM',this.key('processing'),'0',job.job_id]);await this.dispatch(job,{force:true});}
    const processing=await this.redis.command(['LRANGE',this.key('processing'),'0',String(Math.max(0,Math.min(Number(limit)||100,500)-1))]);
    let orphans=0;
    for(const jobId of processing??[]){const job=await this.repository.getJob(jobId);if(!job||['completed','dead','cancelled'].includes(job.status)){await this.cleanup(jobId);orphans+=1;}else if(job.status==='queued'){await this.redis.command(['LREM',this.key('processing'),'0',jobId]);await this.dispatch(job,{force:true});orphans+=1;}}
    const queued=await this.repository.listQueuedJobs({limit});
    let reconciled=0;
    for(const job of queued)if(await this.dispatch(job))reconciled+=1;
    await this.promoteDelayed({limit});
    return {recovered:stale.length,orphans,reconciled};
  }
  async list(options={}){return this.repository.listJobs(options);}
  async waitForJob(options={}){for(let attempt=0;attempt<Math.max(1,options.attempts??30);attempt+=1){const job=await this.reserve(options);if(job)return job;await sleep(options.delayMs??250);}return null;}
  close(){this.redis?.close();}
}
