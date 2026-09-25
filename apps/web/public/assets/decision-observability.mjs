import {runtimePerformanceSnapshot} from './runtime-performance-observer.mjs';

const MAX_LATENCY_SAMPLES=64;
const MAX_PROVIDER_SAMPLES=64;
const PROVIDER_COMPONENTS=Object.freeze({
  candleFetch:'hyperliquid_candles',
  liquidity:'hyperliquid_liquidity',
  fundingHistory:'hyperliquid_funding',
  multiTimeframe:'hyperliquid_mtf',
  crossAssetBenchmark:'hyperliquid_cross_asset',
  derivatives:'hyperliquid_derivatives',
  macro:'ecb_macro',
  news:'gdelt_news'
});

const state={
  installed:false,
  decisionLatencies:[],
  scannerLatencies:[],
  providerLatency:{},
  providerFailures:{},
  providerObservations:{},
  providerFailureCounts:{},
  counters:{
    decisions:0,
    scans:0,
    noTrade:0,
    eligibleDecision:0,
    eligibleScanner:0,
    staleEvidence:0,
    observedEvidence:0,
    decisionFailures:0,
    scannerFailures:0,
    routeErrors:0,
    widgetErrors:0,
    memoryAnomalies:0
  },
  rrSelections:{},
  calibrationStates:{},
  targetTouch:{state:'UNAVAILABLE',sampleSize:0,minimumSampleGate:null,observedSetups:0}
};

const now=()=>globalThis.performance?.now?.()??Date.now();
const boundedPush=(list,value,max)=>{if(!Number.isFinite(Number(value)))return;list.push(Number(value));if(list.length>max)list.splice(0,list.length-max);};
const increment=(object,key,count=1)=>{const safe=String(key||'unknown').toLowerCase().replace(/[^a-z0-9_.:-]+/g,'_').slice(0,64)||'unknown';object[safe]=(object[safe]||0)+Math.max(0,Number(count)||0);};
const round=(value,digits=2)=>Number.isFinite(Number(value))?Number(Number(value).toFixed(digits)):null;
const quantile=(values,p)=>{
  const sorted=(Array.isArray(values)?values:[]).filter(Number.isFinite).sort((a,b)=>a-b);
  if(!sorted.length)return null;
  const index=(sorted.length-1)*p,low=Math.floor(index),weight=index-low;
  return sorted[low]+((sorted[low+1]??sorted[low])-sorted[low])*weight;
};
const summarizeLatency=(values)=>({
  sampleSize:values.length,
  p50Ms:round(quantile(values,.5),1),
  p90Ms:round(quantile(values,.9),1),
  p95Ms:round(quantile(values,.95),1),
  maxMs:round(values.length?Math.max(...values):null,1)
});
const durationBucket=(value)=>{
  const n=Number(value);
  if(!Number.isFinite(n))return'unknown';
  if(n<500)return'lt_500ms';
  if(n<1000)return'500_999ms';
  if(n<2000)return'1000_1999ms';
  if(n<4000)return'2000_3999ms';
  return'gte_4000ms';
};
const sampleBucket=(value)=>{
  const n=Math.max(0,Number(value)||0);
  if(n===0)return'zero';
  if(n<10)return'lt_10';
  if(n<25)return'10_24';
  if(n<50)return'25_49';
  return'gte_50';
};
const emitSignal=(detail)=>{
  if(typeof globalThis.document?.dispatchEvent!=='function'||typeof globalThis.CustomEvent!=='function')return;
  globalThis.document.dispatchEvent(new CustomEvent('qelly:runtime-signal',{detail}));
};
const evidenceEntries=(data)=>Object.values(data?.evidence||{}).filter(item=>item&&typeof item==='object');
const evidenceIsStale=(item)=>String(item?.state||'').toLowerCase()==='stale'||item?.cache?.stale===true;
const providerFailure=(value)=>{
  const stateValue=String(value?.state||'').toLowerCase();
  return ['failed','failure','unavailable','error','timeout'].includes(stateValue);
};
const recordProviderLatency=(data)=>{
  const components=data?.performance?.components||{};
  const observed=data?.providerResilience?.observed||{};
  for(const [key,label] of Object.entries(PROVIDER_COMPONENTS)){
    const component=components?.[key];
    const provider=observed?.[key];
    const ms=Number(component?.ms);
    if(Number.isFinite(ms)){
      state.providerLatency[label]??=[];
      boundedPush(state.providerLatency[label],ms,MAX_PROVIDER_SAMPLES);
    }
    if(component||provider){
      increment(state.providerObservations,label);
      const failed=providerFailure(provider)||providerFailure(provider?.health)||(component&&String(component.state||'').toLowerCase()!=='ok');
      if(failed)increment(state.providerFailureCounts,label);
    }
  }
  for(const [key,value] of Object.entries(observed))if(providerFailure(value)||providerFailure(value?.health))increment(state.providerFailures,key);
  for(const [key,value] of Object.entries(components))if(value&&String(value.state||'').toLowerCase()!=='ok')increment(state.providerFailures,key);
};
const install=()=>{
  if(state.installed)return;
  state.installed=true;
  if(typeof globalThis.document?.addEventListener==='function'){
    globalThis.document.addEventListener('qelly:runtime-signal',(event)=>{
      const detail=event?.detail||{};
      if(detail.action==='failure'&&['widget','embed'].includes(String(detail.surface||'').toLowerCase()))state.counters.widgetErrors+=1;
      if(detail.feature==='main_thread'&&detail.action==='memory_pressure')state.counters.memoryAnomalies+=1;
    },{passive:true});
  }
  if(typeof globalThis.window?.addEventListener==='function'){
    globalThis.window.addEventListener('error',()=>{state.counters.routeErrors+=1;},{passive:true});
    globalThis.window.addEventListener('unhandledrejection',()=>{state.counters.routeErrors+=1;},{passive:true});
  }
};
const recordFreshness=(data)=>{
  const entries=evidenceEntries(data);
  state.counters.observedEvidence+=entries.length;
  state.counters.staleEvidence+=entries.filter(evidenceIsStale).length;
};
const safeRate=(numerator,denominator)=>denominator>0?round(numerator/denominator,4):null;

export function startDecisionObservation(){
  install();
  return now();
}

export function recordDecisionObservation({startedAt,data,rrState='unknown',failed=false}={}){
  install();
  const durationMs=Math.max(0,now()-Number(startedAt||now()));
  boundedPush(state.decisionLatencies,durationMs,MAX_LATENCY_SAMPLES);
  state.counters.decisions+=1;
  increment(state.rrSelections,rrState);
  if(failed){
    state.counters.decisionFailures+=1;
    emitSignal({feature:'decision_latency',action:'observe',state:durationBucket(durationMs),surface:'api'});
    return decisionObservabilitySnapshot();
  }
  const tradeStatus=String(data?.tradeResearch?.status||'').toUpperCase();
  if(tradeStatus==='NO_TRADE')state.counters.noTrade+=1;
  if(data?.qellyView?.evidenceGate?.directionalEligible===true)state.counters.eligibleDecision+=1;
  increment(state.calibrationStates,data?.quant?.calibration?.state||'UNCALIBRATED');
  recordFreshness(data);
  recordProviderLatency(data);
  emitSignal({feature:'decision_latency',action:'observe',state:durationBucket(durationMs),surface:'api'});
  emitSignal({feature:'decision_state',action:'no_trade',state:tradeStatus==='NO_TRADE'?'yes':'no',surface:'decision'});
  return decisionObservabilitySnapshot();
}

export function recordScannerObservation({startedAt,scan,failed=false}={}){
  install();
  const durationMs=Math.max(0,now()-Number(startedAt||now()));
  boundedPush(state.scannerLatencies,durationMs,MAX_LATENCY_SAMPLES);
  state.counters.scans+=1;
  if(failed)state.counters.scannerFailures+=1;
  else state.counters.eligibleScanner+=Math.max(0,Number(scan?.eligibleCount)||0);
  emitSignal({feature:'scanner_latency',action:'observe',state:durationBucket(durationMs),surface:'api'});
  return decisionObservabilitySnapshot();
}

export function recordTargetTouchSample(ledger){
  install();
  if(!ledger||typeof ledger!=='object'){
    state.targetTouch={state:'UNAVAILABLE',sampleSize:0,minimumSampleGate:null,observedSetups:0};
    emitSignal({feature:'target_touch_sample',action:'observe',state:'unavailable',surface:'workspace'});
    return decisionObservabilitySnapshot();
  }
  const sampleSize=Math.max(0,Number(ledger.calibrationEligible)||0);
  state.targetTouch={
    state:String(ledger.calibrationState||ledger.calibration?.state||'UNCALIBRATED').toUpperCase(),
    sampleSize,
    minimumSampleGate:Number.isFinite(Number(ledger.minimumSampleGate))?Number(ledger.minimumSampleGate):null,
    observedSetups:Math.max(0,Number(ledger.observedSetups)||0)
  };
  emitSignal({feature:'target_touch_sample',action:'observe',state:sampleBucket(sampleSize),surface:'workspace'});
  return decisionObservabilitySnapshot();
}

export function decisionObservabilitySnapshot(){
  install();
  const runtime=runtimePerformanceSnapshot();
  const providerLatency=Object.fromEntries(Object.entries(state.providerLatency).map(([key,values])=>[key,summarizeLatency(values)]));
  const overNotice=(runtime.longTasks||[]).filter(item=>item?.overNotice===true).length;
  const overRepeated=(runtime.longTasks||[]).filter(item=>item?.overRepeatedBudget===true).length;
  const providerFailureRates=Object.fromEntries(Object.entries(state.providerObservations).map(([key,count])=>[key,safeRate(state.providerFailureCounts[key]||0,count)]));
  return {
    schemaVersion:'qelly.decision-observability/1.0.0',
    privacy:{
      persistence:'bounded browser memory plus coarse allowlisted analytics signals',
      containsAsset:false,
      containsPrice:false,
      containsPrompt:false,
      containsTarget:false,
      containsCustomRiskReward:false,
      containsConversation:false,
      boundary:'No secrets, identifiers, raw private conversations, prices, targets or custom R:R values are recorded by this observability snapshot.'
    },
    latency:{
      decision:summarizeLatency(state.decisionLatencies),
      scanner:summarizeLatency(state.scannerLatencies),
      providers:providerLatency,
      boundary:'Provider component durations may overlap because independent evidence providers run concurrently; provider timings are never summed to infer total Decision latency.'
    },
    reliability:{
      providerFailures:{...state.providerFailures},
      providerObservations:{...state.providerObservations},
      providerFailureCounts:{...state.providerFailureCounts},
      providerFailureRates,
      decisionFailures:state.counters.decisionFailures,
      scannerFailures:state.counters.scannerFailures,
      staleEvidenceCount:state.counters.staleEvidence,
      observedEvidenceCount:state.counters.observedEvidence,
      staleEvidenceRate:safeRate(state.counters.staleEvidence,state.counters.observedEvidence),
      routeErrors:state.counters.routeErrors,
      widgetErrors:state.counters.widgetErrors
    },
    decision:{
      observations:state.counters.decisions,
      noTradeCount:state.counters.noTrade,
      noTradeFrequency:safeRate(state.counters.noTrade,state.counters.decisions),
      directionalEligibleCount:state.counters.eligibleDecision,
      scanRuns:state.counters.scans,
      scannerEligibleSetups:state.counters.eligibleScanner,
      rrSelections:{...state.rrSelections},
      calibrationStates:{...state.calibrationStates},
      targetTouchSample:{...state.targetTouch}
    },
    browser:{
      webVitals:{...runtime.webVitals},
      routeSampleCount:Array.isArray(runtime.routes)?runtime.routes.length:0,
      longTaskCount:Array.isArray(runtime.longTasks)?runtime.longTasks.length:0,
      longTasksOverNotice:overNotice,
      longTasksOverRepeatedBudget:overRepeated,
      memoryAnomalies:state.counters.memoryAnomalies,
      externalResources:runtime.externalResources
    }
  };
}

export function resetDecisionObservabilityForTest(){
  state.decisionLatencies.length=0;
  state.scannerLatencies.length=0;
  state.providerLatency={};
  state.providerFailures={};
  state.providerObservations={};
  state.providerFailureCounts={};
  for(const key of Object.keys(state.counters))state.counters[key]=0;
  state.rrSelections={};
  state.calibrationStates={};
  state.targetTouch={state:'UNAVAILABLE',sampleSize:0,minimumSampleGate:null,observedSetups:0};
}

if(typeof globalThis.window==='object'){
  Object.defineProperty(globalThis.window,'__QELLY_DECISION_OBSERVABILITY__',{
    configurable:true,
    value:Object.freeze({snapshot:decisionObservabilitySnapshot})
  });
}

export const __decisionObservabilityTest=Object.freeze({
  MAX_LATENCY_SAMPLES,MAX_PROVIDER_SAMPLES,PROVIDER_COMPONENTS,quantile,summarizeLatency,durationBucket,sampleBucket
});
