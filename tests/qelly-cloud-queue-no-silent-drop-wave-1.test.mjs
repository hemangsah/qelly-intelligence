import test,{afterEach,beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {pendingCloudOperations,queueCloudPush,__cloudSyncTest} from '../apps/web/public/assets/qelly-cloud-sync.mjs';

const QUEUE_KEY='qelly.prompt2c.cloud.queue.v1';

class MemoryStorage{
  constructor(){this.values=new Map();}
  getItem(key){return this.values.has(key)?this.values.get(key):null;}
  setItem(key,value){this.values.set(key,String(value));}
  removeItem(key){this.values.delete(key);}
  clear(){this.values.clear();}
}

const originalLocalStorage=globalThis.localStorage;
beforeEach(()=>{globalThis.localStorage=new MemoryStorage();});
afterEach(()=>{
  if(originalLocalStorage===undefined)delete globalThis.localStorage;
  else globalThis.localStorage=originalLocalStorage;
});

const uuid=(index)=>`${index.toString(16).padStart(8,'0')}-1111-4111-8111-111111111111`;
const cloudItem=(index)=>({id:uuid(index),name:`Item ${index}`,result:{formulaId:'position-size'},version:1});
const queuedBatch=(index)=>({id:uuid(index+10000),createdAt:'2026-08-05T00:00:00.000Z',items:[cloudItem(index)],baseRevisions:{}});

const seedQueue=(count)=>{
  const queue=Array.from({length:count},(_,index)=>queuedBatch(index));
  localStorage.setItem(QUEUE_KEY,JSON.stringify(queue));
  return queue;
};

test('queue accepts the final available batch without dropping existing work',()=>{
  const existing=seedQueue(24);
  const result=queueCloudPush(Array.from({length:100},(_,index)=>cloudItem(index+100)));
  const stored=JSON.parse(localStorage.getItem(QUEUE_KEY));
  assert.equal(result.batches,1);
  assert.equal(result.queuedBatches,25);
  assert.equal(result.queueCapacity,25);
  assert.equal(stored.length,25);
  assert.deepEqual(stored.slice(0,24),existing);
  assert.equal(pendingCloudOperations(),25);
});

test('full queue rejects additional work before mutating storage',()=>{
  seedQueue(25);
  const before=localStorage.getItem(QUEUE_KEY);
  assert.throws(
    ()=>queueCloudPush([cloudItem(999)]),
    error=>error?.code==='cloud_queue_capacity_exceeded'&&error?.currentBatches===25&&error?.incomingBatches===1&&error?.maxBatches===25
  );
  assert.equal(localStorage.getItem(QUEUE_KEY),before);
  assert.equal(pendingCloudOperations(),25);
});

test('multi-batch admission is atomic when only one slot remains',()=>{
  seedQueue(24);
  const before=localStorage.getItem(QUEUE_KEY);
  const items=Array.from({length:101},(_,index)=>cloudItem(index+2000));
  assert.throws(
    ()=>queueCloudPush(items),
    error=>error?.code==='cloud_queue_capacity_exceeded'&&error?.currentBatches===24&&error?.incomingBatches===2
  );
  assert.equal(localStorage.getItem(QUEUE_KEY),before);
  assert.equal(pendingCloudOperations(),24);
});

test('queue source contains no silent truncation and allows legacy overflow only while draining',async()=>{
  const source=await readFile(new URL('../apps/web/public/assets/qelly-cloud-sync.mjs',import.meta.url),'utf8');
  assert.equal(__cloudSyncTest.MAX_QUEUE_BATCHES,25);
  assert.doesNotMatch(source,/slice\(-25\)/);
  assert.match(source,/cloud_queue_capacity_exceeded/);
  assert.match(source,/queue\.length\+entries\.length>MAX_QUEUE_BATCHES/);
  assert.match(source,/writeQueue\(remaining,\{allowOverflow:true\}\)/);
});
