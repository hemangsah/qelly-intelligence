import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createDecisionLatencyTrace,estimateSerializedPayload} from '../functions/_lib/decision-latency.js';

const read=(path)=>readFile(new URL('../'+path,import.meta.url),'utf8');

test('Wave AL records deterministic sync and async spans without summing concurrent work',async()=>{
  let tick=0;
  const trace=createDecisionLatencyTrace({clock:()=>tick});
  const sync=trace.measure('compute',()=>{tick+=5;return 'sync-ok';});
  const asyncValue=await trace.time('provider',async()=>{tick+=7;return 'async-ok';});
  tick+=3;
  const snapshot=trace.snapshot({database:{used:false,ms:null}});
  assert.equal(sync,'sync-ok');
  assert.equal(asyncValue,'async-ok');
  assert.equal(snapshot.schemaVersion,'qelly.decision-latency/1.0.0');
  assert.equal(snapshot.components.compute.ms,5);
  assert.equal(snapshot.components.provider.ms,7);
  assert.equal(snapshot.components.compute.state,'ok');
  assert.equal(snapshot.totalMs,15);
  assert.equal(snapshot.database.used,false);
  assert.match(snapshot.concurrencyBoundary,/may overlap/i);
});

test('Wave AL records failed spans without swallowing provider errors',async()=>{
  let tick=0;
  const trace=createDecisionLatencyTrace({clock:()=>tick});
  await assert.rejects(
    trace.time('providerFailure',async()=>{tick+=4;throw new Error('expected failure');}),
    /expected failure/
  );
  const snapshot=trace.snapshot();
  assert.equal(snapshot.components.providerFailure.ms,4);
  assert.equal(snapshot.components.providerFailure.state,'error');
});

test('Wave AL estimates serialization separately from server component timing',()=>{
  let calls=0;
  const ticks=[10,12];
  const result=estimateSerializedPayload({a:1,b:'bounded'},{clock:()=>ticks[Math.min(calls++,ticks.length-1)]});
  assert.equal(result.serializationMs,2);
  assert.ok(result.responseBytes>0);
});

test('Decision API instruments required provider, compute and serialization stages without changing eligibility gates',async()=>{
  const source=await read('functions/api/v1/decision-proven-graph.js');
  for(const stage of [
    "'candleFetch'","'multiTimeframe'","'derivatives'","'liquidity'","'fundingHistory'",
    "'crossAssetBenchmark'","'news'","'macro'","'quantCalibrationAnalogs'",
    "'riskRewardResearch'","'contextAndEvidenceGraph'"
  ]) assert.ok(source.includes(stage),stage);
  assert.match(source,/createDecisionLatencyTrace/);
  assert.match(source,/estimateSerializedPayload/);
  assert.match(source,/database:\{used:false,ms:null\}/);
  assert.match(source,/server-side component timings exclude internet transit/);
  assert.match(source,/calibrateDecisionEvidence/);
  assert.match(source,/buildTradeResearch/);
  assert.match(source,/buildDecisionContextBundle/);
});

test('Scanner publishes total and per-asset Decision timings while retaining governed concurrency and NO TRADE boundaries',async()=>{
  const source=await read('functions/api/v1/decision-scan.js');
  assert.match(source,/createDecisionLatencyTrace/);
  assert.match(source,/latency\.time\('asset:'\+asset/);
  assert.match(source,/assetDecisionMs/);
  assert.match(source,/concurrency:2/);
  assert.match(source,/estimateSerializedPayload/);
  assert.match(source,/noTradeFirstClass:true/);
  assert.match(source,/targetTouchProbabilityCalibrated:false/);
});
