import test from 'node:test';
import assert from 'node:assert/strict';

class LocalStorageMock{
  constructor(){this.map=new Map();}
  getItem(key){return this.map.has(key)?this.map.get(key):null;}
  setItem(key,value){this.map.set(key,String(value));}
  removeItem(key){this.map.delete(key);}
  clear(){this.map.clear();}
}
globalThis.localStorage=new LocalStorageMock();
assert.equal(typeof globalThis.crypto?.randomUUID,'function','Node runtime must expose Web Crypto randomUUID');
const persistence=await import('../apps/web/public/assets/calculation/persistence.mjs');
const result=value=>({formulaId:'fresh-present-value',formulaVersion:'2.0.0',effectiveDate:'2026-07-30',outputs:{value},evidence:{provenanceStatus:'FRESH_REIMPLEMENTATION_2026'}});

test('browser lifecycle supports save reopen update duplicate revisions restore and delete',()=>{
  persistence.clearSavedCalculations();
  const saved=persistence.saveCalculation({name:'PV base',result:result(100),notes:'initial',tags:['fresh','valuation'],favorite:true});
  assert.equal(saved.version,1);assert.equal(persistence.getSavedCalculation(saved.id).result.outputs.value,100);
  const updated=persistence.updateSavedCalculation(saved.id,{name:'PV revised',result:result(105),notes:'updated',tags:['reviewed'],favorite:false});
  assert.equal(updated.version,2);assert.equal(updated.revisions.length,2);
  const duplicate=persistence.duplicateSavedCalculation(saved.id,{name:'PV scenario'});assert.notEqual(duplicate.id,saved.id);assert.equal(duplicate.version,1);
  const revisions=persistence.listSavedCalculationRevisions(saved.id);assert.deepEqual(revisions.map(x=>x.version),[2,1]);
  const restored=persistence.restoreSavedCalculationRevision(saved.id,revisions.find(x=>x.version===1).revisionId);assert.equal(restored.version,3);assert.equal(restored.name,'PV base');assert.equal(restored.result.outputs.value,100);
  persistence.removeSavedCalculation(duplicate.id);assert.equal(persistence.listSavedCalculations().length,1);
});

test('browser saved search filters sorting and migration are deterministic',()=>{
  persistence.clearSavedCalculations();
  const alpha=persistence.saveCalculation({name:'Alpha',result:result(1),notes:'valuation',tags:['alpha'],favorite:true});
  persistence.saveCalculation({name:'Beta',result:result(2),notes:'scenario',tags:['beta'],favorite:false});
  assert.equal(persistence.listSavedCalculations({query:'valuation'})[0].id,alpha.id);
  assert.equal(persistence.listSavedCalculations({tag:'alpha'})[0].id,alpha.id);
  assert.equal(persistence.listSavedCalculations({favorite:true})[0].id,alpha.id);
  assert.deepEqual(persistence.listSavedCalculations({sort:'name-asc'}).map(x=>x.name),['Alpha','Beta']);
  const migrated=persistence.migrate({schemaVersion:1,items:[{id:'legacy',name:'Legacy',savedAt:'2026-01-01T00:00:00.000Z',formulaVersion:'1.0.0',result:{formulaId:'cagr',formulaVersion:'1.0.0',outputs:{value:5}},notes:''}]});
  assert.equal(migrated.schemaVersion,2);assert.equal(migrated.items[0].revisions.length,1);assert.equal(migrated.items[0].formulaVersion,'1.0.0');
});

test('browser import rejects malformed oversized unsafe and non-finite payloads',()=>{
  persistence.clearSavedCalculations();
  assert.throws(()=>persistence.importSavedCalculations('{bad'),error=>error.code==='saved_import_invalid_json');
  assert.throws(()=>persistence.importSavedCalculations('x'.repeat(1_000_001)),error=>error.code==='saved_import_too_large');
  assert.throws(()=>persistence.importSavedCalculations('{"schemaVersion":2,"items":[{"__proto__":{"polluted":true}}]}'),error=>error.code==='saved_unsafe_key');
  assert.equal({}.polluted,undefined);
  assert.throws(()=>persistence.saveCalculation({name:'bad',result:{formulaId:'x',outputs:{value:Infinity}}}),error=>error.code==='saved_non_finite');
});

test('JSON/CSV/share exports are stable and CSV formula injection is neutralized',()=>{
  persistence.clearSavedCalculations();
  const saved=persistence.saveCalculation({name:'=IMPORTXML()',result:result(1),notes:'@danger',tags:['+tag']});
  const exported=persistence.exportSavedCalculations();assert.equal(JSON.parse(exported).schemaVersion,2);
  const csv=persistence.exportSavedCalculationsCsv();assert.match(csv,/"'=IMPORTXML\(\)"/);assert.match(csv,/"'\+tag"/);assert.match(csv,/"'@danger"/);
  const encoded=persistence.encodeShareState(saved);const decoded=persistence.decodeShareState(encoded);assert.equal(decoded.id,saved.id);
  const imported=persistence.importSavedCalculations(exported);assert.equal(imported.imported,1);assert.equal(persistence.listSavedCalculations().length,1);
});
