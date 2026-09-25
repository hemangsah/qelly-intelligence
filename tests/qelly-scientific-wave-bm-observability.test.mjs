import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {
  decisionObservabilitySnapshot,
  recordDecisionObservation,
  recordScannerObservation,
  recordTargetTouchSample,
  resetDecisionObservabilityForTest,
  __decisionObservabilityTest
} from '../apps/web/public/assets/decision-observability.mjs';

const read=(path)=>readFile(new URL('../'+path,import.meta.url),'utf8');

const decisionFixture=()=>({
  asset:'BTC',
  qellyView:{action:'WAIT',evidenceGate:{directionalEligible:false}},
  tradeResearch:{status:'NO_TRADE'},
  quant:{calibration:{state:'UNCALIBRATED'}},
  evidence:{
    news:{state:'stale',cache:{stale:true}},
    liquidity:{state:'live'},
    derivatives:{state:'live'},
    macro:{state:'available'}
  },
  performance:{
    components:{
      candleFetch:{ms:480,state:'ok'},
      liquidity:{ms:220,state:'ok'},
      fundingHistory:{ms:240,state:'ok'},
      multiTimeframe:{ms:450,state:'ok'},
      crossAssetBenchmark:{ms:570,state:'ok'},
      derivatives:{ms:700,state:'ok'},
      macro:{ms:300,state:'ok'},
      news:{ms:8,state:'ok'}
    }
  },
  providerResilience:{
    observed:{
      liquidity:{state:'live',health:{state:'live'}},
      derivatives:{state:'live',health:{state:'live'}},
      news:{state:'unavailable'},
      macro:{state:'available'}
    }
  }
});

test('Wave BM percentile helpers are deterministic and bounded',()=>{
  const {summarizeLatency,durationBucket,sampleBucket}=__decisionObservabilityTest;
  assert.deepEqual(summarizeLatency([100,200,300,400,500]),{
    sampleSize:5,p50Ms:300,p90Ms:460,p95Ms:480,maxMs:500
  });
  assert.equal(durationBucket(499),'lt_500ms');
  assert.equal(durationBucket(2500),'2000_3999ms');
  assert.equal(sampleBucket(0),'zero');
  assert.equal(sampleBucket(51),'gte_50');
});

test('Wave BM aggregates Decision, provider, freshness and state telemetry without storing market identifiers',()=>{
  resetDecisionObservabilityForTest();
  const data=decisionFixture();
  recordDecisionObservation({startedAt:globalThis.performance.now()-120,data,rrState:'rr_1_2'});
  const snapshot=decisionObservabilitySnapshot();
  assert.equal(snapshot.schemaVersion,'qelly.decision-observability/1.0.0');
  assert.equal(snapshot.latency.decision.sampleSize,1);
  assert.ok(snapshot.latency.decision.p50Ms>=100&&snapshot.latency.decision.p50Ms<300);
  assert.equal(snapshot.latency.providers.hyperliquid_candles.sampleSize,1);
  assert.equal(snapshot.latency.providers.hyperliquid_derivatives.p50Ms,700);
  assert.equal(snapshot.reliability.providerFailures.news,1);
  assert.equal(snapshot.reliability.staleEvidenceCount,1);
  assert.equal(snapshot.reliability.observedEvidenceCount,4);
  assert.equal(snapshot.decision.observations,1);
  assert.equal(snapshot.decision.noTradeCount,1);
  assert.equal(snapshot.decision.noTradeFrequency,1);
  assert.equal(snapshot.decision.directionalEligibleCount,0);
  assert.equal(snapshot.decision.rrSelections.rr_1_2,1);
  assert.equal(snapshot.decision.calibrationStates.uncalibrated,1);
  const serialized=JSON.stringify(snapshot);
  assert.doesNotMatch(serialized,/BTC/);
  assert.doesNotMatch(serialized,/\b[0-9]{4,}\.[0-9]+\b/);
  assert.equal(snapshot.privacy.containsAsset,false);
  assert.equal(snapshot.privacy.containsPrice,false);
  assert.equal(snapshot.privacy.containsPrompt,false);
  assert.equal(snapshot.privacy.containsTarget,false);
  assert.equal(snapshot.privacy.containsCustomRiskReward,false);
  assert.equal(snapshot.privacy.containsConversation,false);
});

test('Wave BM scanner percentiles and eligible setup counts are independent from Decision scoring',()=>{
  resetDecisionObservabilityForTest();
  for(let i=0;i<5;i++)recordScannerObservation({
    startedAt:globalThis.performance.now()-(200+i*100),
    scan:{eligibleCount:i%2}
  });
  const snapshot=decisionObservabilitySnapshot();
  assert.equal(snapshot.latency.scanner.sampleSize,5);
  assert.ok(snapshot.latency.scanner.p50Ms>=350&&snapshot.latency.scanner.p50Ms<550);
  assert.equal(snapshot.decision.scanRuns,5);
  assert.equal(snapshot.decision.scannerEligibleSetups,2);
  assert.equal(snapshot.reliability.scannerFailures,0);
});

test('Wave BM records the real target-touch ledger sample and does not substitute scenario calibration',()=>{
  resetDecisionObservabilityForTest();
  recordTargetTouchSample({
    calibrationState:'UNCALIBRATED',
    calibrationEligible:7,
    minimumSampleGate:50,
    observedSetups:9
  });
  let snapshot=decisionObservabilitySnapshot();
  assert.deepEqual(snapshot.decision.targetTouchSample,{
    state:'UNCALIBRATED',sampleSize:7,minimumSampleGate:50,observedSetups:9
  });
  recordTargetTouchSample(null);
  snapshot=decisionObservabilitySnapshot();
  assert.deepEqual(snapshot.decision.targetTouchSample,{
    state:'UNAVAILABLE',sampleSize:0,minimumSampleGate:null,observedSetups:0
  });
});

test('Wave BM keeps latency samples bounded in browser memory',()=>{
  resetDecisionObservabilityForTest();
  for(let i=0;i<80;i++)recordDecisionObservation({
    startedAt:globalThis.performance.now()-10,
    data:decisionFixture(),
    rrState:'auto'
  });
  const snapshot=decisionObservabilitySnapshot();
  assert.equal(snapshot.latency.decision.sampleSize,__decisionObservabilityTest.MAX_LATENCY_SAMPLES);
  assert.equal(snapshot.latency.providers.hyperliquid_candles.sampleSize,__decisionObservabilityTest.MAX_PROVIDER_SAMPLES);
});

test('Wave BM route wiring records observations but never consumes observability for eligibility or ranking',async()=>{
  const source=await read('apps/web/public/assets/routes/decision-proven-graph.mjs');
  assert.match(source,/recordDecisionObservation\(\{startedAt:observabilityStartedAt,data:next,rrState:rrTelemetryState\(state\.rr\)\}\)/);
  assert.match(source,/recordScannerObservation\(\{startedAt:observabilityStartedAt,scan:state\.scan\}\)/);
  assert.match(source,/recordTargetTouchSample\(state\.ledger\)/);
  assert.match(source,/recordTargetTouchSample\(null\)/);
  assert.doesNotMatch(source,/decisionObservabilitySnapshot\(\)[^\n]{0,180}(directionalEligible|researchPriority|eligibleCount)/);
});

test('Wave BM observability module exposes the required metric families and privacy boundary',async()=>{
  const source=await read('apps/web/public/assets/decision-observability.mjs');
  for(const phrase of [
    'p50Ms','p90Ms','p95Ms','providerFailures','staleEvidenceRate','noTradeFrequency',
    'rrSelections','calibrationStates','targetTouchSample','routeErrors','widgetErrors',
    'memoryAnomalies','longTasksOverNotice','containsConversation:false'
  ])assert.ok(source.includes(phrase),phrase);
  assert.match(source,/Provider component durations may overlap/);
  assert.match(source,/No secrets, identifiers, raw private conversations, prices, targets or custom R:R values/);
});
