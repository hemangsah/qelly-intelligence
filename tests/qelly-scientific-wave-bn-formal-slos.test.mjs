import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {
  decisionObservabilitySnapshot,
  recordDecisionObservation,
  recordScannerObservation,
  resetDecisionObservabilityForTest
} from '../apps/web/public/assets/decision-observability.mjs';
import {evaluateDecisionSlos,decisionSloPolicy,__decisionSloTest} from '../apps/web/public/assets/decision-slos.mjs';

const read=(path)=>readFile(new URL('../'+path,import.meta.url),'utf8');
const decisionFixture=({failedNews=false}={})=>({
  qellyView:{evidenceGate:{directionalEligible:false}},
  tradeResearch:{status:'NO_TRADE'},
  quant:{calibration:{state:'UNCALIBRATED'}},
  evidence:{news:{state:failedNews?'unavailable':'live'},liquidity:{state:'live'},derivatives:{state:'live'},macro:{state:'available'}},
  performance:{components:{
    candleFetch:{ms:500,state:'ok'},liquidity:{ms:250,state:'ok'},fundingHistory:{ms:250,state:'ok'},
    multiTimeframe:{ms:450,state:'ok'},crossAssetBenchmark:{ms:650,state:'ok'},derivatives:{ms:700,state:'ok'},macro:{ms:300,state:'ok'},news:{ms:25,state:failedNews?'failed':'ok'}
  }},
  providerResilience:{observed:{
    candleFetch:{state:'live'},liquidity:{state:'live'},fundingHistory:{state:'live'},multiTimeframe:{state:'live'},
    crossAssetBenchmark:{state:'available'},derivatives:{state:'live'},macro:{state:'available'},news:{state:failedNews?'unavailable':'live'}
  }}
});

test('Wave BN policy is explicit, versioned and sample-gated',()=>{
  const policy=decisionSloPolicy();
  assert.equal(policy.decisionLatencyP95Ms.target,3000);
  assert.equal(policy.decisionLatencyP95Ms.minSamples,20);
  assert.equal(policy.scannerLatencyP95Ms.target,4500);
  assert.equal(policy.scannerLatencyP95Ms.minSamples,20);
  assert.equal(policy.providerFailureRate.target,.10);
  assert.equal(policy.staleEvidenceRate.target,.10);
  assert.equal(policy.lcpMs.target,2500);
  assert.equal(policy.inpMs.target,200);
  assert.equal(policy.cls.target,.10);
});

test('Wave BN never certifies PASS below the minimum sample gate',()=>{
  const result=evaluateDecisionSlos({
    latency:{decision:{sampleSize:2,p95Ms:1000},scanner:{sampleSize:1,p95Ms:1200}},
    reliability:{observedEvidenceCount:4,staleEvidenceRate:0,routeErrors:0,widgetErrors:0,providerObservations:{hyperliquid_candles:2},providerFailureCounts:{}},
    decision:{observations:2,scanRuns:1},
    browser:{routeSampleCount:2,memoryAnomalies:0,longTasksOverRepeated:0,webVitals:{lcpMs:1200,inpMs:80,cls:.01}}
  });
  assert.equal(result.certified,false);
  assert.equal(result.state,'OBSERVING');
  assert.equal(result.objectives.decisionLatencyP95Ms.state,'INSUFFICIENT_SAMPLE');
  assert.equal(result.objectives.scannerLatencyP95Ms.state,'INSUFFICIENT_SAMPLE');
  assert.equal(result.providers.hyperliquid_candles.state,'INSUFFICIENT_SAMPLE');
  assert.match(result.measurementBoundary,/never count as PASS/i);
});

test('Wave BN provider failure rate uses explicit provider observation denominators',()=>{
  const pass=__decisionSloTest.providerSlo('hyperliquid_candles',20,1);
  const fail=__decisionSloTest.providerSlo('hyperliquid_candles',20,3);
  assert.equal(pass.state,'PASS');
  assert.equal(pass.value,.05);
  assert.equal(fail.state,'VIOLATION');
  assert.equal(fail.value,.15);
});

test('Wave BN reads BM telemetry without storing trading inputs and can produce a measured PASS',()=>{
  resetDecisionObservabilityForTest();
  for(let i=0;i<24;i++){
    recordDecisionObservation({startedAt:globalThis.performance.now()-500,data:decisionFixture(),rrState:'auto'});
    recordScannerObservation({startedAt:globalThis.performance.now()-800,scan:{eligibleCount:0}});
  }
  const snapshot=decisionObservabilitySnapshot();
  assert.equal(snapshot.reliability.providerObservations.hyperliquid_candles,24);
  assert.equal(snapshot.reliability.providerFailureCounts.hyperliquid_candles??0,0);
  assert.equal(snapshot.reliability.providerFailureRates.hyperliquid_candles,0);
  const result=evaluateDecisionSlos(snapshot);
  assert.equal(result.objectives.decisionLatencyP95Ms.state,'PASS');
  assert.equal(result.objectives.scannerLatencyP95Ms.state,'PASS');
  assert.equal(result.providers.hyperliquid_candles.state,'PASS');
  assert.notEqual(result.certified,true); // browser vitals/route samples are not fabricated in node.
  assert.equal(result.state,'OBSERVING');
  assert.match(result.scientificBoundary,/not trading-performance/i);
});

test('Wave BN marks a measured threshold breach as VIOLATION rather than smoothing it away',()=>{
  const result=evaluateDecisionSlos({
    latency:{decision:{sampleSize:24,p95Ms:3600},scanner:{sampleSize:24,p95Ms:4200}},
    reliability:{observedEvidenceCount:100,staleEvidenceRate:.04,routeErrors:0,widgetErrors:0,providerObservations:{hyperliquid_candles:24},providerFailureCounts:{hyperliquid_candles:1}},
    decision:{observations:24,scanRuns:24},
    browser:{routeSampleCount:12,memoryAnomalies:0,longTasksOverRepeated:0,webVitals:{lcpMs:1800,inpMs:120,cls:.04}}
  });
  assert.equal(result.state,'VIOLATION');
  assert.equal(result.certified,false);
  assert.equal(result.objectives.decisionLatencyP95Ms.state,'VIOLATION');
  assert.equal(result.objectives.scannerLatencyP95Ms.state,'PASS');
});

test('Wave BN route wiring observes SLOs but never consumes them for Decision/scanner eligibility',async()=>{
  const source=await read('apps/web/public/assets/routes/decision-proven-graph.mjs');
  assert.match(source,/evaluateDecisionSlos/);
  assert.match(source,/Operational SLOs/);
  assert.match(source,/updateSlo\(recordDecisionObservation/);
  assert.match(source,/updateSlo\(recordScannerObservation/);
  assert.doesNotMatch(source,/state\.slo[^\n]{0,180}(directionalEligible|researchPriority|minEvidenceQuality|eligibleCount)/);
  assert.match(source,/decision_slo/);
});

test('Wave BN policy module contains no trade-performance or user-data SLO',async()=>{
  const source=await read('apps/web/public/assets/decision-slos.mjs');
  for(const forbidden of ['profit','win rate','target touch probability','expected return','email','prompt','asset identifier'])assert.doesNotMatch(source,new RegExp(forbidden,'i'));
  assert.match(source,/privacy-safe BM observations/);
  assert.match(source,/not trading-performance, target-touch, calibration, expected-value or profitability claims/);
});
