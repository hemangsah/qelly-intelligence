import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('Wave CE Decision API returns selected-range replay and selected-range analogs explicitly',async()=>{
  const api=await readFile(new URL('../functions/api/v1/decision-proven-graph.js',import.meta.url),'utf8');
  assert.match(api,/buildDecisionRangeReplay,buildSelectedRangeSimilarMoves/);
  assert.match(api,/selectedRangeSimilarMoves:resolvedSelection\?buildSelectedRangeSimilarMoves/);
  assert.match(api,/const rangeReplay=resolvedSelection\?buildDecisionRangeReplay/);
  assert.match(api,/newsArticles:articles/);
  assert.match(api,/fundingRows:selectedFundingRows/);
  assert.match(api,/benchmarkCandles:selectedBenchmarkRows/);
  assert.match(api,/rangeEvidence,rangeReplay,selectedRangeSimilarMoves:graph\.selectedRangeSimilarMoves,performance/);
});
