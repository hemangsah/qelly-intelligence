import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {buildLedgerPageEvidence,parseExactCount,__decisionLedgerApiTest} from '../functions/api/v1/decision-ledger/[[route]].js';

const visible=(count)=>Array.from({length:count},(_,i)=>({id:'setup-'+i}));
const setupPage=(count,range)=>({data:visible(count),contentRange:range});
const resolvedPage=(rows=[],range='*/0')=>({data:rows,contentRange:range});

test('verified RLS workspace total is not replaced by latest visible page length',()=>{
 const result=buildLedgerPageEvidence(setupPage(25,'0-24/120'),resolvedPage());
 assert.equal(result.observedSetups,120);
 assert.equal(result.visibleSetups,25);
 assert.equal(result.totalCountVerified,true);
 assert.equal(result.hasMore,true);
 assert.equal(result.calibrationHistoryComplete,true);
 assert.equal(result.calibration.state,'UNCALIBRATED');
 assert.equal(result.calibration.qualityGate,'VERIFIED_COMPLETE_RESOLVED_HISTORY');
});
test('verified zero history is genuine zero, not an unavailable total',()=>{
 const result=buildLedgerPageEvidence(setupPage(0,'*/0'),resolvedPage());
 assert.equal(result.observedSetups,0);
 assert.equal(result.totalCountVerified,true);
 assert.equal(result.hasMore,false);
 assert.equal(result.calibration.eligibleResolvedSetups,0);
});
test('unknown exact setup total remains null while visible page count stays descriptive',()=>{
 const result=buildLedgerPageEvidence(setupPage(25,null),resolvedPage());
 assert.equal(result.observedSetups,null);
 assert.equal(result.visibleSetups,25);
 assert.equal(result.totalCountVerified,false);
 assert.equal(result.hasMore,null);
 assert.equal(result.calibrationHistoryComplete,true);
});
test('reported total smaller than returned rows cannot be treated as verified',()=>{
 const result=buildLedgerPageEvidence(setupPage(2,'0-1/1'),resolvedPage());
 assert.equal(result.observedSetups,null);
 assert.equal(result.totalCountVerified,false);
 assert.equal(result.hasMore,null);
});
test('an unverified resolved history blocks calibration independent of verified visible setup total',()=>{
 const result=buildLedgerPageEvidence(setupPage(2,'0-1/2'),resolvedPage([],null));
 assert.equal(result.observedSetups,2);
 assert.equal(result.calibrationHistoryComplete,false);
 assert.equal(result.calibration.qualityGate,'BLOCKED_INCOMPLETE_HISTORY');
 assert.equal(result.calibration.eligible,false);
 assert.deepEqual(result.calibration.metrics,{});
 assert.match(result.calibration.reason,/lacks an exact workspace count/i);
});
test('a resolved setup page silently capped by the upstream REST server blocks calibration',()=>{
 const result=buildLedgerPageEvidence(setupPage(1,'0-0/1'),resolvedPage([{id:'r1'}],'0-0/2'));
 assert.equal(result.calibrationHistoryComplete,false);
 assert.equal(result.resolvedHistoryTotal,null);
 assert.equal(result.calibration.state,'UNCALIBRATED');
 assert.equal(result.calibration.eligibleResolvedSetups,0);
});
test('the configured resolved-history cap blocks calibration even if reported exact total equals it',()=>{
 const result=buildLedgerPageEvidence(setupPage(2,'0-1/2'),resolvedPage([{id:'r1'},{id:'r2'}],'0-1/2'),{historyLimit:2});
 assert.equal(result.calibrationHistoryComplete,false);
 assert.equal(result.calibration.qualityGate,'BLOCKED_INCOMPLETE_HISTORY');
});
test('a fully retrieved observed history may reach calibration only after exact resolved total verification',()=>{
 const origin=Date.parse('2026-09-01T00:00:00.000Z');
 const rows=Array.from({length:80},(_,i)=>{
  const at=new Date(origin+i*3_600_000).toISOString();
  return {id:'resolved-'+i,created_observed_at:new Date(origin+(i-1)*3_600_000).toISOString(),
    resolved_at:at,regime:'TRENDING',targets:[{slot:1,price:105,ratio:1}],
    metrics:{targetReachedAt:{},invalidatedAt:at},
    resolved_outcome:{state:'INVALIDATED_FIRST',calibrationEligible:true}};
 });
 const result=buildLedgerPageEvidence(setupPage(25,'0-24/125'),resolvedPage(rows,'0-79/80'));
 assert.equal(result.calibrationHistoryComplete,true);
 assert.equal(result.calibration.qualityGate,'VERIFIED_COMPLETE_RESOLVED_HISTORY');
 assert.equal(result.calibration.eligibleResolvedSetups,80);
 assert.equal(result.observedSetups,125);
 assert.equal(result.visibleSetups,25);
});
test('ordinary setup GET count metadata is opt-in and idempotent POST/read flows remain payload-only',async()=>{
 const code=await readFile(new URL('../functions/api/v1/decision-ledger/[[route]].js',import.meta.url),'utf8');
 assert.match(code,/exactCount=false/);
 assert.match(code,/setupRows\(env,session,workspaceId,\{limit:limitFor\(url\),exactCount:true\}\)/);
 assert.match(code,/calibrationRows\(env,session,workspaceId,\{limit:historyLimit\}\)/);
 assert.match(code,/if\(existing\?\.length\)return responseJson/);
 assert.match(code,/observedSetups:evidence\.observedSetups/);
 assert.equal(__decisionLedgerApiTest.buildLedgerPageEvidence,buildLedgerPageEvidence);
 assert.equal(parseExactCount('0-24/120'),120);
});
test('Decision UI distinguishes an unverified count, latest page and unverified calibration',async()=>{
 const ui=await readFile(new URL('../apps/web/public/assets/routes/decision-proven-graph.mjs',import.meta.url),'utf8');
 assert.match(ui,/observedSetupsLabel/);
 assert.match(ui,/ledger\.totalCountVerified===true/);
 assert.match(ui,/UNVERIFIED · displaying/);
 assert.match(ui,/ledger\.calibrationHistoryComplete===true/);
 assert.match(ui,/calibrationCountLabel/);
 assert.match(ui,/Showing latest/);
 assert.doesNotMatch(ui,/ledger\.observedSetups\?\?items\.length/);
});
test('unverified totals and eligible-history counts are not silently emitted as telemetry zero',async()=>{
 const src=await readFile(new URL('../apps/web/public/assets/decision-observability.mjs',import.meta.url),'utf8');
 assert.match(src,/totalCountVerified===true/);
 assert.match(src,/calibrationHistoryComplete===true/);
 assert.match(src,/observedSetups:totalVerified\?ledger\.observedSetups:null/);
 assert.match(src,/historyVerified\?sampleBucket\(sampleSize\):'unverified'/);
 assert.doesNotMatch(src,/observedSetups:Math\.max\(0,Number\(ledger\.observedSetups\)\|\|0\)/);
});
