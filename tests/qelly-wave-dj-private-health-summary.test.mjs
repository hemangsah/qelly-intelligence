import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {summarizeEcbAttempts,readEcbHealth} from '../supabase/functions/qelly-provider-ingestion/health-summary.mjs';
const now=new Date('2026-10-04T03:00:00Z');
const row=(extra={})=>({status:'succeeded',started_at:'2026-10-04T02:36:41.856Z',finished_at:'2026-10-04T02:36:42.595Z',input_summary:{provider:'ecb',source:'https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml',instrumentationVersion:'ecb-http-attempt-v1',private:'SECRET'},output_summary:{measurementScope:'edge-http-and-schema-validation',referenceOnly:true,latencyMs:739,observationTime:'2026-10-02T00:00:00Z',private:'SECRET'},error_summary:{private:'SECRET'},...extra});
test('one real attempt reports bounded evidence without claiming uptime, quotas or percentile baseline',()=>{
 const summary=summarizeEcbAttempts([row()],{now});
 assert.equal(summary.sampleCount,1);assert.equal(summary.successCount,1);assert.equal(summary.lastLatencyMs,739);assert.equal(summary.lastAttemptStatus,'succeeded');assert.equal(summary.lastFailureAt,null);
 assert.equal(summary.lastReferenceObservationAt,null);assert.equal(summary.lastReferenceDate,'2026-10-02');assert.equal(summary.referenceTimePrecision,'date');assert.equal(summary.latency.p95Ms,null);
 assert.equal(summary.providerWideAvailability,null);assert.equal(summary.quotaRemaining,null);assert.equal(summary.sloState,'BASELINE_NOT_ESTABLISHED');
 assert.doesNotMatch(JSON.stringify(summary),/SECRET|error_summary|input_summary|httpStatus|source/);
});
test('malformed, future, old and unrecognized instrumentation rows are excluded; empty evidence stays unmeasured',()=>{
 const invalid=[row({status:'running'}),row({finished_at:'2099-01-01'}),row({finished_at:'2020-01-01'}),row({finished_at:'bad'}),row({input_summary:{provider:'binance'}}),row({started_at:'2026-10-05'})];
 const s=summarizeEcbAttempts(invalid,{now});assert.equal(s.sampleCount,0);assert.equal(s.rejectedRows,6);assert.equal(s.state,'UNMEASURED');assert.equal(s.lastSuccessAt,null);
});
test('new and legacy ECB reference dates remain date precision and impossible/future dates stay unavailable',()=>{
 for(const date of ['2026-10-02','2026-02-30','2099-01-01']){
  const summary=summarizeEcbAttempts([row({output_summary:{...row().output_summary,referenceDate:date,observationTime:null}})],{now});
  assert.equal(summary.sampleCount,1);assert.equal(summary.lastReferenceObservationAt,null);
  assert.equal(summary.lastReferenceDate,date==='2026-10-02'?date:null);
  assert.equal(summary.referenceTimePrecision,date==='2026-10-02'?'date':'unavailable');
 }
 const malformed=summarizeEcbAttempts([row({output_summary:{...row().output_summary,observationTime:42}})],{now});
 assert.equal(malformed.lastReferenceDate,null);assert.equal(malformed.referenceTimePrecision,'unavailable');
});
test('failure counts and nearest-rank percentiles derive from samples, never an availability percentage',()=>{
 const rows=Array.from({length:20},(_,i)=>row({status:i%2?'failed':'succeeded',output_summary:{...row().output_summary,latencyMs:i+1}}));
 const s=summarizeEcbAttempts(rows,{now});assert.equal(s.failureCount,10);assert.equal(s.successCount,10);assert.equal(s.latency.p50Ms,10);assert.equal(s.latency.p90Ms,18);assert.equal(s.latency.p95Ms,19);assert.equal(s.providerWideAvailability,null);
});
test('bounded history reader detects truncation and treats database failures as unavailable',async()=>{
 const s=await readEcbHealth(async args=>{assert.equal(args.limit,201);assert.equal(args.start,'2026-09-27T03:00:00.000Z');assert.ok(args.signal instanceof AbortSignal);return{data:Array.from({length:201},()=>row())};},{now});
 assert.equal(s.sampleCount,200);assert.equal(s.truncated,true);
 for(const result of [{error:{message:'SECRET'}},{data:null}])await assert.rejects(()=>readEcbHealth(async()=>result,{now}),/PROVIDER_MEASUREMENTS_UNAVAILABLE/);
});
test('private health action remains behind existing method and scheduler-key authorization, with no public telemetry grant',async()=>{
 const code=await readFile(new URL('../supabase/functions/qelly-provider-ingestion/index.ts',import.meta.url),'utf8');
 assert.ok(code.indexOf('INTERNAL_INGESTION_AUTH_REQUIRED')<code.indexOf('if(action==="health")'));
 assert.ok(code.indexOf('METHOD_NOT_ALLOWED')<code.indexOf('if(action==="health")'));
 assert.match(code,/\.eq\("subsystem","provider-ingestion"\)\.eq\("job_type","ecb-http-attempt"\)/);
 assert.match(code,/\.gte\("finished_at",start\)\.lte\("finished_at",end\)/);
 assert.ok(code.indexOf('return reply(200,{ok:true,health})')<code.indexOf('PROVIDER_RIGHTS_NOT_ESTABLISHED'));
});
