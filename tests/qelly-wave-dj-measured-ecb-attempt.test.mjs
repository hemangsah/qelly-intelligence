import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {measureEcbAttempt} from '../supabase/functions/qelly-provider-ingestion/measured-attempt.mjs';
const source='https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml';
const days=[{observedAt:'2026-10-02T00:00:00Z',rates:{USD:1.1}}];
const clocks=()=>{let i=0;return{clock:()=>[100,143.6][i++],wallClock:()=>new Date('2026-10-04T02:00:00Z')};};

test('real ECB operation measures latency and schema result, without inventing quotas or provider-wide health',async()=>{
 let row;const measured=await measureEcbAttempt({source,operation:async()=>({days,httpStatus:200}),persist:async value=>{row=value;return{error:null};},...clocks()});
 assert.equal(measured.persisted,true);assert.equal(measured.days,days);
 assert.equal(row.status,'succeeded');assert.equal(row.truth_state,'delayed');
 assert.deepEqual(row.output_summary,{measurementScope:'edge-http-and-schema-validation',latencyMs:44,httpStatus:200,validatedDays:1,observationTime:'2026-10-02T00:00:00Z',referenceOnly:true,quotaRemaining:null,providerWideAvailability:null});
 assert.equal(row.input_summary.instrumentationVersion,'ecb-http-attempt-v1');
 assert.doesNotMatch(JSON.stringify(row),/USD|1\.1/);
});
test('failed and timeout attempts retain measured status but never log raw errors or private payloads',async()=>{
 for(const error of [Object.assign(new Error('TOKEN PRIVATE'),{httpStatus:503}),Object.assign(new Error('TOKEN PRIVATE'),{name:'TimeoutError'}),new Error('TOKEN PRIVATE')]){
  let row;const measured=await measureEcbAttempt({source,operation:async()=>{throw error;},persist:async value=>{row=value;return{};},...clocks()});
  assert.equal(measured.days,null);assert.equal(measured.error,error);assert.equal(row.status,'failed');assert.equal(row.output_summary.validatedDays,0);
  assert.equal(row.output_summary.httpStatus,error.httpStatus??null);assert.doesNotMatch(JSON.stringify(row),/TOKEN|PRIVATE/);
 }
});
test('persistence failure cannot destroy reference data or claim history was stored',async()=>{
 for(const persist of [async()=>({error:{message:'DB PRIVATE'}}),async()=>{throw Error('DB PRIVATE');}]){
  const measured=await measureEcbAttempt({source,operation:async()=>({days,httpStatus:200}),persist,...clocks()});
  assert.equal(measured.persisted,false);assert.equal(measured.days,days);assert.doesNotMatch(JSON.stringify(measured.row),/DB PRIVATE/);
 }
});
test('unapproved source is rejected before any network operation or persistence',async()=>{
 let called=false;await assert.rejects(()=>measureEcbAttempt({source:'https://foreign.example?token=PRIVATE',operation:async()=>{called=true;},persist:async()=>{called=true;}}),/Unsupported/);assert.equal(called,false);
});
test('ingestion checks rights and cache before measuring, uses existing privileged jobs storage',async()=>{
 const code=await readFile(new URL('../supabase/functions/qelly-provider-ingestion/index.ts',import.meta.url),'utf8');
 assert.ok(code.indexOf('PROVIDER_RIGHTS_NOT_ESTABLISHED')<code.indexOf('const measured=await measureEcbAttempt'));
 assert.ok(code.indexOf('if(shouldReuseEcbDailyCache')<code.indexOf('const measured=await measureEcbAttempt'));
 assert.match(code,/admin\.from\("qelly_runtime_jobs"\)\.insert\(row\)\.abortSignal\(signal\)/);
 assert.match(code,/measurementPersisted:measured\.persisted/);
});
