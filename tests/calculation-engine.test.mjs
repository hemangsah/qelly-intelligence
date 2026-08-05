import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateFormula, calculateBatch, listFormulaDefinitions, formulaEngineMetadata } from '../apps/web/public/assets/calculation/formula-engine.mjs';

const close=(actual,expected,tolerance=1e-8)=>assert.ok(Math.abs(actual-expected)<=tolerance,`${actual} not within ${tolerance} of ${expected}`);

test('formula registry has stable unique executable IDs',()=>{
  const definitions=listFormulaDefinitions();
  assert.ok(definitions.length>=45);
  assert.equal(new Set(definitions.map(item=>item.formulaId)).size,definitions.length);
  assert.equal(formulaEngineMetadata.externalProviderRequired,false);
  for(const definition of definitions){const result=calculateFormula(definition.formulaId,{});assert.notEqual(result.status,'formula_unavailable');}
});

test('position size reference vector includes costs and executable rounding',()=>{
  const result=calculateFormula('position-size',{accountValue:100000,riskPercent:1,entry:250,stop:242,multiplier:1,estimatedFees:20,slippagePerUnit:0.05,quantityStep:1});
  assert.equal(result.status,'success');
  assert.equal(result.outputs.riskAmount,1000);
  assert.equal(result.outputs.units,121);
  assert.ok(result.outputs.totalRisk<=1000);
});

test('CAGR and annualized return reference vectors',()=>{
  const cagr=calculateFormula('cagr',{startValue:100,endValue:121,years:2});
  close(cagr.outputs.cagrPercent,10,1e-10);
  const annualized=calculateFormula('annualized-return',{startValue:100,endValue:110,days:365});
  close(annualized.outputs.annualizedReturnPercent,10,1e-10);
});

test('EMI amortization reaches zero and prepayment does not increase interest',()=>{
  const emi=calculateFormula('loan-emi',{principal:1000000,annualRatePercent:9,months:120});
  close(emi.outputs.emi,12667.577793,0.01);
  const schedule=calculateFormula('loan-amortization',{principal:1000000,annualRatePercent:9,months:120});
  assert.equal(schedule.outputs.schedule.length,120);
  close(schedule.outputs.schedule.at(-1).closingBalance,0,1e-8);
  const prepay=calculateFormula('loan-prepayment',{principal:1000000,annualRatePercent:9,months:120,prepaymentMonth:12,prepaymentAmount:100000});
  assert.ok(prepay.outputs.interestSaved>=0);
  assert.ok(prepay.outputs.monthsSaved>=0);
});

test('SIP contribution and growth invariants',()=>{
  const zero=calculateFormula('sip-future-value',{monthlyContribution:1000,annualReturnPercent:0,years:10});
  assert.equal(zero.outputs.futureValue,120000);
  const positive=calculateFormula('sip-future-value',{monthlyContribution:1000,annualReturnPercent:12,years:10});
  assert.ok(positive.outputs.futureValue>positive.outputs.totalContributions);
  const step=calculateFormula('step-up-sip',{monthlyContribution:1000,annualReturnPercent:10,years:5,annualStepUpPercent:10});
  assert.equal(step.outputs.schedule.length,5);
  assert.ok(step.outputs.totalContributions>60000);
});

test('Black-Scholes satisfies put-call parity and nonnegative values',()=>{
  const call=calculateFormula('black-scholes',{spot:100,strike:100,timeYears:1,riskFreeRatePercent:5,volatilityPercent:20,optionType:'call'});
  const put=calculateFormula('black-scholes',{spot:100,strike:100,timeYears:1,riskFreeRatePercent:5,volatilityPercent:20,optionType:'put'});
  assert.ok(call.outputs.price>=0&&put.outputs.price>=0);
  close(call.outputs.callPrice-put.outputs.putPrice,100-100*Math.exp(-0.05),2e-5);
  assert.equal(call.outputs.americanExerciseSupported,false);
});

test('portfolio volatility and inverse-volatility weights obey invariants',()=>{
  const result=calculateFormula('portfolio-volatility',{weights:[0.6,0.4],covarianceMatrix:[[0.04,0.01],[0.01,0.0225]]});
  assert.ok(result.outputs.portfolioVolatility>=0);
  const inverse=calculateFormula('inverse-volatility-weights',{volatilities:[0.2,0.1,0.15]});
  close(inverse.outputs.weights.reduce((a,b)=>a+b,0),1,2e-12);
});

test('risk metrics retain valid bounds',()=>{
  const correlation=calculateFormula('correlation',{seriesA:[1,2,3,4,5],seriesB:[2,4,6,8,10]});
  close(correlation.outputs.correlation,1,1e-12);
  const drawdown=calculateFormula('maximum-drawdown',{values:[100,120,90,95,130]});
  close(drawdown.outputs.maximumDrawdownPercent,25,1e-12);
  const valueAtRisk=calculateFormula('historical-var',{returnsPercent:[-5,-2,-1,0,1,2,3,4,5,6],confidencePercent:95});
  assert.ok(valueAtRisk.outputs.valueAtRiskPercent>=0);
});

test('invalid input returns structured validation errors and never NaN',()=>{
  const result=calculateFormula('position-size',{accountValue:100000,riskPercent:1,entry:100,stop:100});
  assert.equal(result.status,'validation_error');
  assert.equal(result.outputs,null);
  assert.equal(result.validationErrors[0].code,'zero_risk_distance');
  assert.equal(JSON.stringify(result).includes('NaN'),false);
});

test('batch calculation is deterministic',()=>{
  const requests=[{formulaId:'cagr',inputs:{startValue:100,endValue:144,years:2}},{formulaId:'apr-to-apy',inputs:{aprPercent:12,compoundsPerYear:12}}];
  assert.deepEqual(calculateBatch(requests,{calculatedAt:'2026-07-29T00:00:00.000Z'}),calculateBatch(requests,{calculatedAt:'2026-07-29T00:00:00.000Z'}));
});
