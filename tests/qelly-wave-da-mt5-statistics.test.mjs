import test from 'node:test';
import assert from 'node:assert/strict';
import {mt5SampleStatistics} from '../apps/web/public/assets/qelly-mt5-statistics.mjs';
test('bounded resampling is deterministic and states non-predictive assumptions',()=>{
 const a=Array.from({length:80},(_,i)=>i%3===0?-3:2);
 const x=mt5SampleStatistics(a),y=mt5SampleStatistics(a);
 assert.deepEqual(x,y);assert.equal(x.sampleSize,80);
 assert.equal(x.bootstrapRuns,320);assert.equal(x.reorderRuns,256);
 assert.equal(x.bootstrapMean95.length,2);assert.ok(x.reorderedDrawdown95>=0);
 assert.match(x.resamplingBoundary,/no future certainty/);
});
test('tiny and very large samples cannot acquire fake statistical confidence',()=>{
 assert.equal(mt5SampleStatistics([10,-1,3]).bootstrapMean95,null);
 assert.equal(mt5SampleStatistics(Array.from({length:5001},()=>1)).reorderedDrawdown95,null);
});
test('zero dispersion and invalid numeric evidence are handled explicitly',()=>{
 const a=mt5SampleStatistics(Array.from({length:30},()=>2));
 assert.equal(a.sampleSd,0);assert.equal(a.descriptiveSkew,null);
 assert.throws(()=>mt5SampleStatistics([1,Infinity]),/Finite observed/);
 assert.throws(()=>mt5SampleStatistics([1,'3']),/Finite observed/);
 assert.throws(()=>mt5SampleStatistics(Array.from({length:31},()=>2),{bootstrapRuns:10001}),/Bounded/);
});
