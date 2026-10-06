import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {probeEcbHealth,ECB_PROBE_SOURCE} from '../supabase/functions/qelly-provider-ingestion/health-probe.mjs';
const days=[{date:'2026-10-05',observedAt:'2026-10-05T00:00:00Z',rates:{USD:1.1}}];
test('one probe performs one approved HTTP operation and persists one actual attempt without publishing rate payloads',async()=>{
 let calls=0,persisted=[];
 const probe=await probeEcbHealth({fetchDaily:async source=>{assert.equal(source,ECB_PROBE_SOURCE);calls++;return{days,httpStatus:200};},persist:async(row,signal)=>{assert.ok(signal instanceof AbortSignal);persisted.push(row);return{};}});
 assert.equal(calls,1);assert.equal(persisted.length,1);assert.equal(persisted[0].status,'succeeded');assert.equal(probe.status,200);
 assert.equal(probe.body.referenceDate,'2026-10-05');assert.equal(probe.body.observationTime,null);assert.equal(probe.body.observationTimePrecision,'date');
 assert.equal(probe.body.cacheUpdated,false);assert.equal(probe.body.timeseriesPointsWritten,0);assert.doesNotMatch(JSON.stringify(probe.body),/USD|rates|1\.1|quota|availability/i);
});
test('network/schema failure is measured once and remains an unavailable probe without raw error disclosure',async()=>{
 let rows=[];const probe=await probeEcbHealth({fetchDaily:async()=>{throw Object.assign(Error('PRIVATE TOKEN'),{httpStatus:503});},persist:async row=>{rows.push(row);return{};}});
 assert.equal(rows.length,1);assert.equal(rows[0].status,'failed');assert.equal(probe.status,503);assert.equal(probe.body.error,'PROVIDER_PROBE_FAILED');assert.equal(probe.body.referenceDate,null);
 assert.doesNotMatch(JSON.stringify([rows,probe]),/PRIVATE|TOKEN/);
});
test('a successful HTTP response cannot claim stored measurements when persistence fails',async()=>{
 const probe=await probeEcbHealth({fetchDaily:async()=>({days,httpStatus:200}),persist:async()=>({error:{message:'PRIVATE DB'}})});
 assert.equal(probe.status,503);assert.equal(probe.body.measurementPersisted,false);assert.equal(probe.body.error,'PROVIDER_MEASUREMENT_PERSIST_FAILED');assert.doesNotMatch(JSON.stringify(probe),/PRIVATE|DB/);
});
test('invalid or absent reference date cannot inherit a database date-slot clock',async()=>{
 for(const date of [undefined,'2026-02-30','2026-13-01','9999-12-31']){
  const probe=await probeEcbHealth({fetchDaily:async()=>({days:[{date,observedAt:'2026-10-05T00:00:00Z'}],httpStatus:200}),persist:async()=>({})});
  assert.equal(probe.body.referenceDate,null);assert.equal(probe.body.observationTime,null);assert.equal(probe.body.observationTimePrecision,'unavailable');
  assert.equal(probe.status,503);assert.equal(probe.body.attemptStatus,'failed');
 }
});
test('scheduled probe retains method/key/registry gates and does not replace ingestion or grant public access',async()=>{
 const code=await readFile(new URL('../supabase/functions/qelly-provider-ingestion/index.ts',import.meta.url),'utf8');
 const branch=code.indexOf('if(action==="probe")');
 for(const marker of ['METHOD_NOT_ALLOWED','INTERNAL_INGESTION_AUTH_REQUIRED','PROVIDER_RIGHTS_NOT_ESTABLISHED'])assert.ok(code.indexOf(marker)<branch);
 const sql=await readFile(new URL('../supabase/migrations/20261006011000_qelly_prospective_ecb_health_probe_v1.sql',import.meta.url),'utf8');
 assert.match(sql,/'25 \*\/6 \* \* \*'/);assert.ok(24/6*7>=20);assert.match(sql,/qelly_internal_scheduler_key/);assert.match(sql,/timeout_milliseconds := 12000/);
 assert.doesNotMatch(sql,/cron\.(?:unschedule|alter_job)|grant\s|qelly-ecb-provider-ingestion/i);
});
