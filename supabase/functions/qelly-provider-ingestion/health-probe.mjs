import {measureEcbAttempt,ecbReferenceDate} from './measured-attempt.mjs';
export const ECB_PROBE_SOURCE='https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml';

// One actual HTTP/schema attempt, without changing cached rates or ingesting
// points. Registry rights and scheduler authorization belong to the caller.
export async function probeEcbHealth({fetchDaily,persist,clock,wallClock}){
 const latestAllowedDate=(wallClock?.()??new Date()).toISOString().slice(0,10);
 const measured=await measureEcbAttempt({source:ECB_PROBE_SOURCE,operation:async()=>{
  const result=await fetchDaily(ECB_PROBE_SOURCE);
  if(!ecbReferenceDate(result?.days?.at(-1)?.date,latestAllowedDate))throw new Error('Invalid ECB reference date');
  return result;
 },persist,...(clock?{clock}:{}),...(wallClock?{wallClock}:{})});
 const date=ecbReferenceDate(measured.days?.at(-1)?.date,latestAllowedDate);
 const ok=Boolean(measured.days)&&measured.persisted;
 return {status:ok?200:503,body:{ok,provider:'ecb',measurementScope:'edge-http-and-schema-validation',measurementPersisted:measured.persisted,attemptStatus:measured.row.status,referenceDate:date,observationTime:null,observationTimePrecision:date?'date':'unavailable',referenceOnly:true,cacheUpdated:false,timeseriesPointsWritten:0,...(!ok?{error:measured.error?'PROVIDER_PROBE_FAILED':'PROVIDER_MEASUREMENT_PERSIST_FAILED'}:{})}};
}
