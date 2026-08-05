import test,{afterEach,beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {cloudMeta,pullCloudToLocal,__cloudSyncTest} from '../apps/web/public/assets/qelly-cloud-sync.mjs';

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

const item=(id,revisions,version=1)=>({
  id,
  name:`Calculation ${id.slice(0,4)}`,
  version,
  baseCloudRevision:version,
  revisions:revisions.map(revision=>({version:revision,createdAt:`2026-08-05T00:00:${String(revision).padStart(2,'0')}.000Z`}))
});

test('browser revision bound retains newest snapshots deterministically',()=>{
  const bounded=__cloudSyncTest.boundedPageItems([
    item('11111111-1111-4111-8111-111111111111',[1,2,3,4,5])
  ],3);
  assert.equal(bounded.accepted,3);
  assert.equal(bounded.dropped,2);
  assert.deepEqual(bounded.items[0].revisions.map(value=>value.version),[3,4,5]);
  assert.equal(__cloudSyncTest.MAX_PULL_REVISION_ROWS_TOTAL,5000);
});

test('cloud pull aggregates partial-history truth across pages and persists it',async()=>{
  const calls=[];
  const pages=[
    {
      items:[item('11111111-1111-4111-8111-111111111111',[1,2],2)],
      deleted:[],
      nextCursor:'next-page',
      revisionHistoryPartial:true,
      revisionRowsReturned:500,
      revisionRowsLimit:500,
      pulledAt:'2026-08-05T01:00:00.000Z'
    },
    {
      items:[item('22222222-2222-4222-8222-222222222222',[1],1)],
      deleted:[],
      nextCursor:null,
      revisionHistoryPartial:false,
      revisionRowsReturned:1,
      revisionRowsLimit:500,
      pulledAt:'2026-08-05T01:01:00.000Z'
    }
  ];
  const api=async(path)=>{
    calls.push(path);
    return pages.shift();
  };
  let importedPayload;
  const result=await pullCloudToLocal(api,{
    importSavedCalculations:(payload,options)=>{
      importedPayload=JSON.parse(payload);
      assert.deepEqual(options,{merge:true});
      return {imported:importedPayload.items.length};
    }
  });

  assert.equal(calls.length,2);
  assert.match(calls[1],/cursor=next-page/);
  assert.equal(importedPayload.items.length,2);
  assert.equal(result.pages,2);
  assert.equal(result.revisionHistoryPartial,true);
  assert.equal(result.revisionRowsReturned,501);
  assert.equal(result.revisionRowsImported,3);
  assert.equal(result.revisionRowsDropped,0);
  assert.equal(result.revisionRowsLimitPerPage,500);
  assert.equal(result.revisionRowsLimitTotal,5000);
  assert.equal(result.revisionPagesPartial,1);

  const meta=cloudMeta();
  assert.equal(meta.revisionHistoryPartial,true);
  assert.equal(meta.revisionRowsReturned,501);
  assert.equal(meta.revisionRowsImported,3);
  assert.equal(meta.revisionRowsDropped,0);
  assert.equal(meta.revisionPagesPartial,1);
  assert.equal(meta.lastSyncAt,'2026-08-05T01:01:00.000Z');
  assert.equal(meta.baseRevisions['11111111-1111-4111-8111-111111111111'],2);
});

test('saved calculations surface never labels bounded cloud history as complete',async()=>{
  const source=await readFile(new URL('../apps/web/public/assets/routes/saved-calculations.mjs',import.meta.url),'utf8');
  assert.match(source,/PARTIAL REVISION HISTORY/);
  assert.match(source,/older cloud snapshots may not be present locally/);
  assert.match(source,/pull\?\.revisionHistoryPartial/);
  assert.match(source,/Current cloud records synchronized, but revision history is partial/);
  assert.match(source,/current records can synchronize even when historical revision snapshots are bounded/i);
});
