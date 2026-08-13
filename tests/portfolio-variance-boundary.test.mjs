import test from 'node:test';
import assert from 'node:assert/strict';
import {calculateFormula as calculateFoundationFormula} from '../apps/web/public/assets/calculation/formula-engine.mjs';
import {calculateFormula,calculateBatch} from '../apps/web/public/assets/calculation/formula-engine-extended.mjs';

const invalidInputs={
  weights:[0.5,0.5],
  covarianceMatrix:[[1,-2],[-2,1]]
};

test('portfolio volatility fails closed when covariance inputs produce materially negative variance',()=>{
  const foundation=calculateFoundationFormula('portfolio-volatility',invalidInputs,{calculatedAt:'2026-08-13T00:00:00.000Z'});
  assert.equal(foundation.status,'success');
  assert.equal(foundation.outputs.portfolioVariance,-0.5);
  assert.equal(foundation.outputs.portfolioVolatility,0,'regression vector proves the old clamp masks negative variance as zero volatility');

  const corrected=calculateFormula('portfolio-volatility',invalidInputs,{calculatedAt:'2026-08-13T00:00:00.000Z'});
  assert.equal(corrected.status,'validation_error');
  assert.equal(corrected.outputs,null);
  assert.equal(corrected.confidence,'invalid');
  assert.deepEqual(corrected.validationErrors,[{
    code:'invalid_covariance_matrix',
    message:'covarianceMatrix produces a materially negative portfolio variance and cannot represent the requested portfolio risk consistently',
    field:'covarianceMatrix'
  }]);
});

test('valid portfolio covariance calculations remain numerically identical to the foundation engine',()=>{
  const inputs={weights:[0.6,0.4],covarianceMatrix:[[0.04,0.01],[0.01,0.0225]]};
  const options={calculatedAt:'2026-08-13T00:00:00.000Z'};
  const foundation=calculateFoundationFormula('portfolio-volatility',inputs,options);
  const corrected=calculateFormula('portfolio-volatility',inputs,options);
  assert.equal(foundation.status,'success');
  assert.equal(corrected.status,'success');
  assert.deepEqual(corrected.outputs,foundation.outputs);
});

test('batch calculation cannot bypass the negative-variance fail-closed boundary',()=>{
  const [result]=calculateBatch([{formulaId:'portfolio-volatility',inputs:invalidInputs}],{calculatedAt:'2026-08-13T00:00:00.000Z'});
  assert.equal(result.status,'validation_error');
  assert.equal(result.outputs,null);
  assert.equal(result.validationErrors[0].code,'invalid_covariance_matrix');
});
