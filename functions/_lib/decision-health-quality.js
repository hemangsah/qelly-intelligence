const finite=(value)=>{if(value==null||value==='')return null;const n=Number(value);return Number.isFinite(n)?n:null;};
const clamp=(value,min=0,max=1)=>Math.min(max,Math.max(min,Number(value)||0));
const round=(value,digits=4)=>Number.isFinite(Number(value))?Number(Number(value).toFixed(digits)):null;
const mean=(values)=>{const xs=values.filter(Number.isFinite);return xs.length?xs.reduce((a,b)=>a+b,0)/xs.length:null;};

const freshnessScore=(truth)=>{
  const state=String(truth||'UNAVAILABLE').toUpperCase();
  return state==='LIVE'?1:state==='DELAYED'?.78:state==='STALE'?.35:state==='DEGRADED'?.2:0;
};

const providerStateScore=(value)=>{
  const state=String(value||'unavailable').toLowerCase();
  if(['live','available','no-matches','not-requested'].includes(state))return 1;
  if(['pending','partial'].includes(state))return .65;
  if(['stale','delayed'].includes(state))return .45;
  return 0;
};

const scenarioConsistency=(graph)=>{
  const p=graph?.forecast?.probabilities||{};
  const values=[finite(p.bull),finite(p.base),finite(p.bear)];
  if(values.some(v=>v===null||v<0||v>1))return 0;
  return Math.abs(values.reduce((a,b)=>a+b,0)-1)<=.001?1:0;
};

const timeframeConsistency=(multiTimeframe)=>{
  const views=Array.isArray(multiTimeframe?.views)?multiTimeframe.views:[];
  if(!views.length)return 0;
  const intervals=views.map(v=>String(v?.interval||'')).filter(Boolean);
  const unique=new Set(intervals);
  return unique.size===intervals.length?1:0;
};

const timestampConsistency=(graph)=>{
  const observed=Date.parse(graph?.observedAt||'');
  const generated=Date.parse(graph?.generatedAt||'');
  const age=finite(graph?.freshness?.ageMs);
  if(!Number.isFinite(observed)||!Number.isFinite(generated)||generated<observed)return 0;
  if(age!==null&&age<0)return 0;
  return 1;
};

const connectedCapabilityStates=(evidence={})=>({
  liquidity:String(evidence?.liquidity?.state||'unavailable').toLowerCase(),
  derivatives:String(evidence?.derivatives?.state||'unavailable').toLowerCase(),
  news:String(evidence?.news?.state||'unavailable').toLowerCase(),
  crossAsset:String(evidence?.crossAsset?.state||'unavailable').toLowerCase(),
  macro:String(evidence?.macro?.state||'unavailable').toLowerCase(),
  eventRisk:String(evidence?.eventRisk?.state||'unavailable').toLowerCase(),
  liquidations:String(evidence?.liquidations?.state||'unavailable').toLowerCase(),
  options:String(evidence?.options?.state||'unavailable').toLowerCase(),
  onChain:String(evidence?.onChain?.state||'unavailable').toLowerCase()
});

export function buildDecisionDataQuality({graph,multiTimeframe,evidence={},providerResilience={}}={}){
  const truthScore=freshnessScore(graph?.truthState);
  const quantScore=graph?.quant?.state==='DERIVED'?1:0;
  const historyDepth=clamp((Number(graph?.market?.points)||0)/240);
  const mtfTotal=Math.max(0,Number(multiTimeframe?.agreement?.total)||0);
  const mtfCoverage=clamp(mtfTotal/4);
  const criticalCoverage=round(mean([truthScore>0?1:0,quantScore,historyDepth,mtfCoverage]),3);

  const observed=providerResilience?.observed||{};
  const providerScores=[
    1, // core selected-candle request necessarily succeeded if this response exists.
    providerStateScore(observed?.liquidity?.state??evidence?.liquidity?.state),
    providerStateScore(observed?.derivatives?.state??evidence?.derivatives?.state),
    providerStateScore(observed?.news?.state??evidence?.news?.state),
    providerStateScore(observed?.macro?.state??evidence?.macro?.state)
  ];
  const providerHealth=round(mean(providerScores),3);

  const consistencyChecks={
    timestamps:timestampConsistency(graph),
    scenarioProbabilityMass:scenarioConsistency(graph),
    timeframeIdentity:timeframeConsistency(multiTimeframe)
  };
  const consistency=round(mean(Object.values(consistencyChecks)),3);

  const states=connectedCapabilityStates(evidence);
  const missingCapabilities=Object.entries(states).filter(([,state])=>['unavailable','not_connected','error'].includes(state)).map(([key])=>key);
  const unavailableCount=missingCapabilities.length;
  const missingnessRatio=round(unavailableCount/Object.keys(states).length,3);

  const weights=Object.freeze({criticalCoverage:.35,freshness:.25,providerHealth:.20,consistency:.20});
  const contributions={
    criticalCoverage:round(weights.criticalCoverage*(criticalCoverage??0),4),
    freshness:round(weights.freshness*truthScore,4),
    providerHealth:round(weights.providerHealth*(providerHealth??0),4),
    consistency:round(weights.consistency*(consistency??0),4)
  };
  const score=round(Object.values(contributions).reduce((sum,v)=>sum+(finite(v)??0),0),3);
  const criticalReady=truthScore>=.78&&quantScore===1&&historyDepth>=.5;
  const state=score>=.85?'HIGH':score>=.70?'ADEQUATE':score>=.50?'DEGRADED':'INSUFFICIENT';

  return {
    schemaVersion:'qelly.decision-data-quality/1.0.0',
    state,
    score,
    weights,
    components:{
      criticalCoverage:{score:criticalCoverage,contribution:contributions.criticalCoverage,detail:{marketTruth:round(truthScore>0?1:0,3),quantDerived:quantScore,historyDepth:round(historyDepth,3),multiTimeframeCoverage:round(mtfCoverage,3)}},
      freshness:{score:round(truthScore,3),contribution:contributions.freshness,truthState:String(graph?.truthState||'UNAVAILABLE')},
      providerHealth:{score:providerHealth,contribution:contributions.providerHealth,observed:providerResilience?.observed||null},
      consistency:{score:consistency,contribution:contributions.consistency,checks:consistencyChecks}
    },
    missingness:{
      state:unavailableCount===0?'COMPLETE':unavailableCount<=3?'PARTIAL':'SPARSE',
      unavailableCount,totalCapabilities:Object.keys(states).length,ratio:missingnessRatio,
      unavailableCapabilities:missingCapabilities,capabilityStates:states,
      scoringBoundary:'Context-only capability missingness is disclosed separately and is not double-counted inside the composite score.'
    },
    conflict:{
      state:'NOT_SCORED_FROM_DIRECTIONAL_DISAGREEMENT',
      count:0,
      boundary:'Market-view contradictions and multi-timeframe directional disagreement are evidence semantics, not data-integrity conflicts, and are intentionally excluded from data-quality scoring.'
    },
    eligibility:{
      criticalReady,
      impact:criticalReady?'NO_ADDITIONAL_BLOCK':'FAIL_CLOSED',
      criticalChecks:{freshnessAtLeastDelayed:truthScore>=.78,quantDerived:quantScore===1,historyDepthAtLeastHalf:historyDepth>=.5},
      boundary:'The numeric data-quality score is diagnostic. Eligibility fails closed only on explicit critical-input checks; optional contextual-provider absence does not create direction.'
    },
    boundary:'Data quality measures current input integrity only. It is separate from evidence confidence, model calibration, scenario certainty and directional conviction.'
  };
}

export function applyDecisionDataQualityEligibility(graph,dataQuality){
  const action=String(graph?.qellyView?.action||'NO TRADE').toUpperCase();
  if(dataQuality?.eligibility?.criticalReady!==false||!['BUY','SELL'].includes(action))return graph;
  const contradictions=[...(Array.isArray(graph?.qellyView?.contradictions)?graph.qellyView.contradictions:[])];
  const message='Directional setup is withheld because one or more critical data-quality checks are not satisfied.';
  if(!contradictions.includes(message))contradictions.push(message);
  return {
    ...graph,
    qellyView:{
      ...graph.qellyView,
      action:'NO TRADE',
      levels:null,
      contradictions,
      label:'Critical data quality does not clear the directional research threshold.',
      changesIf:'Reassess when verified market freshness, quantitative derivation and sufficient history are restored.'
    }
  };
}

const unmeasured=(dimension,reason)=>({dimension,state:'UNMEASURED',value:null,baseline:null,reason});

export function buildDecisionModelHealth({graph,dataQuality,providerResilience={}}={}){
  const calibration=graph?.quant?.calibration||{};
  const reason='No privacy-safe longitudinal Decision telemetry baseline is connected to this public request path yet.';
  const drift={
    calibration:unmeasured('calibration_drift',reason),
    provider:unmeasured('provider_drift',reason),
    missingness:unmeasured('missingness_drift',reason),
    setupFrequency:unmeasured('setup_frequency_drift','No resolved setup-history baseline exists in the public Decision runtime.'),
    noTradeRate:unmeasured('no_trade_rate_drift','No longitudinal Decision-action baseline exists in the public Decision runtime.'),
    assetConcentration:unmeasured('asset_concentration','No longitudinal Decision-action baseline exists in the public Decision runtime.'),
    regimeConcentration:unmeasured('regime_concentration','No longitudinal Decision-regime baseline exists in the public Decision runtime.'),
    probabilityDistribution:unmeasured('probability_distribution_drift','No longitudinal scenario-distribution baseline exists in the public Decision runtime.')
  };
  const providerObserved=providerResilience?.observed||{};
  const providerUnavailable=Object.entries(providerObserved).filter(([,v])=>String(v?.state||'unavailable').toLowerCase()==='unavailable').map(([k])=>k);
  const state=calibration.eligible===true&&dataQuality?.state==='HIGH'?'CURRENT_SNAPSHOT_HEALTHY':'CURRENT_SNAPSHOT_LIMITED';
  return {
    schemaVersion:'qelly.decision-model-health/1.0.0',
    state,
    current:{
      calibration:{state:String(calibration.state||'UNCALIBRATED'),eligible:calibration.eligible===true,sampleSize:Number(calibration.sampleSize)||0,minimumSampleGate:Number(calibration.minimumSampleGate)||36,brierScore:finite(calibration.brierScore),reliabilityGap:finite(calibration.reliabilityGap)},
      dataQuality:{state:dataQuality?.state||'UNAVAILABLE',score:finite(dataQuality?.score),criticalReady:dataQuality?.eligibility?.criticalReady===true},
      providers:{unavailable:providerUnavailable,observed:providerObserved},
      decisionAction:String(graph?.qellyView?.action||'NO TRADE'),
      regime:String(graph?.quant?.regime||'UNKNOWN'),
      scenario:graph?.forecast?.probabilities||null
    },
    drift,
    driftReadiness:{
      state:'BASELINE_UNAVAILABLE',
      persistentDecisionTelemetryConnected:false,
      historicalOutcomeBaselineConnected:false,
      currentSnapshotComparable:false,
      boundary:'A single current snapshot cannot establish drift. Drift dimensions remain UNMEASURED until privacy-safe longitudinal telemetry and minimum history requirements exist.'
    },
    boundary:'Model health reports current calibration/provider/data-quality state separately from longitudinal drift. It never invents drift from one snapshot or converts health into directional confidence.'
  };
}

export const __decisionHealthQualityTest=Object.freeze({freshnessScore,providerStateScore,scenarioConsistency,timeframeConsistency,timestampConsistency,connectedCapabilityStates});
