import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluateDecisionSlos,__decisionSloTest} from '../apps/web/public/assets/decision-slos.mjs';
import {decisionObservabilitySnapshot,recordDecisionObservation,resetDecisionObservabilityForTest} from '../apps/web/public/assets/decision-observability.mjs';
const measured=()=>({latency:{decision:{sampleSize:24,p95Ms:1000},scanner:{sampleSize:24,p95Ms:1200}},decision:{observations:24,scanRuns:24},reliability:{observedEvidenceCount:100,staleEvidenceRate:0,routeErrors:0,widgetErrors:0,providerObservations:{ecb:24},providerFailureCounts:{ecb:0}},browser:{routeSampleCount:12,memoryAnomalies:0,longTasksOverRepeated:0,webVitals:{lcpMs:1200,inpMs:80,cls:0}}});
test('missing, coerced and invalid Web Vitals cannot certify a complete operational snapshot',()=>{
 for(const value of [null,undefined,'','0',false,{},[],NaN,Infinity,-1]){
  const snapshot=measured();snapshot.browser.webVitals={lcpMs:value,inpMs:value,cls:value};
  const result=evaluateDecisionSlos(snapshot);
  for(const name of ['lcpMs','inpMs','cls']){assert.equal(result.objectives[name].state,'UNAVAILABLE');assert.equal(result.objectives[name].sampleSize,0);assert.equal(result.objectives[name].value,null);}
  assert.equal(result.certified,false);assert.equal(result.state,'OBSERVING');
 }
});
test('actual numeric zero measurements retain PASS and do not inherit missing-value semantics',()=>{
 const snapshot=measured();snapshot.browser.webVitals={lcpMs:0,inpMs:0,cls:0};
 const result=evaluateDecisionSlos(snapshot);assert.equal(result.certified,true);
 for(const name of ['lcpMs','inpMs','cls']){assert.equal(result.objectives[name].state,'PASS');assert.equal(result.objectives[name].sampleSize,1);assert.equal(result.objectives[name].value,0);}
});
test('missing latency, evidence-rate and counter measurements remain unavailable despite sufficient independent counts',()=>{
 for(const value of [null,undefined,'',false,-1]){
  const snapshot=measured();snapshot.latency.decision.p95Ms=value;snapshot.reliability.staleEvidenceRate=value;snapshot.reliability.routeErrors=value;snapshot.browser.memoryAnomalies=value;
  const result=evaluateDecisionSlos(snapshot);
  for(const name of ['decisionLatencyP95Ms','staleEvidenceRate','routeErrorRate','memoryAnomalies'])assert.equal(result.objectives[name].state,'UNAVAILABLE');
  assert.equal(result.certified,false);
 }
});
test('malformed sample counts and invalid rate numerators cannot create a service certificate',()=>{
 for(const sampleSize of ['20',true,[],null,NaN,-1,20.5])assert.equal(__decisionSloTest.evaluate('decisionLatencyP95Ms',{value:1000,sampleSize}).state,'UNAVAILABLE');
 for(const numerator of [null,undefined,'0',false,-1,21])assert.equal(__decisionSloTest.safeRate(numerator,20),null);
 assert.equal(__decisionSloTest.safeRate(0,20),0);assert.equal(__decisionSloTest.safeRate(2,20),.1);
});
test('empty actual telemetry keeps unobserved latency percentiles and maxima null through SLO evaluation',()=>{
 resetDecisionObservabilityForTest();const snapshot=decisionObservabilitySnapshot();
 for(const name of ['decision','scanner']){assert.deepEqual(snapshot.latency[name],{sampleSize:0,p50Ms:null,p90Ms:null,p95Ms:null,maxMs:null});assert.equal(evaluateDecisionSlos(snapshot).objectives[name+'LatencyP95Ms'].state,'UNAVAILABLE');}
});
test('known provider attempts with unavailable or malformed duration do not fabricate zero latency samples',()=>{
 for(const ms of [null,undefined,'','0',false,[],NaN,Infinity,-1]){
  resetDecisionObservabilityForTest();recordDecisionObservation({startedAt:performance.now(),data:{performance:{components:{candleFetch:{ms,state:'ok'}}}}});
  const snapshot=decisionObservabilitySnapshot();assert.equal(snapshot.latency.providers.hyperliquid_candles,undefined);assert.equal(snapshot.reliability.providerObservations.hyperliquid_candles,1);
 }
});
test('an explicitly numeric zero provider duration remains one measured sample',()=>{
 resetDecisionObservabilityForTest();recordDecisionObservation({startedAt:performance.now(),data:{performance:{components:{candleFetch:{ms:0,state:'ok'}}}}});
 assert.deepEqual(decisionObservabilitySnapshot().latency.providers.hyperliquid_candles,{sampleSize:1,p50Ms:0,p90Ms:0,p95Ms:0,maxMs:0});
});
