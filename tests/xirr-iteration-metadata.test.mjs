import test from 'node:test';
import assert from 'node:assert/strict';
import {calculateFormula as calculateFoundationFormula} from '../apps/web/public/assets/calculation/formula-engine.mjs';
import {calculateFormula as calculateExtendedFormula} from '../apps/web/public/assets/calculation/formula-engine-extended.mjs';

test('XIRR reports the actual bounded-bisection convergence count without changing the numerical result',()=>{
  const inputs={cashflows:[
    {amount:-100,date:'2025-01-01'},
    {amount:110,date:'2026-01-01'}
  ]};
  const foundation=calculateFoundationFormula('xirr',inputs,{calculatedAt:'2026-08-13T00:00:00.000Z'});
  const corrected=calculateExtendedFormula('xirr',inputs,{calculatedAt:'2026-08-13T00:00:00.000Z'});
  assert.equal(foundation.status,'success');
  assert.equal(corrected.status,'success');
  assert.equal(corrected.outputs.xirrPercent,foundation.outputs.xirrPercent,'metadata correction must not alter the computed XIRR');
  assert.equal(corrected.outputs.iterations,40,'reference vector converges on the 40th bounded-bisection iteration');
  assert.ok(corrected.outputs.iterations>=1&&corrected.outputs.iterations<=200);
  assert.equal(corrected.outputs.solver,'bounded-bisection');
});

test('XIRR validation failures remain fail-closed and do not fabricate iteration metadata',()=>{
  const result=calculateExtendedFormula('xirr',{cashflows:[
    {amount:-100,date:'2025-01-01'},
    {amount:-10,date:'2026-01-01'}
  ]});
  assert.equal(result.status,'validation_error');
  assert.equal(result.outputs,null);
  assert.equal(result.validationErrors[0].code,'cashflow_signs');
});
