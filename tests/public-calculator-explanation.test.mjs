import test from 'node:test';
import assert from 'node:assert/strict';
import {calculateFormula,getFormulaDefinition} from '../apps/web/public/assets/calculation/formula-engine-extended.mjs';
import {PUBLIC_CALCULATORS} from '../scripts/generate-public-calculator-network.mjs';
import {publicCalculatorExplanationDraft,MAX_PUBLIC_CALCULATOR_DRAFT} from '../apps/web/public/assets/calculation/public-calculator-explanation.mjs';
const inputs={winProbability:55,averageWin:1.8,averageLoss:1,fraction:.5,maximumRiskPercent:25};
const receipt=()=>calculateFormula('kelly-criterion',inputs);
test('public explanation uses a verified versioned receipt and excludes unrelated fields',()=>{
  const current=receipt();current.normalizedInputs.unrelatedCredential='synthetic-must-not-copy';current.unrelatedPrivateFile='synthetic-file-must-not-copy';
  const draft=publicCalculatorExplanationDraft(current),snapshot=JSON.parse(draft.slice(draft.indexOf('\n')+1));
  assert.equal(snapshot.formulaId,'kelly-criterion');assert.equal(snapshot.formulaVersion,'1.0.0');assert.deepEqual(snapshot.inputs,inputs);assert.equal(snapshot.outputs.fractionalKelly,.15);assert.ok(snapshot.warnings.length>0);assert.match(draft,/not market observations/);assert.doesNotMatch(draft,/synthetic-must-not-copy|synthetic-file-must-not-copy/);assert.ok(draft.length<=MAX_PUBLIC_CALCULATOR_DRAFT);
});
test('invalid, tampered or mismatched-version receipts cannot prepare a draft',()=>{
  assert.throws(()=>publicCalculatorExplanationDraft({status:'error'}),/valid inputs/);
  assert.throws(()=>publicCalculatorExplanationDraft({...receipt(),formulaVersion:'unexpected'}),/receipt changed/);
  const current=receipt();current.outputs.fractionalKelly=99;assert.throws(()=>publicCalculatorExplanationDraft(current),/receipt changed/);
});
test('explicit zero is preserved in the receipt draft',()=>{
  const current=calculateFormula('kelly-criterion',{...inputs,winProbability:0}),draft=publicCalculatorExplanationDraft(current),snapshot=JSON.parse(draft.slice(draft.indexOf('\n')+1));assert.equal(snapshot.inputs.winProbability,0);assert.ok(Math.abs(snapshot.outputs.fullKelly+1/1.8)<1e-12);assert.equal(snapshot.outputs.fractionalKelly,0);
});
test('nested objects without a registered property schema cannot leak unrelated fields',()=>{
  const current=calculateFormula('xirr',{cashflows:[{date:'2025-01-01',amount:-1000,unrelatedCredential:'synthetic-private-nested'},{date:'2026-01-01',amount:1100}]});assert.equal(current.status,'success');assert.throws(()=>publicCalculatorExplanationDraft(current),/input structure/);
});
test('large valid series are rejected rather than silently truncated into an incomplete draft',()=>{
  const current=calculateFormula('maximum-drawdown',{values:Array.from({length:1000},(_,i)=>100+i*.012345)});assert.equal(current.status,'success');assert.throws(()=>publicCalculatorExplanationDraft(current),/too large/);
});
test('all public examples preserve faithful receipts or reject a complete oversized schedule',()=>{
  for(const calculator of PUBLIC_CALCULATORS){const definition=getFormulaDefinition(calculator.formulaId),current=calculateFormula(calculator.formulaId,definition.referenceVector.inputs);assert.equal(current.status,'success',calculator.formulaId);if(calculator.formulaId==='swp-schedule'){assert.ok(JSON.stringify(current.outputs).length>MAX_PUBLIC_CALCULATOR_DRAFT);assert.throws(()=>publicCalculatorExplanationDraft(current),/too large/);continue;}const draft=publicCalculatorExplanationDraft(current),snapshot=JSON.parse(draft.slice(draft.indexOf('\n')+1));assert.equal(snapshot.formulaId,calculator.formulaId);assert.deepEqual(snapshot.outputs,current.outputs);assert.ok(draft.length<=MAX_PUBLIC_CALCULATOR_DRAFT);}
});
