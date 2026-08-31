import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {buildPublicAdvancedChart,__test as chartTest} from '../functions/_lib/public-advanced-chart.js';

const read=(path)=>readFile(new URL(`../${path}`,import.meta.url),'utf8');
const sources={
  'alternative-me':{state:'live',truthState:'live',observedAt:'2026-08-31T00:00:00.000Z',data:{items:[{symbol:'BTC',name:'Bitcoin',priceUsd:62000,change24hPct:1.2,marketCapUsd:1.2e12,volume24hUsd:3e10}]}},
  hyperliquid:{state:'live',truthState:'live',data:{mids:{BTC:62010}}}
};

test('governed chart contract normalizes parameters and never fabricates a historical series',()=>{
  const result=buildPublicAdvancedChart(sources,'BTC',{study:'rsi',interval:'4h',range:'30d',length:'500',confirmation:'0'});
  assert.equal(result.version,'governed-technical-study-workspace-v2');
  assert.equal(result.selected.id,'QI-CRYPTO-BTC');
  assert.equal(result.configuration.study,'rsi');
  assert.equal(result.configuration.interval,'4h');
  assert.equal(result.configuration.range,'30d');
  assert.equal(result.configuration.length,100);
  assert.equal(result.configuration.confirmation,1);
  assert.equal(result.configuration.targetBars,180);
  assert.equal(result.historicalSeries.state,'unavailable');
  assert.deepEqual(result.historicalSeries.points,[]);
  assert.equal(result.readiness.canCompute,false);
  assert.equal(result.readiness.computedStudies,0);
  assert.equal(result.qualityGates.length,6);
  assert.equal(result.protocol.length,5);
  assert.equal(result.boundaries.syntheticCandles,false);
  assert.equal(result.boundaries.externalDisplayConsumedByAnalytics,false);
  assert.equal(result.boundaries.execution,false);
});

test('study catalog gives every method a distinct job, method, invalidation and failure model',()=>{
  assert.equal(chartTest.STUDIES.length,7);
  assert.equal(new Set(chartTest.STUDIES.map((item)=>item.job)).size,7);
  for(const item of chartTest.STUDIES){assert.ok(item.method.length>20);assert.ok(item.interpretation.length>20);assert.ok(item.invalidation.length>20);assert.equal(item.failureModes.length,3);}
});

test('Advanced Chart production route is purpose-distinct, interactive and responsive',async()=>{
  const [route,css,handler,policy,registry,worker,evidence,openapi,workflow]=await Promise.all([
    read('apps/web/public/assets/routes/advanced-chart.mjs'),read('apps/web/public/assets/routes/advanced-chart-v2.css'),read('functions/api/v1/[[path]].js'),read('src/server/api-access-policy.mjs'),read('apps/web/public/assets/route-registry.mjs'),read('apps/web/public/qelly-service-worker.js'),read('scripts/release-a5-evidence-server.mjs'),read('packages/openapi/qelly.openapi.json'),read('.github/workflows/browser-e2e.yml')
  ]);
  for(const phrase of ['governed-study-workspace-v2','Study price structure without inventing the tape.','Make every analytical choice explicit.','The empty canvas is an evidence result.','Six gates before one calculation.','Study reconstruction receipt','No fake candles'])assert.match(route,new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
  for(const marker of ['data-ac-asset','data-ac-form','data-ac-run','data-ac-receipt','data-ac-route'])assert.match(route,new RegExp(marker));
  assert.doesNotMatch(route,/asset-intelligence\/\$\{selected\}\/chart|Packaged OHLCV fixture|deterministic candlestick|q-candle/);
  assert.match(css,/@container\(max-width:1180px\)/);assert.match(css,/@container\(max-width:620px\)/);assert.doesNotMatch(css,/visibility\s*:\s*hidden|display\s*:\s*none/);
  assert.match(handler,/path==='discovery\/advanced-chart'&&readMethod\(method\)/);assert.match(handler,/buildPublicAdvancedChart/);
  assert.match(policy,/'\/api\/v1\/discovery\/advanced-chart'/);assert.match(registry,/route:'advanced-chart'.*public:true/);
  assert.match(worker,/advanced-chart-v2\.css/);assert.match(worker,/advanced-chart\.mjs/);assert.match(evidence,/url\.pathname==='\/api\/v1\/discovery\/advanced-chart'/);assert.match(workflow,/advanced-chart-v2\.css/);
  assert.deepEqual(Object.keys(JSON.parse(openapi).paths['/api/v1/discovery/advanced-chart'].get.responses).sort(),['200','429']);
});
