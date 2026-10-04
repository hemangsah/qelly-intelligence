const SOURCES=new Set([
 'https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml',
 'https://www.ecb.europa.eu/stats/eurofxref/eurofxref-hist-90d.xml'
]);
const status=value=>Number.isInteger(value)&&value>=100&&value<=599?value:null;

// One record means one actual HTTP + schema-validation attempt, never a cache
// read or a provider-wide health/SLO estimate. No response bodies or tokens.
export async function measureEcbAttempt({source,operation,persist,clock=()=>performance.now(),wallClock=()=>new Date()}){
 if(!SOURCES.has(source))throw new TypeError('Unsupported ECB measurement source');
 const startedAt=wallClock().toISOString(),start=clock();
 let result=null,error=null;
 try{result=await operation();}catch(caught){error=caught;}
 const elapsed=clock()-start,finishedAt=wallClock().toISOString();
 const days=Array.isArray(result?.days)?result.days:null;
 const succeeded=!error&&days?.length>0;
 const row={
  subsystem:'provider-ingestion',job_type:'ecb-http-attempt',
  status:succeeded?'succeeded':'failed',truth_state:succeeded?'delayed':'error',
  started_at:startedAt,finished_at:finishedAt,
  input_summary:{provider:'ecb',source,instrumentationVersion:'ecb-http-attempt-v1'},
  output_summary:{
   measurementScope:'edge-http-and-schema-validation',
   latencyMs:Number.isFinite(elapsed)&&elapsed>=0?Math.round(elapsed):null,
   httpStatus:status(result?.httpStatus??error?.httpStatus),
   validatedDays:succeeded?days.length:0,
   observationTime:succeeded?days.at(-1)?.observedAt??null:null,
   referenceOnly:true,quotaRemaining:null,providerWideAvailability:null
  },
  error_summary:succeeded?{}:{code:error?.name==='TimeoutError'||error?.name==='AbortError'?'upstream_timeout':status(error?.httpStatus)?'upstream_http_failure':'source_read_or_schema_failure'}
 };
 let persisted=false;
 try{const receipt=await persist(row,AbortSignal.timeout(3000));persisted=!receipt?.error;}catch{ /* Telemetry failure must not discard genuine reference data. */ }
 return {days:succeeded?days:null,error,row,persisted};
}
