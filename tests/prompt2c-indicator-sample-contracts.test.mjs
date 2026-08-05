import test from 'node:test';
import assert from 'node:assert/strict';
import {calculateIndicator,listIndicatorDefinitions} from '../apps/web/public/assets/calculation/indicator-engine-extended.mjs';
import {createIndicatorSampleInputs,indicatorSampleContractMetadata} from '../apps/web/public/assets/calculation/indicator-sample-contracts.mjs';

const governedTruthStates=new Set(['IMPLEMENTED_DETERMINISTIC_LOCAL','FRESH_REIMPLEMENTATION_2026']);

test('presentation sample contract preserves valid aligned OHLCV',()=>{
  const inputs=createIndicatorSampleInputs({parameters:{period:14}});
  const lengths=['open','high','low','close','volume'].map((field)=>inputs[field].length);
  assert.equal(new Set(lengths).size,1);
  assert.ok(lengths[0]>=48);
  for(let index=0;index<inputs.close.length;index++){
    assert.ok(inputs.high[index]>=Math.max(inputs.open[index],inputs.close[index]));
    assert.ok(inputs.low[index]<=Math.min(inputs.open[index],inputs.close[index]));
    assert.ok(inputs.low[index]>0);
    assert.ok(inputs.volume[index]>0);
  }
  assert.equal(inputs.period,14);
});

test('every indicator definition calculates successfully from the presentation contract',()=>{
  const failures=[];
  for(const definition of listIndicatorDefinitions()){
    const inputs=definition.referenceVector?.inputs??createIndicatorSampleInputs(definition);
    const result=calculateIndicator(definition.indicatorId,inputs,{calculatedAt:'2026-07-30T00:00:00.000Z'});
    if(result.status!=='success')failures.push({indicatorId:definition.indicatorId,errors:result.validationErrors});
    assert.equal(result.indicatorId,definition.indicatorId);
    assert.equal(governedTruthStates.has(result.truthState),true,`${definition.indicatorId} returned an ungoverned truth state`);
    if(definition.productTruth)assert.equal(result.truthState,definition.productTruth);
  }
  assert.deepEqual(failures,[]);
});

test('sample contract is presentation-only and does not alter calculation engines',()=>{
  const metadata=indicatorSampleContractMetadata();
  assert.equal(metadata.externalProviderRequired,false);
  assert.equal(metadata.calculationEngineModified,false);
  assert.equal(metadata.inputOrdering,'oldest-to-newest');
});
