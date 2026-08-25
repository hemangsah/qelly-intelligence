const QUEUE_KEY='qelly.public-runtime.cloud.queue.v1';
const META_KEY='qelly.public-runtime.cloud.meta.v1';
const LEGACY_QUEUE_KEY='qelly.prompt2c.cloud.queue.v1';
const LEGACY_META_KEY='qelly.prompt2c.cloud.meta.v1';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_BATCH_ITEMS=100;
const MAX_QUEUE_BATCHES=25;
const PULL_PAGE_SIZE=50;
const MAX_PULL_PAGES=100;
const MAX_PULL_REVISION_ROWS_TOTAL=5000;

const safeParse=(value,fallback)=>{try{return JSON.parse(value??'')??fallback;}catch{return fallback;}};
const readQueue=()=>{
  const source=localStorage.getItem(QUEUE_KEY)??localStorage.getItem(LEGACY_QUEUE_KEY);
  const value=safeParse(source,[]);
  if(source!==null&&!localStorage.getItem(QUEUE_KEY)){localStorage.setItem(QUEUE_KEY,JSON.stringify(value));localStorage.removeItem(LEGACY_QUEUE_KEY);}
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
  revisionPagesPartial:0,
  deletedRecordsApplied:0,
  deletedRecordsSkipped:0
});
const readMeta=()=>{
  const source=localStorage.getItem(META_KEY)??localStorage.getItem(LEGACY_META_KEY);
  const stored=safeParse(source,{});
  if(source!==null&&!localStorage.getItem(META_KEY)){localStorage.setItem(META_KEY,JSON.stringify(stored));localStorage.removeItem(LEGACY_META_KEY);}
  return {
    ...defaultMeta(),
    ...(stored&&typeof stored==='object'?stored:{}),
    baseRevisions:stored?.baseRevisions&&typeof stored.baseRevisions==='object'?stored.baseRevisions:{}
  };
};
const writeMeta=(value)=>localStorage.setItem(META_KEY,JSON.stringify(value));
const localItemsForCloud=(items)=>Array.isArray(items)?items.filter(item=>UUID.test(String(item?.id||''))):[];
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
const transferStatus=({offline=false,remaining=0,conflicts=[],failedBatches=[],flushed=0}={})=>{
  if(conflicts.length)return'conflict';
  if(offline)return'queued';
  if(failedBatches.length)return Number(flushed)>0?'partial':'failed';
  if(remaining)return'queued';
  return'complete';
};
const failureRecord=(batch,error)=>({
  batchId:String(batch?.id||''),
  status:Number(error?.status)||null,
  code:String(error?.code||'cloud_batch_failed'),
  message:String(error?.message||'Cloud batch failed')
});

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
  const input=Array.isArray(items)?items:[];
  const eligible=localItemsForCloud(input);
  const baseRevisions=readMeta().baseRevisions;
  const entries=chunks(eligible,MAX_BATCH_ITEMS).map(batchItems=>({
    id:crypto.randomUUID(),
    createdAt:new Date().toISOString(),
    items:batchItems,
    baseRevisions:scopedBaseRevisions(batchItems,baseRevisions)
  }));
  const queue=readQueue();
  if(entries.length&&queue.length+entries.length>MAX_QUEUE_BATCHES)throw queueCapacityError(queue.length,entries.length);
  if(entries.length)writeQueue([...queue,...entries]);
  return {
    queued:eligible.length,
    skipped:input.length-eligible.length,
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
  const initial=readQueue();
  if(!navigator.onLine){
    const result={flushed:0,remaining:initial.length,offline:true,conflicts:[],failedBatches:[],replayedBatches:0,queueOverCapacity:initial.length>MAX_QUEUE_BATCHES};
    return {...result,status:transferStatus(result)};
  }
  const remaining=[];
  const conflicts=[];
  const failedBatches=[];
  let flushed=0;
  let replayedBatches=0;

  for(let index=0;index<initial.length;index+=1){
    const batch=initial[index];
    try{
      const result=await pushBatch(api,batch);
      flushed+=finiteCount(result.applied);
      if(result.replayed)replayedBatches+=1;
      for(const conflict of result.results?.filter(item=>item.status==='conflict')||[])conflicts.push(conflict);
      const meta=readMeta();
      for(const applied of result.results?.filter(item=>item.status==='applied')||[]){
        const revision=Number(applied.cloudRevision);
        if(UUID.test(String(applied.id||''))&&Number.isInteger(revision)&&revision>=1)meta.baseRevisions[applied.id]=revision;
      }
      meta.lastSyncAt=new Date().toISOString();
      writeMeta(meta);
    }catch(error){
      remaining.push(batch);
      failedBatches.push(failureRecord(batch,error));
      if(error.status===401||error.status===403){
        remaining.push(...initial.slice(index+1));
        break;
      }
    }
  }

  writeQueue(remaining,{allowOverflow:true});
  const result={flushed,remaining:remaining.length,offline:false,conflicts,failedBatches,replayedBatches,queueOverCapacity:remaining.length>MAX_QUEUE_BATCHES};
  return {...result,status:transferStatus(result)};
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

const applyCloudDeletions=(deleted,removeSavedCalculation)=>{
  const seen=new Set();
  let applied=0;
  let skipped=0;
  if(typeof removeSavedCalculation!=='function')return {applied,skipped:(Array.isArray(deleted)?deleted.length:0)};
  for(const tombstone of Array.isArray(deleted)?deleted:[]){
    const id=String(tombstone?.id||'');
    if(!UUID.test(id)||seen.has(id)){skipped+=1;continue;}
    seen.add(id);
    try{removeSavedCalculation(id);applied+=1;}
    catch(error){
      if(error?.code==='saved_not_found')skipped+=1;
      else throw error;
    }
  }
  return {applied,skipped};
};

export async function pullCloudToLocal(api,{importSavedCalculations,removeSavedCalculation}={}){
  if(typeof importSavedCalculations!=='function')throw Object.assign(new Error('Cloud import helper is unavailable'),{code:'cloud_import_helper_missing'});
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
  const deletionSummary=applyCloudDeletions(deleted,removeSavedCalculation);
  const meta=readMeta();
  for(const item of items){
    const revision=Number(item.baseCloudRevision||item.version||1);
    if(UUID.test(String(item.id||''))&&Number.isInteger(revision)&&revision>=1)meta.baseRevisions[item.id]=revision;
  }
  for(const tombstone of deleted){
    const id=String(tombstone?.id||'');
    if(UUID.test(id))delete meta.baseRevisions[id];
  }
  Object.assign(meta,{
    lastSyncAt:pulledAt||new Date().toISOString(),
    revisionHistoryPartial,
    revisionRowsReturned,
    revisionRowsImported,
    revisionRowsDropped,
    revisionRowsLimitPerPage,
    revisionRowsLimitTotal:MAX_PULL_REVISION_ROWS_TOTAL,
    revisionPagesPartial,
    deletedRecordsApplied:deletionSummary.applied,
    deletedRecordsSkipped:deletionSummary.skipped
  });
  writeMeta(meta);
  return {
    status:revisionHistoryPartial?'partial':'complete',
    summary,
    deleted,
    deletedApplied:deletionSummary.applied,
    deletedSkipped:deletionSummary.skipped,
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
  if(push.conflicts?.length||push.offline||push.remaining>0||push.failedBatches?.length)return {status:push.status,push,pull:null,conflicts:push.conflicts||[]};
  const pull=await pullCloudToLocal(api,helpers);
  return {status:pull.revisionHistoryPartial?'partial':'complete',push,pull,conflicts:[]};
}

export function installCloudResume(api,onResult=()=>{}){
  const listener=()=>flushCloudQueue(api).then(onResult).catch(error=>onResult({status:'failed',flushed:0,remaining:pendingCloudOperations(),offline:false,conflicts:[],failedBatches:[failureRecord(null,error)],replayedBatches:0}));
  window.addEventListener('online',listener);
  return ()=>window.removeEventListener('online',listener);
}

export const __cloudSyncTest=Object.freeze({
  chunks,
  localItemsForCloud,
  scopedBaseRevisions,
  boundedPageItems,
  applyCloudDeletions,
  transferStatus,
  MAX_BATCH_ITEMS,
  MAX_QUEUE_BATCHES,
  PULL_PAGE_SIZE,
  MAX_PULL_PAGES,
  MAX_PULL_REVISION_ROWS_TOTAL
});
