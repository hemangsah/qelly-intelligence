import test from 'node:test';
import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import {calculateIndicator,listIndicatorDefinitions,indicatorEngineMetadata} from '../apps/web/public/assets/calculation/indicator-engine-extended.mjs';
import {freshIndicatorDefinitions,calculateFreshIndicator,freshIndicatorFuzzInput} from '../apps/web/public/assets/calculation/fresh-indicator-catalog.mjs';
import {listIndicatorDefinitions as listFoundationIndicatorDefinitions} from '../apps/web/public/assets/calculation/indicator-engine.mjs';

const at='2026-07-30T00:00:00.000Z';
const arrays=outputs=>Object.values(outputs??{}).filter(Array.isArray);

test('fresh indicator catalog has exactly 34 unique non-colliding governed IDs',()=>{
  const foundation=listFoundationIndicatorDefinitions().map(x=>x.indicatorId);
  const fresh=freshIndicatorDefinitions.map(x=>x.indicatorId);
  assert.equal(foundation.length,20);
  assert.equal(fresh.length,34);
  assert.equal(new Set(fresh).size,34);
  assert.equal(fresh.filter(id=>foundation.includes(id)).length,0);
  assert.ok(fresh.every(id=>id.startsWith('fresh-')));
  assert.ok(freshIndicatorDefinitions.every(x=>x.provenanceStatus==='FRESH_REIMPLEMENTATION_2026'&&x.aliases.length===0));
  assert.equal(listIndicatorDefinitions().length,54);
  assert.equal(indicatorEngineMetadata.foundationDefinitionCount,20);
  assert.equal(indicatorEngineMetadata.freshDefinitionCount,34);
});

test('34 reference executions align outputs and repeat deterministically',()=>{
  for(const definition of freshIndicatorDefinitions){
    const first=calculateFreshIndicator(definition.indicatorId,definition.referenceVector.inputs,{calculatedAt:at});
    const second=calculateFreshIndicator(definition.indicatorId,definition.referenceVector.inputs,{calculatedAt:at});
    assert.equal(first.status,'success',definition.indicatorId);
    const length=definition.referenceVector.inputs[definition.requiredFields[0]].length;
    for(const output of arrays(first.outputs))assert.equal(output.length,length,definition.indicatorId);
    assert.deepEqual(second,first,definition.indicatorId);
    assert.doesNotThrow(()=>JSON.stringify(first));
    assert.equal(first.truthState,'FRESH_REIMPLEMENTATION_2026');
  }
});

test('340 indicator fuzz cases preserve alignment and finiteness',()=>{
  let cases=0;
  for(const definition of freshIndicatorDefinitions){
    for(let seed=1;seed<=10;seed++){
      const inputs=freshIndicatorFuzzInput(definition.indicatorId,seed);
      const result=calculateIndicator(definition.indicatorId,inputs,{calculatedAt:at});
      assert.equal(result.status,'success',`${definition.indicatorId}:${seed}`);
      const length=inputs[definition.requiredFields[0]].length;
      for(const output of arrays(result.outputs)){
        assert.equal(output.length,length,`${definition.indicatorId}:${seed}`);
        assert.ok(output.every(value=>value===null||Number.isFinite(value)),`${definition.indicatorId}:${seed}`);
      }
      cases++;
    }
  }
  assert.equal(cases,340);
});

test('constant and monotonic properties are explicit',()=>{
  const constant=Array(80).fill(100);
  const z=calculateIndicator('fresh-rolling-z-score',{close:constant,period:14},{calculatedAt:at});
  assert.equal(z.status,'success');
  assert.ok(z.outputs.value.slice(13).every(value=>value===0));
  const rising=Array.from({length:80},(_,index)=>100+index);
  const momentum=calculateIndicator('fresh-price-momentum',{close:rising,period:14},{calculatedAt:at});
  assert.ok(momentum.outputs.value.slice(14).every(value=>value===14));
  const median=calculateIndicator('fresh-median-price',{high:rising.map(x=>x+1),low:rising.map(x=>x-1),period:14},{calculatedAt:at});
  assert.deepEqual(median.outputs.value,rising);
});

test('indicator security rejects unsafe keys, misalignment and invalid bars',()=>{
  const unsafe=JSON.parse('{"__proto__":{"polluted":true},"close":[1,2,3,4],"period":2}');
  const rejected=calculateFreshIndicator('fresh-dema',unsafe,{calculatedAt:at});
  assert.equal(rejected.status,'validation_error');
  assert.equal(rejected.validationErrors[0].code,'unsafe_key');
  assert.equal({}.polluted,undefined);
  assert.equal(calculateFreshIndicator('fresh-price-channel',{high:[2,3,4],low:[1,2],period:2},{calculatedAt:at}).validationErrors[0].code,'length_mismatch');
  assert.equal(calculateFreshIndicator('fresh-price-channel',{high:[1,2,3],low:[2,1,2],period:2},{calculatedAt:at}).validationErrors[0].code,'invalid_bar');
});

test('representative 10,000-point indicators remain bounded',()=>{
  const n=10000,close=Array.from({length:n},(_,i)=>100+i*.001+Math.sin(i/17)),open=close.map(x=>x-.1),high=close.map(x=>x+1),low=close.map(x=>x-1),volume=close.map((_,i)=>1000+i%100);
  const started=performance.now();
  for(const id of ['fresh-dema','fresh-hull-moving-average','fresh-garman-klass-volatility','fresh-chaikin-money-flow','fresh-price-channel','fresh-choppiness-index']){
    const definition=freshIndicatorDefinitions.find(x=>x.indicatorId===id);
    const source={open,high,low,close,volume,period:20};
    const inputs=Object.fromEntries([...definition.requiredFields.map(field=>[field,source[field]]),['period',20]]);
    const result=calculateIndicator(id,inputs,{calculatedAt:at});
    assert.equal(result.status,'success',id);
    for(const output of arrays(result.outputs))assert.equal(output.length,n,id);
  }
  assert.ok(performance.now()-started<10000,'10,000-point indicator gate exceeded 10 seconds');
});
