import {ecbReferenceDate} from './measured-attempt.mjs';
export const HEALTH_LIMIT=200;
export const HEALTH_WINDOW_MS=7*24*60*60*1000;
const SOURCES=new Set(['https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml','https://www.ecb.europa.eu/stats/eurofxref/eurofxref-hist-90d.xml']);
const percentile=(sorted,p)=>sorted.length>=20?sorted[Math.ceil(sorted.length*p)-1]:null;

// This is a bounded sample of stored HTTP/schema attempts, not provider uptime.
export function summarizeEcbAttempts(rows,{now=new Date(),truncated=false}={}){
 const end=now.getTime(),start=end-HEALTH_WINDOW_MS;
 if(!Number.isFinite(end)||!Array.isArray(rows))throw new TypeError('Invalid measurement window');
 const valid=rows.filter(row=>{
  const begin=Date.parse(row.started_at),finish=Date.parse(row.finished_at);
  const input=row.input_summary||{},output=row.output_summary||{};
  return ['succeeded','failed'].includes(row.status)&&Number.isFinite(begin)&&Number.isFinite(finish)&&begin<=finish&&finish>=start&&finish<=end&&
   input.provider==='ecb'&&input.instrumentationVersion==='ecb-http-attempt-v1'&&SOURCES.has(input.source)&&
   output.measurementScope==='edge-http-and-schema-validation'&&output.referenceOnly===true;
 }).sort((a,b)=>Date.parse(b.finished_at)-Date.parse(a.finished_at)).slice(0,HEALTH_LIMIT);
 const success=valid.filter(row=>row.status==='succeeded');
 const latencies=valid.map(row=>row.output_summary.latencyMs).filter(n=>Number.isFinite(n)&&n>=0).sort((a,b)=>a-b);
 const latest=valid[0];
 const reference=success[0]?.output_summary;
 // Older approved ECB attempts stored the reference date in a midnight slot.
 // Preserve the date, never present that slot as a precise publication clock.
 const legacyDate=typeof reference?.observationTime==='string'?reference.observationTime.slice(0,10):null;
 const date=ecbReferenceDate(reference?.referenceDate??legacyDate,now.toISOString().slice(0,10));
 return {
  provider:'ecb',scope:'stored-edge-http-and-schema-validation-attempts',referenceOnly:true,
  generatedAt:now.toISOString(),windowStart:new Date(start).toISOString(),windowEnd:now.toISOString(),
  sampleLimit:HEALTH_LIMIT,truncated:Boolean(truncated),rejectedRows:rows.length-valid.length,
  sampleCount:valid.length,successCount:success.length,failureCount:valid.length-success.length,
  state:valid.length?'MEASURED_ATTEMPTS':'UNMEASURED',
  lastAttemptAt:latest?.finished_at??null,lastAttemptStatus:latest?.status??null,lastSuccessAt:success[0]?.finished_at??null,
  lastFailureAt:valid.find(row=>row.status==='failed')?.finished_at??null,
  lastLatencyMs:latest&&Number.isFinite(latest.output_summary.latencyMs)&&latest.output_summary.latencyMs>=0?latest.output_summary.latencyMs:null,
  lastReferenceObservationAt:null,lastReferenceDate:date,referenceTimePrecision:date?'date':'unavailable',
  latency:{sampleCount:latencies.length,minimumSamples:20,method:'nearest-rank',p50Ms:percentile(latencies,.5),p90Ms:percentile(latencies,.9),p95Ms:percentile(latencies,.95)},
  quotaRemaining:null,providerWideAvailability:null,sloState:'BASELINE_NOT_ESTABLISHED',
  boundary:'Stored attempts exclude cache hits and unobserved requests. Counts describe this bounded sample only; they do not measure provider-wide uptime, quotas, execution quotes or an SLO.'
 };
}

export async function readEcbHealth(loadRows,{now=new Date()}={}){
 const start=new Date(now.getTime()-HEALTH_WINDOW_MS).toISOString(),end=now.toISOString();
 const result=await loadRows({start,end,limit:HEALTH_LIMIT+1,signal:AbortSignal.timeout(3000)});
 if(result?.error||!Array.isArray(result?.data))throw new Error('PROVIDER_MEASUREMENTS_UNAVAILABLE');
 return summarizeEcbAttempts(result.data.slice(0,HEALTH_LIMIT),{now,truncated:result.data.length>HEALTH_LIMIT});
}
