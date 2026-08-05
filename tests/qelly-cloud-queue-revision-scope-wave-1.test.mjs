import test,{afterEach,beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {queueCloudPush,__cloudSyncTest} from '../apps/web/public/assets/qelly-cloud-sync.mjs';

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
beforeEach(()=>{globalThis.localStorage=new MemoryStorage();});
afterEach(()=>{
  if(originalLocalStorage===undefined)delete globalThis.localStorage;
  else globalThis.localStorage=originalLocalStorage;
});

const uuid=(index)=>`${index.toString(16).padStart(8,'0')}-1111-4111-8111-111111111111`;
const item=(index)=>({id:uuid(index),name:`Item ${index}`,result:{formulaId:'position-size'},version:1});

test('scoped base revisions include only validated revisions for the current batch',()=>{
  const source={
    [uuid(1)]:3,
    [uuid(2)]:'4',
    [uuid(3)]:0,
    [uuid(4)]:-1,
    [uuid(5)]:'invalid',
    [uuid(999)]:9,
    'not-a-uuid':10
  };
  const scoped=__cloudSyncTest.scopedBaseRevisions([item(1),item(2),item(3),item(4),item(5)],source);
  assert.deepEqual(scoped,{[uuid(1)]:3,[uuid(2)]:4});
});

test('queued batches do not duplicate the account-wide revision map',()=>{
  const baseRevisions=Object.fromEntries(Array.from({length:1000},(_,index)=>[uuid(index+1),index+1]));
  localStorage.setItem(META_KEY,JSON.stringify({baseRevisions,lastSyncAt:null}));
  const items=Array.from({length:150},(_,index)=>item(index+1));
  const result=queueCloudPush(items);
  const queue=JSON.parse(localStorage.getItem(QUEUE_KEY));

  assert.equal(result.batches,2);
  assert.equal(queue.length,2);
  assert.equal(queue[0].items.length,100);
  assert.equal(queue[1].items.length,50);
  assert.equal(Object.keys(queue[0].baseRevisions).length,100);
  assert.equal(Object.keys(queue[1].baseRevisions).length,50);
  assert.equal(queue[0].baseRevisions[uuid(1)],1);
  assert.equal(queue[0].baseRevisions[uuid(100)],100);
  assert.equal(queue[0].baseRevisions[uuid(101)],undefined);
  assert.equal(queue[1].baseRevisions[uuid(101)],101);
  assert.equal(queue[1].baseRevisions[uuid(150)],150);
  assert.equal(queue[1].baseRevisions[uuid(999)],undefined);
});

test('queue source computes batch-local revision metadata before serialization',async()=>{
  const source=await readFile(new URL('../apps/web/public/assets/qelly-cloud-sync.mjs',import.meta.url),'utf8');
  assert.match(source,/baseRevisions:scopedBaseRevisions\(batchItems,baseRevisions\)/);
  assert.doesNotMatch(source,/baseRevisions\s*\n\s*\}\)\);/);
  assert.match(source,/Object\.prototype\.hasOwnProperty\.call\(available,id\)/);
  assert.match(source,/Number\.isInteger\(revision\)&&revision>=1/);
});
