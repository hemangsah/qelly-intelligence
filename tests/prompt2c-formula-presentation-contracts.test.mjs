import test from 'node:test';
import assert from 'node:assert/strict';
import {listFormulaDefinitions,getFormulaDefinition,calculateFormula,formulaEngineMetadata} from '../apps/web/public/assets/calculation/formula-engine-extended.mjs';

const canonical=(value)=>JSON.parse(JSON.stringify(value));

test('all 151 formulas expose structured presentation contracts',()=>{
  const definitions=listFormulaDefinitions();
  assert.equal(definitions.length,151);
  assert.equal(formulaEngineMetadata.definitionCount,151);
  for(const definition of definitions){
    assert.equal(definition.presentationContractVersion,'1.0.0',definition.formulaId);
    assert.equal(definition.inputSchema?.type,'object',definition.formulaId);
    assert.ok(Object.keys(definition.inputSchema?.properties??{}).length>0,definition.formulaId);
    assert.ok(definition.referenceVector?.inputs&&Object.keys(definition.referenceVector.inputs).length>0,definition.formulaId);
  }
});

test('position-size structured and JSON representations produce identical outputs',()=>{
  const definition=getFormulaDefinition('position-size');
  const structured=canonical(definition.referenceVector.inputs);
  const json=JSON.parse(JSON.stringify(structured));
  const a=calculateFormula('position-size',structured,{calculatedAt:'2026-08-02T00:00:00.000Z'});
  const b=calculateFormula('position-size',json,{calculatedAt:'2026-08-02T00:00:00.000Z'});
  assert.equal(a.status,'success');
  assert.deepEqual(a.outputs,b.outputs);
  assert.deepEqual(a.normalizedInputs,b.normalizedInputs);
});

test('fresh formula native schemas remain authoritative',()=>{
  const definition=listFormulaDefinitions().find((item)=>item.version!=='1.0.0'&&item.inputSchema?.properties);
  assert.ok(definition,'at least one fresh formula definition is available');
  const fetched=getFormulaDefinition(definition.formulaId);
  assert.deepEqual(Object.keys(fetched.inputSchema.properties),Object.keys(definition.inputSchema.properties));
});
