import crypto from 'node:crypto';
import { RedisRespClient } from './redis-resp-client.mjs';

const sleep=(ms)=>new Promise((resolve)=>setTimeout(resolve,ms));

export class ProductionJobQueue{
  constructor({repository,redisUrl=process.env.REDIS_URL,mode=process.env.QELLY_JOB_QUEUE_MODE??(process.env.NODE_ENV==='production'?'redis':'database'),namespace='qelly:a1',nodeEnv=process.env.NODE_ENV,allowDatabaseQueueInProduction=process.env.QELLY_ALLOW_DATABASE_QUEUE_IN_PRODUCTION==='true'}={}){
    this.repository=repository;this.mode=mode;this.namespace=namespace;this.redis=redisUrl?new RedisRespClient(redisUrl):null;
    if(mode==='redis'&&!this.redis)throw Object.assign(new Error('REDIS_URL is required when QELLY_JOB_QUEUE_MODE=redis'),{code:'redis_configuration_missing'});
    if(nodeEnv==='production'&&mode!=='redis'&&!allowDatabaseQueueInProduction)throw Object.assign(new Error('Production requires Redis-backed jobs'),{code:'production_redis_required'});
  }
  async health(){if(this.mode==='redis')return this.redis.health();return {ok:true,driver:'database-development-queue'};}
  async enqueue(input){
    const job=await this.repository.createJob(input);
    if(this.mode==='redis')await this.redis.command(['LPUSH',`${this.namespace}:pending`,job.job_id]);
    return job;
  }
  async reserve({workerId=`worker_${crypto.randomUUID()}`,types=[],timeoutSeconds=1}={}){
    if(this.mode==='redis'){
      const key=`${this.namespace}:pending`,processing=`${this.namespace}:processing:${workerId}`;
      const result=await this.redis.command(['BRPOPLPUSH',key,processing,Math.max(1,Number(timeoutSeconds))]);
      if(!result)return null;
      const job=await this.repository.getJob(result);
      if(!job||job.status!=='queued'){await this.redis.command(['LREM',processing,'0',result]);return null;}
      const reserved=await this.repository.reserveJobById({jobId:result,workerId});
      if(!reserved)await this.redis.command(['LREM',processing,'0',result]);
      return reserved;
    }
    return this.repository.reserveJob({workerId,types});
  }
  async complete(jobId,result={}){const job=await this.repository.completeJob(jobId,result);if(this.mode==='redis')await this.cleanup(jobId);return job;}
  async fail(jobId,error,options={}){const job=await this.repository.failJob(jobId,error,options);if(this.mode==='redis'){await this.cleanup(jobId);if(job?.status==='queued')await this.redis.command(['LPUSH',`${this.namespace}:pending`,jobId]);else if(job?.status==='dead')await this.redis.command(['LPUSH',`${this.namespace}:dead`,jobId]);}return job;}
  async cleanup(jobId){const keys=await this.redis.command(['KEYS',`${this.namespace}:processing:*`]);for(const key of keys??[])await this.redis.command(['LREM',key,'0',jobId]);}
  async list(options={}){return this.repository.listJobs(options);}
  async waitForJob(options={}){for(let attempt=0;attempt<Math.max(1,options.attempts??30);attempt+=1){const job=await this.reserve(options);if(job)return job;await sleep(options.delayMs??250);}return null;}
  close(){this.redis?.close();}
}
