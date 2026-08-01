const QUEUE_KEY='qelly.prompt2c.cloud.queue.v1';
const META_KEY='qelly.prompt2c.cloud.meta.v1';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const safeParse=(value,fallback)=>{try{return JSON.parse(value??'')??fallback;}catch{return fallback;}};
const readQueue=()=>safeParse(localStorage.getItem(QUEUE_KEY),[]);
const writeQueue=(value)=>localStorage.setItem(QUEUE_KEY,JSON.stringify(value.slice(-25)));
const readMeta=()=>safeParse(localStorage.getItem(META_KEY),{baseRevisions:{},lastSyncAt:null});
const writeMeta=(value)=>localStorage.setItem(META_KEY,JSON.stringify(value));
const localItemsForCloud=(items)=>items.filter(item=>UUID.test(String(item.id||'')));

export function pendingCloudOperations(){return readQueue().length;}
export function cloudMeta(){return readMeta();}

export async function cloudStatus(api){
  try{return {authenticated:true,...await api('/api/v1/cloud/status'),queuedLocalBatches:pendingCloudOperations()};}
  catch(error){
    if(error.status===401||/Authentication is required/i.test(error.message))return {authenticated:false,available:true,optIn:false,cloudRecordCount:0,pendingOperationCount:0,queuedLocalBatches:pendingCloudOperations()};
    throw error;
  }
}

export async function setCloudOptIn(api,enabled){
  const result=await api('/api/v1/cloud/opt-in',{method:'POST',body:JSON.stringify({enabled:Boolean(enabled)})});
  return Boolean(result.enabled);
}

export function queueCloudPush(items){
  const eligible=localItemsForCloud(items);
  const entry={id:crypto.randomUUID(),createdAt:new Date().toISOString(),items:eligible,baseRevisions:readMeta().baseRevisions};
  const queue=readQueue();queue.push(entry);writeQueue(queue);
  return {queued:eligible.length,skipped:items.length-eligible.length,batchId:entry.id};
}

async function pushBatch(api,batch){
  return api('/api/v1/sync/push',{
    method:'POST',
    headers:{'Idempotency-Key':`qelly-sync-${batch.id}`},
    body:JSON.stringify({items:batch.items,baseRevisions:batch.baseRevisions})
  });
}

export async function flushCloudQueue(api){
  if(!navigator.onLine)return {flushed:0,remaining:pendingCloudOperations(),offline:true,conflicts:[]};
  const queue=readQueue(),remaining=[],conflicts=[];let flushed=0;
  for(const batch of queue){
    try{
      const result=await pushBatch(api,batch);
      flushed+=result.applied||0;
      for(const conflict of result.results?.filter(item=>item.status==='conflict')||[])conflicts.push(conflict);
      const meta=readMeta();
      for(const applied of result.results?.filter(item=>item.status==='applied')||[])meta.baseRevisions[applied.id]=applied.cloudRevision;
      meta.lastSyncAt=new Date().toISOString();writeMeta(meta);
    }catch(error){
      remaining.push(batch);
      if(error.status===401||error.status===403)break;
    }
  }
  writeQueue(remaining);
  return {flushed,remaining:remaining.length,offline:false,conflicts};
}

export async function pushLocalToCloud(api,items){
  const queued=queueCloudPush(items);
  const flushed=await flushCloudQueue(api);
  return {...queued,...flushed};
}

export async function pullCloudToLocal(api,{importSavedCalculations}){
  const result=await api('/api/v1/sync/pull');
  const payload={schemaVersion:2,items:result.items||[]};
  const summary=importSavedCalculations(JSON.stringify(payload),{merge:true});
  const meta=readMeta();
  for(const item of result.items||[])meta.baseRevisions[item.id]=item.baseCloudRevision||item.version||1;
  meta.lastSyncAt=result.pulledAt||new Date().toISOString();
  writeMeta(meta);
  return {summary,deleted:result.deleted||[],pulledAt:meta.lastSyncAt};
}

export async function synchronizeCloud(api,items,helpers){
  const push=await pushLocalToCloud(api,items);
  if(push.conflicts?.length)return {push,pull:null,conflicts:push.conflicts};
  const pull=await pullCloudToLocal(api,helpers);
  return {push,pull,conflicts:[]};
}

export function installCloudResume(api,onResult=()=>{}){
  const listener=()=>flushCloudQueue(api).then(onResult).catch(()=>{});
  window.addEventListener('online',listener);
  return ()=>window.removeEventListener('online',listener);
}
