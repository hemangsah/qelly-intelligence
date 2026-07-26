import { RedisRespClient } from '../src/production/redis-resp-client.mjs';

const redisUrl=process.env.REDIS_URL;
const workerId=process.env.QELLY_WORKER_ID;
const namespace=process.env.QELLY_JOB_QUEUE_NAMESPACE??'qelly:jobs:v2';
if(!redisUrl||!workerId)throw new Error('REDIS_URL and QELLY_WORKER_ID are required');
const redis=new RedisRespClient(redisUrl,{environment:process.env});
try{
  const [redisHealth,heartbeat]=await Promise.all([redis.health(),redis.command(['GET',`${namespace}:worker:${workerId}`])]);
  const ageMs=heartbeat?Date.now()-Number(heartbeat):null;
  const maxAgeMs=Math.max(5000,Number(process.env.QELLY_WORKER_HEALTH_MAX_AGE_MS??60000));
  const ok=Boolean(redisHealth.ok&&heartbeat&&ageMs<=maxAgeMs);
  console.log(JSON.stringify({ok,workerId,redis:{ok:redisHealth.ok,tls:redisHealth.tls},lastHeartbeat:heartbeat?new Date(Number(heartbeat)).toISOString():null,ageMs,maxAgeMs}));
  if(!ok)process.exitCode=1;
}finally{redis.close();}
