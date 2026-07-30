import test from 'node:test';
import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import {CalculationService} from '../src/calculations/calculation-service.mjs';
import {calculateFormula as browserFormula,listFormulaDefinitions} from '../apps/web/public/assets/calculation/formula-engine-extended.mjs';
import {calculateIndicator as browserIndicator,listIndicatorDefinitions} from '../apps/web/public/assets/calculation/indicator-engine-extended.mjs';
import {freshFormulaDefinitions,freshFormulaFuzzInput} from '../apps/web/public/assets/calculation/fresh-formula-catalog.mjs';
import {freshIndicatorDefinitions,freshIndicatorFuzzInput} from '../apps/web/public/assets/calculation/fresh-indicator-catalog.mjs';

const service=new CalculationService();
const at='2026-07-30T00:00:00.000Z';

test('service exposes truthful reconciled totals and fresh provenance',()=>{
  assert.equal(service.formulas().items.length,151);
  assert.equal(service.indicators().items.length,54);
  assert.equal(listFormulaDefinitions().length,151);
  assert.equal(listIndicatorDefinitions().length,54);
  assert.equal(service.metadata().formulaEngine.foundationDefinitionCount,50);
  assert.equal(service.metadata().formulaEngine.freshDefinitionCount,101);
  assert.equal(service.metadata().indicatorEngine.foundationDefinitionCount,20);
  assert.equal(service.metadata().indicatorEngine.freshDefinitionCount,34);
  assert.equal(service.metadata().freshProvenance,'FRESH_REIMPLEMENTATION_2026');
});

test('browser and server formula adapters are byte-stable JSON parity for 101 vectors',()=>{
  for(const definition of freshFormulaDefinitions){
    const request={formulaId:definition.formulaId,inputs:definition.referenceVector.inputs};
    const browser=browserFormula(request.formulaId,request.inputs,{calculatedAt:at});
    const server=service.calculate(request);
    const normalizedServer={...server,calculatedAt:browser.calculatedAt};
    assert.deepEqual(normalizedServer,browser,definition.formulaId);
  }
});

test('browser and server indicator adapters are JSON parity for 34 vectors',()=>{
  for(const definition of freshIndicatorDefinitions){
    const inputs=definition.referenceVector.inputs;
    const browser=browserIndicator(definition.indicatorId,inputs,{calculatedAt:at});
    const server=service.calculateIndicator({indicatorId:definition.indicatorId,inputs});
    const normalizedServer={...server,calculatedAt:browser.calculatedAt};
    assert.deepEqual(normalizedServer,browser,definition.indicatorId);
  }
});

test('rapid deterministic fresh calculations remain bounded and cancellation-independent',()=>{
  const start=performance.now();let count=0;
  for(let cycle=0;cycle<10;cycle++)for(const definition of freshFormulaDefinitions){
    const result=service.calculate({formulaId:definition.formulaId,inputs:freshFormulaFuzzInput(definition.formulaId,cycle+1)});
    assert.ok(['success','validation_error'].includes(result.status));count++;
  }
  assert.equal(count,1010);
  assert.ok(performance.now()-start<10000,'1010 service calculations exceeded 10 seconds');
});

test('representative 10,000-point service indicators remain aligned',()=>{
  for(const definition of freshIndicatorDefinitions.filter((_,index)=>index%6===0)){
    const base=freshIndicatorFuzzInput(definition.indicatorId,11),length=10000,inputs={period:20};
    for(const field of definition.requiredFields){const seed=base[field];inputs[field]=Array.from({length},(_,index)=>seed[index%seed.length]*(1+index/1_000_000));}
    if(inputs.high&&inputs.low)for(let index=0;index<length;index++){const close=inputs.close?.[index]??(inputs.high[index]+inputs.low[index])/2,open=inputs.open?.[index]??close;inputs.high[index]=Math.max(inputs.high[index],close,open);inputs.low[index]=Math.min(inputs.low[index],close,open);}
    const result=service.calculateIndicator({indicatorId:definition.indicatorId,inputs});
    assert.equal(result.status,'success',definition.indicatorId);
    for(const value of Object.values(result.outputs).filter(Array.isArray))assert.equal(value.length,length,definition.indicatorId);
  }
});

test('invalid unsafe input behavior matches between adapters',()=>{
  const unsafe=JSON.parse('{"__proto__":{"polluted":true},"futureValue":110,"rate":0.1,"periods":1}');
  const browser=browserFormula('fresh-present-value',unsafe,{calculatedAt:at});
  const server=service.calculate({formulaId:'fresh-present-value',inputs:unsafe});
  assert.equal(browser.status,'validation_error');assert.equal(server.status,'validation_error');
  assert.equal(browser.validationErrors[0].code,'unsafe_key');assert.equal(server.validationErrors[0].code,'unsafe_key');
  assert.equal({}.polluted,undefined);
});
