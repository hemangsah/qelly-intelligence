import test from 'node:test';
import assert from 'node:assert/strict';
import {getFormulaDefinition,calculateFormula} from '../apps/web/public/assets/calculation/formula-engine-extended.mjs';
import {inputContractFor} from '../apps/web/public/assets/calculation/formula-input-contracts.mjs';

const accepts=(schema,value)=>(schema.minimum==null||value>=schema.minimum)&&(schema.maximum==null||value<=schema.maximum);
test('structured loss scenarios match independent monthly cash-flow and compounding identities',()=>{
  const sip=getFormulaDefinition('sip-future-value');
  assert.ok(accepts(sip.inputSchema.properties.annualReturnPercent,-12));
  const result=calculateFormula(sip.formulaId,{monthlyContribution:1000,annualReturnPercent:-12,years:1,timing:'end'});
  const expected=Array.from({length:12},(_,month)=>1000*0.99**month).reduce((a,b)=>a+b,0);
  assert.equal(result.status,'success');
  assert.ok(Math.abs(result.outputs.futureValue-expected)<1e-8);
  const compound=getFormulaDefinition('compound-interest');
  assert.ok(accepts(compound.inputSchema.properties.annualRatePercent,-10));
  assert.equal(calculateFormula(compound.formulaId,{principal:1000,annualRatePercent:-10,years:2,compoundsPerYear:1}).outputs.futureValue,810);
});
test('economic rates and volatility are not treated as bounded probabilities',()=>{
  for(const [id,key,value] of [['bond-price','yieldPercent',-1],['black-scholes','riskFreeRatePercent',-2],['black-scholes','volatilityPercent',150],['step-up-sip','annualStepUpPercent',-5],['goal-planner','inflationPercent',-1],['apr-to-apy','aprPercent',-2]]){
    const d=getFormulaDefinition(id);assert.ok(accepts(d.inputSchema.properties[key],value),`${id}:${key}`);
    assert.equal(calculateFormula(id,{...d.referenceVector.inputs,[key]:value}).status,'success',`${id}:${key}`);
  }
});
test('probability, confidence and negative loan-rate failures retain their domain guards',()=>{
  const kelly=getFormulaDefinition('kelly-criterion');
  for(const value of [-1,101]){
    assert.equal(accepts(kelly.inputSchema.properties.winProbability,value),false);
    assert.equal(calculateFormula(kelly.formulaId,{...kelly.referenceVector.inputs,winProbability:value}).status,'validation_error');
  }
  const tail=getFormulaDefinition('historical-var');
  assert.equal(accepts(tail.inputSchema.properties.confidencePercent,100),false);
  assert.equal(calculateFormula(tail.formulaId,{...tail.referenceVector.inputs,confidencePercent:100}).status,'validation_error');
  const loan=getFormulaDefinition('loan-emi');
  assert.equal(accepts(loan.inputSchema.properties.annualRatePercent,-1),false);
  assert.equal(calculateFormula(loan.formulaId,{...loan.referenceVector.inputs,annualRatePercent:-1}).status,'validation_error');
});
test('FX conversion and relative price inputs expose ratios while native schemas remain authoritative',()=>{
  const fx=getFormulaDefinition('fx-pip-value');
  assert.equal(fx.inputSchema.properties.quoteToAccountRate.unit,'ratio');
  assert.equal(calculateFormula(fx.formulaId,{units:100000,pipSize:0.0001,quoteToAccountRate:1.25}).outputs.pipValue,12.5);
  assert.equal(getFormulaDefinition('impermanent-loss').inputSchema.properties.priceRatio.unit,'ratio');
  const native={type:'object',properties:{annualReturnPercent:{type:'number',minimum:7,maximum:9,unit:'native'}}};
  assert.equal(inputContractFor({formulaId:'sip-future-value',inputSchema:native}).schema,native);
});
