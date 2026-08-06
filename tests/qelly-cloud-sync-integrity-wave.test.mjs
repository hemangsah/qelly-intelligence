import test,{afterEach,beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {
  queueCloudPush,
  flushCloudQueue,
  pullCloudToLocal,
  cloudMeta,
  __cloudSyncTest
} from '../apps/web/public/assets/qelly-cloud-sync.mjs';
import {__dataTest} from '../functions/_lib/data.js';

const QUEUE_KEY='qelly.prompt2c.cloud.queue.v1';
const META_KEY='qelly.prompt2c.cloud.meta.v1';

class MemoryStorage{
  constructor(){this.values=new Map();}
  getItem(key){return this.values.has(key)?this.values.get(key):null;}
  setItem(key,value){this.values.set(key,String(value));}
  removeItem(key){this.values.delete(key);}
  clear(){this.values.clear();}
}

const originalLocalStorage=globalThis.localStorage;
const originalNavigatorDescriptor=Object.getOwnPropertyDescriptor(globalThis,'navigator');
const setOnline=(onLine)=>Object.defineProperty(globalThis,'navigator',{value:{onLine},configurable:true,writable:true});
const uuid=(index)=>`${index.toString(16).padStart(8,'0')}-1111-4111-8111-111111111111`;
const item=(index)=>({id:uuid(index),name:`Item ${index}`,result:{formulaId:'position-size'},version:1});
const batch=(index)=>({id:uuid(index),createdAt:'2026-08-06T00:00:00.000Z',items:[item(index)],baseRevisions:{}});

beforeEach(()=>{globalThis.localStorage=new MemoryStorage();setOnline(true);});
afterEach(()=>{
  if(originalLocalStorage===undefined)delete globalThis.localStorage;
  else globalThis.localStorage=originalLocalStorage;
  if(originalNavigatorDescriptor)Object.defineProperty(globalThis,'navigator',originalNavigatorDescriptor);
  else delete globalThis.navigator;
});

test('full queue rejects a new batch without changing stored operations',()=>{
  const stored=Array.from({length:__cloudSyncTest.MAX_QUEUE_BATCHES},(_,index)=>batch(index+1));
  const encoded=JSON.stringify(stored);
  localStorage.setItem(QUEUE_KEY,encoded);
  assert.throws(()=>queueCloudPush([item(1000)]),error=>error?.code==='cloud_queue_capacity_exceeded');
  assert.equal(localStorage.getItem(QUEUE_KEY),encoded);
});

test('near-full queue rejects a multi-batch admission atomically',()=>{
  const stored=Array.from({length:__cloudSyncTest.MAX_QUEUE_BATCHES-1},(_,index)=>batch(index+1));
  const encoded=JSON.stringify(stored);
  localStorage.setItem(QUEUE_KEY,encoded);
  assert.throws(()=>queueCloudPush(Array.from({length:101},(_,index)=>item(index+100))),error=>error?.incomingBatches===2);
  assert.equal(localStorage.getItem(QUEUE_KEY),encoded);
});

test('oversized legacy queues drain without truncation',async()=>{
  const stored=Array.from({length:30},(_,index)=>batch(index+1));
  localStorage.setItem(QUEUE_KEY,JSON.stringify(stored));
  const result=await flushCloudQueue(async(_path,options)=>{
    const body=JSON.parse(options.body);
    return {applied:body.items.length,replayed:false,results:body.items.map(record=>({id:record.id,status:'applied',cloudRevision:2}))};
  });
  assert.equal(result.flushed,30);
  assert.equal(result.remaining,0);
  assert.equal(result.status,'complete');
  assert.deepEqual(JSON.parse(localStorage.getItem(QUEUE_KEY)),[]);
});

test('queued batches contain only validated revisions for their own records',()=>{
  const baseRevisions=Object.fromEntries(Array.from({length:1000},(_,index)=>[uuid(index+1),index+1]));
  localStorage.setItem(META_KEY,JSON.stringify({baseRevisions,lastSyncAt:null}));
  const result=queueCloudPush(Array.from({length:150},(_,index)=>item(index+1)));
  const queue=JSON.parse(localStorage.getItem(QUEUE_KEY));
  assert.equal(result.batches,2);
  assert.equal(Object.keys(queue[0].baseRevisions).length,100);
  assert.equal(Object.keys(queue[1].baseRevisions).length,50);
  assert.equal(queue[0].baseRevisions[uuid(101)],undefined);
  assert.equal(queue[1].baseRevisions[uuid(999)],undefined);
});

test('offline and failed transfers remain queued with explicit outcomes',async()=>{
  queueCloudPush([item(1)]);
  setOnline(false);
  const offline=await flushCloudQueue(async()=>{throw new Error('must not run');});
  assert.equal(offline.status,'queued');
  assert.equal(offline.offline,true);
  assert.equal(offline.remaining,1);

  setOnline(true);
  const failed=await flushCloudQueue(async()=>{throw Object.assign(new Error('provider unavailable'),{status:503,code:'provider_unavailable'});});
  assert.equal(failed.flushed,0);
  assert.equal(failed.remaining,1);
  assert.equal(failed.failedBatches.length,1);
  assert.equal(failed.failedBatches[0].code,'provider_unavailable');
  assert.equal(JSON.parse(localStorage.getItem(QUEUE_KEY)).length,1);
});

test('cloud pull applies tombstones and persists partial-history truth',async()=>{
  const liveId=uuid(1),deletedId=uuid(2),removed=[];
  const api=async(path)=>{
    assert.match(path,/\/api\/v1\/sync\/pull\?limit=50/);
    return {
      items:[{...item(1),baseCloudRevision:4,revisions:[{version:3},{version:4}]}],
      deleted:[{id:deletedId,deletedAt:'2026-08-06T00:00:00.000Z'}],
      nextCursor:null,
      pulledAt:'2026-08-06T01:00:00.000Z',
      revisionHistoryPartial:true,
      revisionRowsReturned:500,
      revisionRowsLimit:500
    };
  };
  let imported=null;
  const result=await pullCloudToLocal(api,{
    importSavedCalculations:(content,options)=>{imported={content:JSON.parse(content),options};return {imported:1,total:1};},
    removeSavedCalculation:(id)=>{removed.push(id);return {deleted:true,id};}
  });
  assert.equal(imported.content.items[0].id,liveId);
  assert.deepEqual(imported.options,{merge:true});
  assert.deepEqual(removed,[deletedId]);
  assert.equal(result.deletedApplied,1);
  assert.equal(result.revisionHistoryPartial,true);
  const meta=cloudMeta();
  assert.equal(meta.baseRevisions[liveId],4);
  assert.equal(meta.baseRevisions[deletedId],undefined);
  assert.equal(meta.revisionRowsReturned,500);
  assert.equal(meta.revisionHistoryPartial,true);
});

test('client revision ceiling keeps newest snapshots and reports dropped rows',()=>{
  const revisions=Array.from({length:8},(_,index)=>({version:index+1}));
  const bounded=__cloudSyncTest.boundedPageItems([{id:uuid(1),revisions}],3);
  assert.deepEqual(bounded.items[0].revisions.map(entry=>entry.version),[6,7,8]);
  assert.equal(bounded.accepted,3);
  assert.equal(bounded.dropped,5);
});

test('server revision query is bounded, minimal and newest first',()=>{
  const path=__dataTest.revisionPagePath([{id:uuid(1)},{id:uuid(2)}]);
  assert.match(path,/select=id%2Ccalculation_id%2Crevision_no%2Ccreated_at%2Csnapshot/);
  assert.match(path,/order=created_at.desc%2Cid.desc/);
  assert.match(path,/limit=500/);
  assert.equal(__dataTest.MAX_PULL_REVISION_ROWS,500);
});

test('saved calculations UI does not issue unconditional cloud success messages',async()=>{
  const source=await readFile(new URL('../apps/web/public/assets/routes/saved-calculations.mjs',import.meta.url),'utf8');
  assert.match(source,/Cloud \$\{verb\} is queued while offline/);
  assert.match(source,/failedBatches/);
  assert.match(source,/PARTIAL REVISION WINDOW/);
  assert.match(source,/removeSavedCalculation\}\)\)/);
  assert.doesNotMatch(source,/action\('Local calculations uploaded'/);
  assert.doesNotMatch(source,/action\('Cloud synchronization complete'/);
});

test('backend sync response exposes bounded-history metadata',async()=>{
  const source=await readFile(new URL('../functions/_lib/data.js',import.meta.url),'utf8');
  assert.match(source,/const MAX_PULL_REVISION_ROWS=500/);
  assert.match(source,/revisionHistoryPartial:revisionPage\.partial/);
  assert.match(source,/revisionRowsReturned:revisionPage\.rows\.length/);
  assert.match(source,/revisionRowsLimit:MAX_PULL_REVISION_ROWS/);
  assert.doesNotMatch(source,/select:'\*',\n\s*calculation_id:`in\.\(\$\{ids\.join\(','\)\}\)`/);
});
