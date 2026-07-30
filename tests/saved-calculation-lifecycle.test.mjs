import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,writeFile} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {SavedCalculationStore} from '../src/calculations/calculation-service.mjs';

const scope={userId:'u1',tenantId:'t1',workspaceId:'w1'};
const otherUser={userId:'u2',tenantId:'t1',workspaceId:'w1'};
const otherTenant={userId:'u1',tenantId:'t2',workspaceId:'w1'};
const otherWorkspace={userId:'u1',tenantId:'t1',workspaceId:'w2'};
const result=(value=100)=>({formulaId:'fresh-present-value',formulaVersion:'2.0.0',effectiveDate:'2026-07-30',inputs:{futureValue:110,rate:.1,periods:1},outputs:{value},evidence:{provenanceStatus:'FRESH_REIMPLEMENTATION_2026',indiaRuleVersion:null}});

const fixture=async fn=>{const dir=await mkdtemp(path.join(os.tmpdir(),'qelly-saved-lifecycle-'));const events=[];const store=new SavedCalculationStore({filePath:path.join(dir,'saved.json'),auditLedger:{append:async event=>events.push(event)}});try{await fn({store,events,filePath:path.join(dir,'saved.json')});}finally{await rm(dir,{recursive:true,force:true});}};

test('saved lifecycle supports reopen rename update duplicate revisions and restore',()=>fixture(async({store,events})=>{
  const saved=await store.save({...scope,name:'PV base',result:result(100),notes:'initial',tags:['valuation','fresh'],favorite:true,correlationId:'save'});
  assert.equal(saved.version,1);assert.equal(saved.revisions.length,1);assert.equal(saved.formulaVersion,'2.0.0');
  const reopened=await store.get({...scope,id:saved.id});assert.equal(reopened.name,'PV base');assert.equal(reopened.result.outputs.value,100);
  const updated=await store.update({...scope,id:saved.id,name:'PV revised',result:result(105),notes:'updated',tags:['valuation','reviewed'],favorite:false,correlationId:'update'});
  assert.equal(updated.version,2);assert.equal(updated.revisions.length,2);assert.equal(updated.name,'PV revised');assert.equal(updated.result.outputs.value,105);
  const duplicate=await store.duplicate({...scope,id:saved.id,name:'PV scenario',correlationId:'duplicate'});
  assert.notEqual(duplicate.id,saved.id);assert.equal(duplicate.name,'PV scenario');assert.equal(duplicate.version,1);assert.equal(duplicate.favorite,false);
  const revisions=await store.revisions({...scope,id:saved.id});assert.equal(revisions.items.length,2);assert.deepEqual(revisions.items.map(x=>x.version),[2,1]);
  const restored=await store.restore({...scope,id:saved.id,revisionId:revisions.items.find(x=>x.version===1).revisionId,correlationId:'restore'});
  assert.equal(restored.version,3);assert.equal(restored.name,'PV base');assert.equal(restored.result.outputs.value,100);assert.equal(restored.revisions.at(-1).restoredFrom,revisions.items.find(x=>x.version===1).revisionId);
  assert.deepEqual(events.map(x=>x.eventType),['calculation.saved.v2','calculation.updated.v2','calculation.saved.v2','calculation.revision.restored.v2']);
}));

test('saved list supports search tags favorites and deterministic sorting',()=>fixture(async({store})=>{
  const first=await store.save({...scope,name:'Alpha PV',result:result(100),notes:'valuation note',tags:['alpha','valuation'],favorite:true,correlationId:'a'});
  await store.save({...scope,name:'Beta PV',result:result(101),notes:'scenario',tags:['beta'],favorite:false,correlationId:'b'});
  assert.equal((await store.list({...scope,query:'valuation'})).length,1);
  assert.equal((await store.list({...scope,tag:'alpha'}))[0].id,first.id);
  assert.equal((await store.list({...scope,favorite:true}))[0].id,first.id);
  assert.deepEqual((await store.list({...scope,sort:'name-asc'})).map(x=>x.name),['Alpha PV','Beta PV']);
}));

test('wrong user tenant and workspace cannot read mutate duplicate restore or delete',()=>fixture(async({store})=>{
  const saved=await store.save({...scope,name:'Scoped',result:result(),correlationId:'save'});
  for(const wrong of [otherUser,otherTenant,otherWorkspace]){
    assert.equal((await store.list(wrong)).length,0);
    await assert.rejects(()=>store.get({...wrong,id:saved.id}),error=>error.code==='saved_calculation_not_found');
    await assert.rejects(()=>store.update({...wrong,id:saved.id,name:'attack',correlationId:'x'}),error=>error.code==='saved_calculation_not_found');
    await assert.rejects(()=>store.duplicate({...wrong,id:saved.id,correlationId:'x'}),error=>error.code==='saved_calculation_not_found');
    await assert.rejects(()=>store.revisions({...wrong,id:saved.id}),error=>error.code==='saved_calculation_not_found');
    await assert.rejects(()=>store.restore({...wrong,id:saved.id,revisionId:'x',correlationId:'x'}),error=>error.code==='saved_calculation_not_found');
    await assert.rejects(()=>store.remove({...wrong,id:saved.id,correlationId:'x'}),error=>error.code==='saved_calculation_not_found');
  }
  assert.equal((await store.list(scope)).length,1);
}));

test('legacy schema migrates non-destructively and preserves formula version',()=>fixture(async({store,filePath})=>{
  await writeFile(filePath,JSON.stringify({schemaVersion:1,items:[{id:'legacy',...scope,name:'Legacy',savedAt:'2026-01-01T00:00:00.000Z',updatedAt:'2026-01-01T00:00:00.000Z',schemaVersion:1,formulaVersion:'1.0.0',indicatorVersion:null,effectiveDate:'2026-01-01',result:{formulaId:'cagr',formulaVersion:'1.0.0',outputs:{value:5}},notes:'legacy'}]},null,2));
  const item=await store.get({...scope,id:'legacy'});
  assert.equal(item.schemaVersion,2);assert.equal(item.version,1);assert.equal(item.formulaVersion,'1.0.0');assert.equal(item.revisions.length,1);assert.equal(item.revisions[0].revisionId,'migrated-legacy');
}));

test('unsafe keys are rejected and missing revisions return structured errors',()=>fixture(async({store})=>{
  const unsafe=JSON.parse('{"formulaId":"fresh-present-value","outputs":{"value":1},"__proto__":{"polluted":true}}');
  await assert.rejects(()=>store.save({...scope,name:'Unsafe',result:unsafe,correlationId:'unsafe'}),error=>error.code==='calculation_unsafe_key');
  assert.equal({}.polluted,undefined);
  const saved=await store.save({...scope,name:'Safe',result:result(),correlationId:'save'});
  await assert.rejects(()=>store.restore({...scope,id:saved.id,revisionId:'missing',correlationId:'restore'}),error=>error.code==='saved_calculation_revision_not_found');
}));
