import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { SavedCalculationStore } from '../src/calculations/calculation-service.mjs';

test('saved calculation store enforces user, tenant and workspace isolation',async()=>{
  const dir=await mkdtemp(path.join(os.tmpdir(),'qelly-calc-store-'));
  try{
    const store=new SavedCalculationStore({filePath:path.join(dir,'saved.json'),auditLedger:null});
    const a={userId:'u1',tenantId:'t1',workspaceId:'w1'};
    const b={userId:'u2',tenantId:'t1',workspaceId:'w1'};
    const saved=await store.save({...a,name:'CAGR',result:{formulaId:'cagr',formulaVersion:'1.0.0',inputs:{},outputs:{cagrPercent:10}},correlationId:'test'});
    assert.equal((await store.list(a)).length,1);
    assert.equal((await store.list(b)).length,0);
    await assert.rejects(()=>store.remove({...b,id:saved.id,correlationId:'test'}),error=>error.code==='saved_calculation_not_found');
    assert.equal((await store.list(a)).length,1);
    await store.remove({...a,id:saved.id,correlationId:'test'});
    assert.equal((await store.list(a)).length,0);
  }finally{await rm(dir,{recursive:true,force:true});}
});
