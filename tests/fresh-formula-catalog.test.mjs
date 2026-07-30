import test from 'node:test';
import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import {calculateFormula,listFormulaDefinitions,formulaEngineMetadata} from '../apps/web/public/assets/calculation/formula-engine-extended.mjs';
import {freshFormulaDefinitions,calculateFreshFormula,freshFormulaFuzzInput} from '../apps/web/public/assets/calculation/fresh-formula-catalog.mjs';
import {listFormulaDefinitions as listFoundationFormulaDefinitions} from '../apps/web/public/assets/calculation/formula-engine.mjs';

const at='2026-07-30T00:00:00.000Z';
const close=(actual,expected,tolerance=1e-6)=>assert.ok(Math.abs(actual-expected)<=tolerance*Math.max(1,Math.abs(expected)),`${actual} != ${expected}`);

test('fresh formula catalog has exactly 101 unique non-colliding governed IDs',()=>{
  const foundation=listFoundationFormulaDefinitions().map(x=>x.formulaId);
  const fresh=freshFormulaDefinitions.map(x=>x.formulaId);
  assert.equal(foundation.length,50);
  assert.equal(fresh.length,101);
  assert.equal(new Set(fresh).size,101);
  assert.equal(fresh.filter(id=>foundation.includes(id)).length,0);
  assert.ok(fresh.every(id=>id.startsWith('fresh-')));
  assert.ok(freshFormulaDefinitions.every(x=>x.provenanceStatus==='FRESH_REIMPLEMENTATION_2026'&&x.aliases.length===0));
  assert.equal(listFormulaDefinitions().length,151);
  assert.equal(formulaEngineMetadata.foundationDefinitionCount,50);
  assert.equal(formulaEngineMetadata.freshDefinitionCount,101);
});

test('101 primary reference vectors and deterministic JSON repeats pass',()=>{
  for(const definition of freshFormulaDefinitions){
    const first=calculateFreshFormula(definition.formulaId,definition.referenceVector.inputs,{calculatedAt:at});
    const second=calculateFreshFormula(definition.formulaId,definition.referenceVector.inputs,{calculatedAt:at});
    assert.equal(first.status,'success',definition.formulaId);
    close(first.outputs.value,definition.referenceVector.expected);
    assert.deepEqual(second,first,definition.formulaId);
    assert.doesNotThrow(()=>JSON.stringify(first));
    assert.equal(first.truthState,'FRESH_REIMPLEMENTATION_2026');
  }
});

test('at least 1,000 formula fuzz cases remain bounded and serializable',()=>{
  let cases=0;
  const started=performance.now();
  for(const definition of freshFormulaDefinitions){
    for(let seed=1;seed<=11;seed++){
      const result=calculateFormula(definition.formulaId,freshFormulaFuzzInput(definition.formulaId,seed),{calculatedAt:at});
      assert.ok(['success','validation_error'].includes(result.status),`${definition.formulaId}:${seed}`);
      if(result.status==='success')assert.ok(Number.isFinite(result.outputs.value),`${definition.formulaId}:${seed}`);
      assert.doesNotThrow(()=>JSON.stringify(result));
      cases++;
    }
  }
  assert.equal(cases,1111);
  assert.ok(performance.now()-started<10000,'fresh formula fuzz gate exceeded 10 seconds');
});

test('fresh formula security and invalid-input behavior is explicit',()=>{
  const unsafe=JSON.parse('{"__proto__":{"polluted":true},"futureValue":110,"rate":0.1,"periods":1}');
  const result=calculateFreshFormula('fresh-present-value',unsafe,{calculatedAt:at});
  assert.equal(result.status,'validation_error');
  assert.equal(result.validationErrors[0].code,'unsafe_key');
  assert.equal({}.polluted,undefined);
  assert.equal(calculateFreshFormula('fresh-growing-perpetuity-present-value',{payment:10,discountRate:.03,growthRate:.04},{calculatedAt:at}).status,'validation_error');
  assert.equal(calculateFreshFormula('fresh-min-max-normalize',{value:1,minimum:2,maximum:2},{calculatedAt:at}).status,'validation_error');
});

test('fresh formula algebraic properties hold',()=>{
  const future=calculateFormula('fresh-future-value',{presentValue:250,rate:.07,periods:5},{calculatedAt:at}).outputs.value;
  const present=calculateFormula('fresh-present-value',{futureValue:future,rate:.07,periods:5},{calculatedAt:at}).outputs.value;
  close(present,250,1e-9);
  const effective=calculateFormula('fresh-effective-annual-rate',{nominalRate:.12,compounds:12},{calculatedAt:at}).outputs.value;
  const nominal=calculateFormula('fresh-nominal-rate-from-effective',{effectiveRate:effective,compounds:12},{calculatedAt:at}).outputs.value;
  close(nominal,.12,1e-9);
  close(calculateFormula('fresh-gross-exposure',{positions:[10,-5,2]},{calculatedAt:at}).outputs.value,17);
  close(calculateFormula('fresh-net-exposure',{positions:[10,-5,2]},{calculatedAt:at}).outputs.value,7);
});
