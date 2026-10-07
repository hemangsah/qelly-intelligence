import test from 'node:test';
import assert from 'node:assert/strict';
import {collectPublicCalculatorInputs} from '../apps/web/public/assets/calculation/public-calculator-inputs.mjs';
import {calculateFormula,getFormulaDefinition} from '../apps/web/public/assets/calculation/formula-engine-extended.mjs';
const definition=getFormulaDefinition('kelly-criterion');
const collect=values=>collectPublicCalculatorInputs(definition.inputSchema,key=>({value:values[key]??'',validity:{badInput:false}}));

test('missing required probability is rejected while explicit zero remains a real input',()=>{
  for(const value of ['', '  '])assert.throws(()=>collect({...definition.referenceVector.inputs,winProbability:value}),/required/);
  const inputs=collect({...definition.referenceVector.inputs,winProbability:0});
  assert.equal(inputs.winProbability,0);
  const receipt=calculateFormula('kelly-criterion',inputs);assert.equal(receipt.status,'success');
  assert.ok(Math.abs(receipt.outputs.fullKelly+1/1.8)<1e-12);
});
test('blank optional fraction and cap preserve registered defaults instead of supplying zero',()=>{
  const inputs=collect({...definition.referenceVector.inputs,fraction:'',maximumRiskPercent:''});
  assert.equal(Object.hasOwn(inputs,'fraction'),false);assert.equal(Object.hasOwn(inputs,'maximumRiskPercent'),false);
  const receipt=calculateFormula('kelly-criterion',inputs);assert.equal(receipt.status,'success');
  assert.ok(Math.abs(receipt.outputs.fractionalKelly-0.15)<1e-12);assert.equal(receipt.outputs.maximumRiskCap,0.25);
});
test('non-finite and browser-invalid numeric inputs cannot produce calculation receipts',()=>{
  for(const value of ['NaN','Infinity','1e999','abc'])assert.throws(()=>collect({...definition.referenceVector.inputs,winProbability:value}),/finite number/);
  assert.throws(()=>collectPublicCalculatorInputs(definition.inputSchema,()=>({value:'',validity:{badInput:true}})),/valid number/);
});
