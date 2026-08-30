import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {buildNetworkDiagnostics} from '../functions/_lib/market-network.js';

const read=(relative)=>readFile(new URL(`../${relative}`,import.meta.url),'utf8');

const sources=()=>({
  'alternative-me':{truthState:'live',data:{assets:[{symbol:'BTC',priceUsd:65000}],sentiment:{value:42}}},
  hyperliquid:{truthState:'cached',data:[{symbol:'BTC',mid:65001}]},
  ecb:{truthState:'cached',data:{rates:{USD:1.16}}},
  'world-bank':{state:'reference_external',data:[{countryId:'IND',gdpGrowthPct:6.5}]},
  imf:{state:'reference_external',data:[{countryId:'IND',growthPct:6.4}]}
});

test('market-network diagnostics derive truthful coverage and comparison readiness',()=>{
  const result=buildNetworkDiagnostics(sources());
  assert.deepEqual(result.sourceCounts,{total:5,live:1,cached:2,delayed:2,unavailable:0});
  assert.equal(result.coverage.length,4);
  assert.equal(result.coverage.every((item)=>item.ready),true);
  assert.equal(result.readiness.readyDomains,4);
  assert.equal(result.readiness.independentCryptoComparison,true);
  assert.equal(result.readiness.macroCrossCheck,true);
  assert.equal(result.readiness.decisionUse,'ready_with_source_boundaries');
  assert.equal(result.readiness.execution,false);
});

test('market-network diagnostics stay partial when a required source is unavailable',()=>{
  const degraded=sources();
  degraded.hyperliquid={truthState:'unavailable',data:null};
  const result=buildNetworkDiagnostics(degraded);
  assert.equal(result.sourceCounts.unavailable,1);
  assert.equal(result.coverage.find((item)=>item.id==='crypto-pricing').ready,false);
  assert.equal(result.readiness.independentCryptoComparison,false);
  assert.equal(result.readiness.decisionUse,'partial_source_coverage');
});

test('Global Market Network V2 has three distinct jobs and working analytical surfaces',async()=>{
  const [route,handler]=await Promise.all([
    read('apps/web/public/assets/routes/market-network.mjs'),
    read('functions/api/v1/[[path]].js')
  ]);
  assert.match(route,/data-network-experience="mission-control-v2"/);
  for(const phrase of ['Scan breadth','Compare sources','Audit freshness','Cross-source crypto comparison','IMF WEO cross-check','Freshness inspector'])assert.match(route,new RegExp(phrase));
  assert.match(route,/data-network-view/);
  assert.match(route,/data-source-inspect/);
  assert.match(route,/data-link-filter/);
  assert.match(route,/data-guide/);
  assert.match(route,/Indicative difference/);
  assert.match(route,/not an executable spread or trading signal/);
  assert.match(handler,/networkDiagnostics:buildNetworkDiagnostics\(sources\)/);
});

test('Global Market Network V2 is container-responsive and offline packaged',async()=>{
  const [route,css,worker]=await Promise.all([
    read('apps/web/public/assets/routes/market-network.mjs'),
    read('apps/web/public/assets/routes/market-network-v2.css'),
    read('apps/web/public/qelly-service-worker.js')
  ]);
  assert.match(route,/market-network-v2\.css\?v=20260830-network2/);
  assert.match(css,/container-type:inline-size/);
  assert.match(css,/repeat\(auto-fit,minmax\(150px,1fr\)\)!important/);
  assert.match(css,/@container \(max-width:980px\)/);
  assert.match(css,/@container \(max-width:680px\)/);
  assert.match(css,/@container \(max-width:420px\)/);
  assert.match(css,/\.q-mn-source dl/);
  assert.match(css,/\.q-mn-guide-output/);
  assert.doesNotMatch(css,/visibility\s*:\s*hidden/);
  assert.match(worker,/assets\/routes\/market-network-v2\.css/);
});
