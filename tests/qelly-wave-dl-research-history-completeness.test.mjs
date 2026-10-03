import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {parseExactCount,researchHistoryBoundary,buildResearchOutcomeAudit,__decisionLedgerApiTest} from '../functions/api/v1/decision-ledger/[[route]].js';

const clock=Date.parse('2026-09-01T00:00:00.000Z');
const at=ms=>new Date(ms).toISOString();
const row=i=>{
 const start=clock+i*3_600_000;
 return {
   id:'setup-'+i,source_setup_id:'source-'+i,asset:'BTC',timeframe:'15m',
   direction:'BUY',created_observed_at:at(start),last_observed_at:at(start+1_800_000),
   resolved_at:at(start+1_800_000),latest_status:'INVALIDATED',
   targets:[{slot:1,price:110,ratio:1}],
   resolved_outcome:{state:'INVALIDATED_FIRST',calibrationEligible:true},
   metrics:{mfeR:0,maeR:1,triggerAt:at(start+300_000),invalidatedAt:at(start+1_800_000),targetReachedAt:{}},
   evidence_snapshot:{observedAt:at(start)},calibration_snapshot:{state:'UNCALIBRATED'}
 };
};
const obs=i=>({setup_id:'setup-'+i,observed_at:at(clock+i*3_600_000+1_800_000),resolution:{state:'INVALIDATED_FIRST',calibrationEligible:true}});
const sourceAudit=(setups,observations,options={})=>buildResearchOutcomeAudit(setups,observations,{
 verifiedSetupTotal:setups.length,verifiedObservationTotal:observations.length,...options
});
test('an empty workspace has no observed history and is never calibrated',()=>{
 const x=sourceAudit([],[]);
 assert.equal(x.dataQuality.state,'NO_OBSERVED_DATA');
 assert.equal(x.calibration.state,'UNCALIBRATED');
 assert.equal(x.calibration.eligible,false);
 assert.equal(x.calibration.eligibleResolvedSetups,0);
 assert.equal(x.sampleBoundary.historyComplete,true);
});
test('a complete valid bounded sample is audited independently of insufficient calibration size',()=>{
 const x=sourceAudit([row(0),row(1)],[obs(0),obs(1)],{setupLimit:3,observationLimit:3});
 assert.equal(x.dataQuality.state,'VALID');
 assert.equal(x.calibration.qualityGate,'PASSED');
 assert.equal(x.calibration.eligible,false);
 assert.equal(x.calibration.eligibleResolvedSetups,2);
 assert.equal(x.sampleBoundary.historyComplete,true);
 assert.equal(x.sampleBoundary.state,'COMPLETE_WITHIN_RETRIEVAL_LIMITS');
});
test('reaching a setup retrieval limit with otherwise valid observations blocks scientific calibration',()=>{
 const x=sourceAudit([row(0),row(1)],[obs(0),obs(1)],{setupLimit:2,observationLimit:3});
 assert.equal(x.dataQuality.state,'VALID');
 assert.equal(x.dataQuality.scientificallyUsable,false);
 assert.equal(x.dataQuality.assessmentScope,'CAPPED_VISIBLE_SAMPLE');
 assert.equal(x.sampleBoundary.setupLimitReached,true);
 assert.equal(x.sampleBoundary.observationLimitReached,false);
 assert.equal(x.calibration.qualityGate,'BLOCKED_INCOMPLETE_HISTORY');
 assert.equal(x.calibration.state,'UNCALIBRATED');
 assert.deepEqual(x.calibration.metrics,{});
 assert.match(x.calibration.reason,/history is incomplete/i);
});
test('reaching an observation cap with otherwise valid setups blocks calibration',()=>{
 const x=sourceAudit([row(0),row(1)],[obs(0),obs(1)],{setupLimit:3,observationLimit:2});
 assert.equal(x.dataQuality.state,'VALID');
 assert.equal(x.sampleBoundary.setupLimitReached,false);
 assert.equal(x.sampleBoundary.observationLimitReached,true);
 assert.equal(x.dataQuality.scientificallyUsable,false);
 assert.equal(x.calibration.qualityGate,'BLOCKED_INCOMPLETE_HISTORY');
 assert.equal(x.calibration.eligibleResolvedSetups,0);
 assert.match(x.sampleBoundary.boundary,/unseen setups or observations/i);
});
test('a sample hitting both caps cannot advertise complete audited history',()=>{
 const x=sourceAudit([row(0)],[obs(0)],{setupLimit:1,observationLimit:1});
 assert.equal(x.sampleBoundary.historyComplete,false);
 assert.equal(x.sampleBoundary.state,'INCOMPLETE_RETRIEVAL');
 assert.equal(x.calibration.qualityGate,'BLOCKED_INCOMPLETE_HISTORY');
});
test('contaminated labels outrank incomplete-history gate and cannot produce any calibration output',()=>{
 const x=sourceAudit([row(0)],[],{setupLimit:1,observationLimit:1});
 assert.equal(x.dataQuality.state,'CONTAMINATED');
 assert.equal(x.calibration.state,'UNCALIBRATED');
 assert.equal(x.calibration.qualityGate,'BLOCKED');
 assert.equal(x.calibration.eligible,false);
 assert.deepEqual(x.calibration.metrics,{});
});
test('full 80-observation fixture only reaches the calibration algorithm when neither cap is hit',()=>{
 const setups=Array.from({length:80},(_,i)=>row(i)),observations=Array.from({length:80},(_,i)=>obs(i));
 const valid=sourceAudit(setups,observations,{setupLimit:81,observationLimit:81});
 const capped=sourceAudit(setups,observations,{setupLimit:81,observationLimit:80});
 assert.equal(valid.dataQuality.state,'VALID');
 assert.equal(valid.calibration.qualityGate,'PASSED');
 assert.equal(valid.calibration.eligibleResolvedSetups,80);
 assert.equal(capped.dataQuality.state,'VALID');
 assert.equal(capped.calibration.eligibleResolvedSetups,0);
 assert.equal(capped.calibration.qualityGate,'BLOCKED_INCOMPLETE_HISTORY');
});
test('authenticated research route binds workspace-scoped rows and never silently treats capped samples as complete',async()=>{
 const api=await readFile(new URL('../functions/api/v1/decision-ledger/[[route]].js',import.meta.url),'utf8');
 assert.equal(__decisionLedgerApiTest.researchHistoryBoundary,researchHistoryBoundary);
 assert.equal(__decisionLedgerApiTest.buildResearchOutcomeAudit,buildResearchOutcomeAudit);
 assert.match(api,/relative==='research-audit'/);
 assert.match(api,/buildResearchOutcomeAudit\(setups,observations,\{setupLimit,observationLimit,verifiedSetupTotal,verifiedObservationTotal\}\)/);
 assert.match(api,/workspace_id:\`eq\.\$\{workspaceId\}\`/);
 assert.match(api,/qualityGate:'BLOCKED'/);
 assert.match(api,/qualityGate:'BLOCKED_INCOMPLETE_HISTORY'/);
 assert.match(api,/historyComplete/);
 assert.match(api,/NO_OBSERVED_DATA/);
});

test('PostgREST exact-count parser rejects unknown, malformed and unsafe totals',()=>{
 assert.equal(parseExactCount('0-19/120'),120);
 assert.equal(parseExactCount('*/0'),0);
 assert.equal(parseExactCount(' 0-0/1 '),1);
 for(const input of [null,'','0-9/*','0-9/NaN','0-9/-1','0-9/9007199254740993'])assert.equal(parseExactCount(input),null);
});
test('a server cap below the requested history limit cannot masquerade as a complete workspace',()=>{
 const sample=buildResearchOutcomeAudit([row(0),row(1)],[obs(0),obs(1)],{
   setupLimit:2000,observationLimit:5000,verifiedSetupTotal:3,verifiedObservationTotal:2
 });
 assert.equal(sample.dataQuality.state,'VALID');
 assert.equal(sample.dataQuality.scientificallyUsable,false);
 assert.equal(sample.sampleBoundary.setupCountVerified,false);
 assert.equal(sample.sampleBoundary.observationCountVerified,true);
 assert.equal(sample.calibration.qualityGate,'BLOCKED_INCOMPLETE_HISTORY');
});
test('missing exact-count response header blocks even apparently valid small history',()=>{
 const sample=buildResearchOutcomeAudit([row(0)],[obs(0)],{setupLimit:2000,observationLimit:5000});
 assert.equal(sample.dataQuality.state,'VALID');
 assert.equal(sample.sampleBoundary.historyComplete,false);
 assert.equal(sample.calibration.eligible,false);
 assert.equal(sample.calibration.qualityGate,'BLOCKED_INCOMPLETE_HISTORY');
});
test('research-only exact count leaves ordinary Supabase REST response contract unchanged',async()=>{
 const runtime=await readFile(new URL('../functions/_lib/runtime.js',import.meta.url),'utf8');
 const route=await readFile(new URL('../functions/api/v1/decision-ledger/[[route]].js',import.meta.url),'utf8');
 assert.match(runtime,/responseMeta=false/);
 assert.match(runtime,/responseMeta\?\{data:payload,contentRange:response.headers.get\('content-range'\)\}:payload/);
 assert.match(runtime,/exactCount=false/);
 assert.match(runtime,/count=exact/);
 assert.match(route,/exactCount:true/);
 assert.equal(__decisionLedgerApiTest.parseExactCount,parseExactCount);
});
