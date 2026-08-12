import test from 'node:test';
import assert from 'node:assert/strict';
import {calculateFormula} from '../apps/web/public/assets/calculation/formula-engine-extended.mjs';
import {stableHistoricalTailCount} from '../apps/web/public/assets/calculation/historical-tail-boundary.mjs';

const returns=Array.from({length:100},(_,index)=>index-100);

test('95% historical tail over 100 observations selects exactly five observations',()=>{
  assert.equal(stableHistoricalTailCount(0.95,100),5);

  const valueAtRisk=calculateFormula('historical-var',{returnsPercent:returns,confidencePercent:95},{calculatedAt:'2026-08-13T00:00:00.000Z'});
  assert.equal(valueAtRisk.status,'success');
  assert.equal(valueAtRisk.outputs.observations,100);
  assert.equal(valueAtRisk.outputs.quantileReturnPercent,-96);
  assert.equal(valueAtRisk.outputs.valueAtRiskPercent,96);

  const expectedShortfall=calculateFormula('expected-shortfall',{returnsPercent:returns,confidencePercent:95},{calculatedAt:'2026-08-13T00:00:00.000Z'});
  assert.equal(expectedShortfall.status,'success');
  assert.equal(expectedShortfall.outputs.tailObservations,5);
  assert.equal(expectedShortfall.outputs.expectedShortfallPercent,98);
});

test('non-integral empirical tail boundaries retain ceiling semantics',()=>{
  assert.equal(stableHistoricalTailCount(0.955,100),5);
  assert.equal(stableHistoricalTailCount(0.949,100),6);
});

test('tail correction preserves structured validation failures',()=>{
  const invalid=calculateFormula('historical-var',{returnsPercent:[-1],confidencePercent:95},{calculatedAt:'2026-08-13T00:00:00.000Z'});
  assert.equal(invalid.status,'validation_error');
  assert.equal(invalid.outputs,null);
});
