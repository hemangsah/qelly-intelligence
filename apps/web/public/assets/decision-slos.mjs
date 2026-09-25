const POLICY=Object.freeze({
  decisionLatencyP95Ms:{target:3000,minSamples:20,comparison:'lte',source:'bounded Decision client latency'},
  scannerLatencyP95Ms:{target:4500,minSamples:20,comparison:'lte',source:'bounded scanner client latency'},
  providerFailureRate:{target:.10,minSamples:10,comparison:'lte',source:'per-provider observed attempts'},
  staleEvidenceRate:{target:.10,minSamples:50,comparison:'lte',source:'observed evidence states'},
  routeErrorRate:{target:.02,minSamples:20,comparison:'lte',source:'Decision + scanner observations'},
  widgetErrorRate:{target:.02,minSamples:20,comparison:'lte',source:'Decision + scanner observations'},
  memoryAnomalies:{target:0,minSamples:10,comparison:'lte',source:'captured route samples'},
  lcpMs:{target:2500,minSamples:1,comparison:'lte',source:'Web Vitals LCP'},
  inpMs:{target:200,minSamples:1,comparison:'lte',source:'Web Vitals INP'},
  cls:{target:.10,minSamples:1,comparison:'lte',source:'Web Vitals CLS'},
  repeatedLongTasks:{target:0,minSamples:10,comparison:'lte',source:'captured route samples'}
});

const round=(value,digits=4)=>Number.isFinite(Number(value))?Number(Number(value).toFixed(digits)):null;
const safeRate=(numerator,denominator)=>denominator>0?Number(numerator||0)/denominator:null;
const evaluate=(name,{value=null,sampleSize=0,available=true,reason=null}={})=>{
  const policy=POLICY[name];
  if(!policy)return {name,state:'UNAVAILABLE',value:null,sampleSize:0,target:null,reason:'Unknown SLO metric.'};
  if(!available||!Number.isFinite(Number(value)))return {
    name,state:'UNAVAILABLE',value:null,sampleSize:Number(sampleSize)||0,target:policy.target,minSamples:policy.minSamples,
    comparison:policy.comparison,source:policy.source,reason:reason||'Metric has not been observed.'
  };
  const n=Math.max(0,Number(sampleSize)||0);
  if(n<policy.minSamples)return {
    name,state:'INSUFFICIENT_SAMPLE',value:round(value),sampleSize:n,target:policy.target,minSamples:policy.minSamples,
    comparison:policy.comparison,source:policy.source,reason:'Minimum measurement sample has not been reached.'
  };
  const pass=policy.comparison==='lte'?Number(value)<=policy.target:Number(value)>=policy.target;
  return {
    name,state:pass?'PASS':'VIOLATION',value:round(value),sampleSize:n,target:policy.target,minSamples:policy.minSamples,
    comparison:policy.comparison,source:policy.source,reason:pass?'Measured objective is within the formal target.':'Measured objective exceeds the formal target.'
  };
};
const providerSlo=(name,observations,failures)=>{
  const sampleSize=Math.max(0,Number(observations)||0);
  return evaluate('providerFailureRate',{
    value:safeRate(Number(failures)||0,sampleSize),
    sampleSize,
    available:sampleSize>0,
    reason:'No provider attempts have been observed.'
  });
};

export function evaluateDecisionSlos(snapshot={}){
  const decisions=Math.max(0,Number(snapshot?.decision?.observations)||0);
  const scans=Math.max(0,Number(snapshot?.decision?.scanRuns)||0);
  const exposures=decisions+scans;
  const routeSamples=Math.max(0,Number(snapshot?.browser?.routeSampleCount)||0);
  const webVitals=snapshot?.browser?.webVitals||{};
  const reliability=snapshot?.reliability||{};
  const providerObservations=reliability.providerObservations||{};
  const providerFailureCounts=reliability.providerFailureCounts||{};
  const providerKeys=[...new Set([...Object.keys(providerObservations),...Object.keys(providerFailureCounts)])].sort();
  const providers=Object.fromEntries(providerKeys.map(key=>[key,providerSlo(key,providerObservations[key],providerFailureCounts[key])]));

  const objectives={
    decisionLatencyP95Ms:evaluate('decisionLatencyP95Ms',{
      value:snapshot?.latency?.decision?.p95Ms,
      sampleSize:snapshot?.latency?.decision?.sampleSize,
      available:Number.isFinite(Number(snapshot?.latency?.decision?.p95Ms))
    }),
    scannerLatencyP95Ms:evaluate('scannerLatencyP95Ms',{
      value:snapshot?.latency?.scanner?.p95Ms,
      sampleSize:snapshot?.latency?.scanner?.sampleSize,
      available:Number.isFinite(Number(snapshot?.latency?.scanner?.p95Ms))
    }),
    staleEvidenceRate:evaluate('staleEvidenceRate',{
      value:reliability.staleEvidenceRate,
      sampleSize:reliability.observedEvidenceCount,
      available:Number.isFinite(Number(reliability.staleEvidenceRate))
    }),
    routeErrorRate:evaluate('routeErrorRate',{
      value:safeRate(reliability.routeErrors,exposures),sampleSize:exposures,available:exposures>0
    }),
    widgetErrorRate:evaluate('widgetErrorRate',{
      value:safeRate(reliability.widgetErrors,exposures),sampleSize:exposures,available:exposures>0
    }),
    memoryAnomalies:evaluate('memoryAnomalies',{
      value:snapshot?.browser?.memoryAnomalies,sampleSize:routeSamples,available:routeSamples>0
    }),
    lcpMs:evaluate('lcpMs',{
      value:webVitals.lcpMs,sampleSize:Number.isFinite(Number(webVitals.lcpMs))?1:0,available:Number.isFinite(Number(webVitals.lcpMs))
    }),
    inpMs:evaluate('inpMs',{
      value:webVitals.inpMs,sampleSize:Number.isFinite(Number(webVitals.inpMs))?1:0,available:Number.isFinite(Number(webVitals.inpMs))
    }),
    cls:evaluate('cls',{
      value:webVitals.cls,sampleSize:Number.isFinite(Number(webVitals.cls))?1:0,available:Number.isFinite(Number(webVitals.cls))
    }),
    repeatedLongTasks:evaluate('repeatedLongTasks',{
      value:snapshot?.browser?.longTasksOverRepeated,sampleSize:routeSamples,available:routeSamples>0
    })
  };

  const flat=[...Object.values(objectives),...Object.values(providers)];
  const violations=flat.filter(item=>item.state==='VIOLATION');
  const pending=flat.filter(item=>['INSUFFICIENT_SAMPLE','UNAVAILABLE'].includes(item.state));
  const passes=flat.filter(item=>item.state==='PASS');
  const state=violations.length?'VIOLATION':pending.length?'OBSERVING':'PASS';
  return {
    schemaVersion:'qelly.decision-slo-evaluation/1.0.0',
    state,
    certified:state==='PASS',
    policyVersion:'qelly.decision-slo-policy/1.0.0',
    objectives,
    providers,
    summary:{pass:passes.length,violation:violations.length,pending:pending.length,total:flat.length},
    measurementBoundary:'SLO status is computed only from privacy-safe BM observations. INSUFFICIENT_SAMPLE and UNAVAILABLE never count as PASS.',
    latencyBoundary:'Decision/scanner targets were set from measured pre-BN external baselines and require bounded in-product samples before certification.',
    providerBoundary:'Provider failure objectives use explicit per-provider observation denominators; absent providers are UNAVAILABLE, never assumed healthy.',
    scientificBoundary:'These are operational service objectives, not trading-performance, target-touch, calibration, expected-value or profitability claims.'
  };
}

export const decisionSloPolicy=()=>JSON.parse(JSON.stringify(POLICY));

if(typeof globalThis.window==='object'){
  Object.defineProperty(globalThis.window,'__QELLY_DECISION_SLOS__',{
    configurable:true,
    value:Object.freeze({evaluate:evaluateDecisionSlos,policy:decisionSloPolicy})
  });
}

export const __decisionSloTest=Object.freeze({POLICY,evaluate,providerSlo,safeRate});
