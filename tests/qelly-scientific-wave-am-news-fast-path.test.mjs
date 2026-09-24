import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {__decisionNewsContextTest} from '../functions/api/v1/decision-news-context.js';

const read=(path)=>readFile(new URL('../'+path,import.meta.url),'utf8');

test('Wave AM news enrichment endpoint is bounded and declares zero eligibility impact',async()=>{
  assert.ok(__decisionNewsContextTest.ASSETS.has('BTC'));
  assert.equal(__decisionNewsContextTest.MAX_WINDOW_MS,30*86_400_000);
  assert.equal(__decisionNewsContextTest.FUTURE_TOLERANCE_MS,5*60_000);
  const endpoint=await read('functions/api/v1/decision-news-context.js');
  assert.match(endpoint,/eligibilityImpact:'none'/);
  assert.match(endpoint,/cannot change QELLY VIEW, entry, invalidation, targets, R:R feasibility, calibration, or NO TRADE eligibility/);
  assert.match(endpoint,/enforceRateLimit/);
  assert.match(endpoint,/news_window_too_large/);
  assert.match(endpoint,/future_news_window/);
});

test('Wave AM primary Decision defers only uncached contextual news and exposes a bounded enrichment receipt',async()=>{
  const source=await read('functions/api/v1/decision-proven-graph.js');
  assert.match(source,/cacheOnly:true/);
  assert.match(source,/state:'pending'/);
  assert.match(source,/\/api\/v1\/decision-news-context\?/);
  assert.match(source,/eligibilityImpact:'none'/);
  assert.match(source,/QELLY VIEW is already final for this snapshot because news is contextual and has no eligibility impact/);
  assert.match(source,/const payload=await fetchCandles\(fetchImpl,resolvedAsset,resolvedInterval,endTime\)/);
  assert.match(source,/assembleTimeframes\(graph,timeframeSupport\)/);
});

test('Wave AM browser enrichment is graph-id guarded and changes only contextual news evidence',async()=>{
  const route=await read('apps/web/public/assets/routes/decision-proven-graph.mjs');
  assert.match(route,/async function enrichDecisionNews\(snapshot\)/);
  assert.match(route,/state\.data\.graphId!==graphId/);
  assert.match(route,/evidence:\{\.\.\.state\.data\.evidence,news:/);
  assert.match(route,/void enrichDecisionNews\(next\)/);
  assert.match(route,/eligibilityImpact:'none'/);
  const functionBody=route.slice(route.indexOf('async function enrichDecisionNews'),route.indexOf('async function load(){',route.indexOf('async function enrichDecisionNews')));
  assert.doesNotMatch(functionBody,/qellyView\s*:/);
  assert.doesNotMatch(functionBody,/tradeResearch\s*:/);
  assert.doesNotMatch(functionBody,/quant\s*:/);
});

test('Wave AM pending news remains explicitly contextual in the evidence ranking rather than a temporary directional view',async()=>{
  const [source,route]=await Promise.all([
    read('functions/api/v1/decision-proven-graph.js'),
    read('apps/web/public/assets/routes/decision-proven-graph.mjs')
  ]);
  assert.match(source,/News is contextual evidence only/);
  assert.match(route,/News: '+/);
  assert.doesNotMatch(source,/newsState.*directionalEligible|articles.*calibrationEligible|newsEnrichmentUrl.*action/);
});
