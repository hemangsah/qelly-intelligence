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
  assert.match(api,/rangeEvidence,rangeReplay/);
  assert.match(api,/selectedRangeSimilarMoves:graph\.selectedRangeSimilarMoves/);
  assert.match(api,/performance/);
});


test('Wave CE exact-range endpoint carries replay and similar-move research atomically',async()=>{
  const endpoint=await readFile(new URL('../functions/api/v1/decision-range-evidence.js',import.meta.url),'utf8');
  const route=await readFile(new URL('../apps/web/public/assets/routes/decision-proven-graph.mjs',import.meta.url),'utf8');
  assert.match(endpoint,/rangeReplay:base\.rangeReplay\|\|null/);
  assert.match(endpoint,/selectedRangeSimilarMoves:base\.selectedRangeSimilarMoves\|\|null/);
  assert.match(route,/rangeReplay:result\?\.rangeReplay\|\|state\.data\.rangeReplay/);
  assert.match(route,/selectedRangeSimilarMoves:result\?\.selectedRangeSimilarMoves\|\|state\.data\.selectedRangeSimilarMoves/);
});
