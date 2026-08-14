import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { SavedCalculationStore } from '../src/calculations/calculation-service.mjs';

const scope={userId:'user-a',tenantId:'tenant-a',workspaceId:'workspace-a'};
const result=index=>({formulaId:'position-sizing',formulaVersion:'test-v1',effectiveDate:'2026-08-13',value:index});

test('concurrent saved-calculation writes are serialized without lost records and use atomic replacement',async()=>{
  const directory=await mkdtemp(path.join(os.tmpdir(),'qelly-saved-calculation-concurrency-'));
  const filePath=path.join(directory,'saved-calculations.json');
  try{
    const stores=[new SavedCalculationStore({filePath}),new SavedCalculationStore({filePath}),new SavedCalculationStore({filePath})];
    await Promise.all(Array.from({length:24},(_,index)=>stores[index%stores.length].save({...scope,name:`calc-${index}`,result:result(index)})));
    const items=await stores[0].list(scope);
    assert.equal(items.length,24,'every concurrent save must survive the shared read-modify-write transaction');
    assert.equal(new Set(items.map(item=>item.name)).size,24,'concurrent saves must not overwrite sibling records');
    assert.deepEqual((await readdir(directory)).sort(),['saved-calculations.json'],'atomic writes must not leave lock or temporary files behind');
  }finally{
    await rm(directory,{recursive:true,force:true});
  }
});

test('concurrent updates preserve every revision/version increment',async()=>{
  const directory=await mkdtemp(path.join(os.tmpdir(),'qelly-saved-calculation-updates-'));
  const filePath=path.join(directory,'saved-calculations.json');
  try{
    const first=new SavedCalculationStore({filePath});
    const second=new SavedCalculationStore({filePath});
    const saved=await first.save({...scope,name:'base',result:result(0)});
    const updates=20;
    await Promise.all(Array.from({length:updates},(_,index)=>(index%2?first:second).update({...scope,id:saved.id,notes:`update-${index}`})));
    const detail=await first.get({...scope,id:saved.id});
    assert.equal(detail.version,1+updates,'each concurrent update must observe the prior committed version');
    assert.equal(detail.revisionCount,1+updates,'each concurrent update must retain its revision');
    assert.equal(detail.revisions.at(-1)?.version,1+updates);
  }finally{
    await rm(directory,{recursive:true,force:true});
  }
});
