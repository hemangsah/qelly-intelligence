const QUEUE_KEY='qelly.prompt2c.cloud.queue.v1';
const META_KEY='qelly.prompt2c.cloud.meta.v1';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_BATCH_ITEMS=100;
const MAX_QUEUE_BATCHES=25;
const PULL_PAGE_SIZE=50;
const MAX_PULL_PAGES=100;
const MAX_PULL_REVISION_ROWS_TOTAL=5000;

const safeParse=(value,fallback)=>{try{return JSON.parse(value??'')??fallback;}catch{return fallback;}};
const readQueue=()=>{
  const value=safeParse(localStorage.getItem(QUEUE_KEY),[]);
  return Array.isArray(value)?value:[];
};
const queueCapacityError=(current,incoming)=>Object.assign(
  new Error(`Offline cloud queue capacity reached (${current}/${MAX_QUEUE_BATCHES} batches). Reconnect and synchronize before queuing ${incoming} additional batch${incoming===1?'':'es'}.`),
  {code:'cloud_queue_capacity_exceeded',currentBatches:current,incomingBatches:incoming,maxBatches:MAX_QUEUE_BATCHES}
);
const writeQueue=(value,{allowOverflow=false}={})=>{
  if(!Array.isArray(value))throw Object.assign(new Error('Offline cloud queue is invalid'),{code:'cloud_queue_invalid'});
  if(value.length>MAX_QUEUE_BATCHES&&!allowOverflow)throw queueCapacityError(value.length,0);
  localStorage.setItem(QUEUE_KEY,JSON.stringify(value));
};
const defaultMeta=()=>({
  baseRevisions:{},
  lastSyncAt:null,
  revisionHistoryPartial:false,
  revisionRowsReturned:0,
  revisionRowsImported:0,
  revisionRowsDropped:0,
  revisionRowsLimitPerPage:0,
  revisionRowsLimitTotal:MAX_PULL_REVISION_ROWS_TOTAL,
  revisionPagesPartial:0
});
const readMeta=()=>{
  const stored=safeParse(localStorage.getItem(META_KEY),{});
  return {
    ...defaultMeta(),
    ...(stored&&typeof stored==='object'?stored:{}),
    baseRevisions:stored?.baseRevisions&&typeof stored.baseRevisions==='object'?stored.baseRevisions:{}
  };
};
const writeMeta=(value)=>localStorage.setItem(META_KEY,JSON.stringify(value));
const localItemsForCloud=(items)=>items.filter(item=>UUID.test(String(item.id||'')));
const chunks=(items,size)=>Array.from({length:Math.ceil(items.length/size)},(_,index)=>items.slice(index*size,(index+1)*size));
const scopedBaseRevisions=(items,source)=>{
  const revisions={};
  const available=source&&typeof source==='object'?source:{};
  for(const item of Array.isArray(items)?items:[]){
    const id=String(item?.id||'');
    if(!UUID.test(id)||!Object.prototype.hasOwnProperty.call(available,id))continue;
    const revision=Number(available[id]);
    if(Number.isInteger(revision)&&revision>=1)revisions[id]=revision;
  }
  return revisions;
};
const finiteCount=(value)=>Number.isFinite(Number(value))&&Number(value)>0?Math.floor(Number(value)):0;
const boundedPageItems=(rawItems,remainingRevisionRows)=>{
  let remaining=Math.max(0,Math.floor(Number(remainingRevisionRows)||0));
  let accepted=0;
  let dropped=0;
  const items=(Array.isArray(rawItems)?rawItems:[]).map(item=>{
    const revisions=Array.isArray(item?.revisions)?item.revisions:[];
    const keep=Math.min(revisions.length,remaining);
    const bounded=keep?revisions.slice(-keep):[];
    accepted+=bounded.length;
    dropped+=revisions.length-bounded.length;
    remaining-=bounded.length;
    return {...item,revisions:bounded};
  });
  return {items,accepted,dropped};
};

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
  const baseRevisions=readMeta().baseRevisions;
  const entries=chunks(eligible,MAX_BATCH_ITEMS).map(batchItems=>({
    id:crypto.randomUUID(),
    createdAt:new Date().toISOString(),
    items:batchItems,
    baseRevisions:scopedBaseRevisions(batchItems,baseRevisions)
  }));
  const queue=readQueue();
  if(queue.length+entries.length>MAX_QUEUE_BATCHES)throw queueCapacityError(queue.length,entries.length);
  writeQueue([...queue,...entries]);
  return {
    queued:eligible.length,
    skipped:items.length-eligible.length,
    batchId:entries[0]?.id??null,
    batchIds:entries.map(entry=>entry.id),
    batches:entries.length,
    queuedBatches:queue.length+entries.length,
    queueCapacity:MAX_QUEUE_BATCHES
  };
}

async function pushBatch(api,batch){
  return api('/api/v1/sync/push',{
    method:'POST',
    headers:{'Idempotency-Key':`qelly-sync-${batch.id}`},
    body:JSON.stringify({items:batch.items,baseRevisions:batch.baseRevisions})
  });
}

export async function flushCloudQueue(api){
  if(!navigator.onLine)return {flushed:0,remaining:pendingCloudOperations(),offline:true,conflicts:[],replayedBatches:0};
  const queue=readQueue();
  const remaining=[];
  const conflicts=[];
  let flushed=0;
  let replayedBatches=0;

  for(let index=0;index<queue.length;index+=1){
    const batch=queue[index];
    try{
      const result=await pushBatch(api,batch);
      flushed+=result.applied||0;
      if(result.replayed)replayedBatches+=1;
      for(const conflict of result.results?.filter(item=>item.status==='conflict')||[])conflicts.push(conflict);
      const meta=readMeta();
      for(const applied of result.results?.filter(item=>item.status==='applied')||[])meta.baseRevisions[applied.id]=applied.cloudRevision;
      meta.lastSyncAt=new Date().toISOString();
      writeMeta(meta);
    }catch(error){
      remaining.push(batch);
      if(error.status===401||error.status===403){
        remaining.push(...queue.slice(index+1));
        break;
      }
    }
  }

  writeQueue(remaining,{allowOverflow:true});
  return {flushed,remaining:remaining.length,offline:false,conflicts,replayedBatches,queueOverCapacity:remaining.length>MAX_QUEUE_BATCHES};
}

export async function pushLocalToCloud(api,items){
  const queued=queueCloudPush(items);
  const flushed=await flushCloudQueue(api);
  return {...queued,...flushed};
}

const pullPage=async(api,cursor)=>{
  const query=new URLSearchParams({limit:String(PULL_PAGE_SIZE)});
  if(cursor)query.set('cursor',cursor);
  return api(`/api/v1/sync/pull?${query.toString()}`);
};

export async function pullCloudToLocal(api,{importSavedCalculations}){
  const items=[];
  const deleted=[];
  let cursor=null;
  let pulledAt=null;
  let pages=0;
  let revisionHistoryPartial=false;
  let revisionRowsReturned=0;
  let revisionRowsImported=0;
  let revisionRowsDropped=0;
  let revisionRowsLimitPerPage=0;
  let revisionPagesPartial=0;

  do{
    if(pages>=MAX_PULL_PAGES)throw Object.assign(new Error('Cloud pull exceeded the supported page limit'),{code:'cloud_pull_page_limit'});
    const result=await pullPage(api,cursor);
    const pagePartial=Boolean(result.revisionHistoryPartial);
    const bounded=boundedPageItems(result.items,MAX_PULL_REVISION_ROWS_TOTAL-revisionRowsImported);
    items.push(...bounded.items);
    deleted.push(...(result.deleted||[]));
    revisionRowsReturned+=finiteCount(result.revisionRowsReturned);
    revisionRowsImported+=bounded.accepted;
    revisionRowsDropped+=bounded.dropped;
    revisionRowsLimitPerPage=Math.max(revisionRowsLimitPerPage,finiteCount(result.revisionRowsLimit));
    if(pagePartial)revisionPagesPartial+=1;
    revisionHistoryPartial=revisionHistoryPartial||pagePartial||bounded.dropped>0;
    pulledAt=result.pulledAt||pulledAt;
    cursor=result.nextCursor||null;
    pages+=1;
  }while(cursor);

  const payload={schemaVersion:2,items};
  const summary=importSavedCalculations(JSON.stringify(payload),{merge:true});
  const meta=readMeta();
  for(const item of items)meta.baseRevisions[item.id]=item.baseCloudRevision||item.version||1;
  Object.assign(meta,{
    lastSyncAt:pulledAt||new Date().toISOString(),
    revisionHistoryPartial,
    revisionRowsReturned,
    revisionRowsImported,
    revisionRowsDropped,
    revisionRowsLimitPerPage,
    revisionRowsLimitTotal:MAX_PULL_REVISION_ROWS_TOTAL,
    revisionPagesPartial
  });
  writeMeta(meta);
  return {
    summary,
    deleted,
    pulledAt:meta.lastSyncAt,
    pages,
    revisionHistoryPartial,
    revisionRowsReturned,
    revisionRowsImported,
    revisionRowsDropped,
    revisionRowsLimitPerPage,
    revisionRowsLimitTotal:MAX_PULL_REVISION_ROWS_TOTAL,
    revisionPagesPartial
  };
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

export const __cloudSyncTest=Object.freeze({chunks,localItemsForCloud,scopedBaseRevisions,boundedPageItems,MAX_BATCH_ITEMS,MAX_QUEUE_BATCHES,PULL_PAGE_SIZE,MAX_PULL_PAGES,MAX_PULL_REVISION_ROWS_TOTAL});
