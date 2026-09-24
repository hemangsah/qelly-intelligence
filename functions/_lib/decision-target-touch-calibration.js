const METRICS=Object.freeze([
  {key:'T1',label:'T1 before invalidation',slot:1},
  {key:'T2',label:'T2 before invalidation',slot:2},
  {key:'T3',label:'T3 before invalidation',slot:3},
  {key:'T4',label:'T4 before invalidation',slot:4},
  {key:'INVALIDATION_FIRST',label:'Invalidation before any target',slot:null}
]);
const RELIABILITY_BINS=Object.freeze([[0,.2],[.2,.4],[.4,.6],[.6,.8],[.8,1.000001]]);
const finite=(value)=>{if(value==null||value==='')return null;const number=Number(value);return Number.isFinite(number)?number:null;};
const round=(value,digits=4)=>Number.isFinite(Number(value))?Number(Number(value).toFixed(digits)):null;
const iso=(value)=>{if(value==null||value==='')return null;const time=Date.parse(value);return Number.isFinite(time)?new Date(time).toISOString():null;};
const truthy=(value)=>value===true||String(value).toLowerCase()==='true';
const mean=(values)=>values.length?values.reduce((sum,value)=>sum+value,0)/values.length:null;
const observedAt=(row)=>iso(row?.resolved_at||row?.resolvedAt||row?.updated_at||row?.updatedAt);
const rowTargets=(row)=>Array.isArray(row?.targets)?row.targets:[];
const rowMetrics=(row)=>row?.metrics&&typeof row.metrics==='object'?row.metrics:{};
const rowResolution=(row)=>row?.resolved_outcome&&typeof row.resolved_outcome==='object'?row.resolved_outcome:row?.resolvedOutcome&&typeof row.resolvedOutcome==='object'?row.resolvedOutcome:{};
const rowRegime=(row)=>String(row?.regime||'UNKNOWN').trim().toUpperCase()||'UNKNOWN';

const targetExists=(row,slot)=>rowTargets(row).some(target=>Number(target?.slot)===slot);
const targetReachedBeforeInvalidation=(row,slot)=>{
  const metrics=rowMetrics(row);
  const targetAt=iso(metrics?.targetReachedAt?.['T'+slot]);
  if(!targetAt)return 0;
  const invalidatedAt=iso(metrics?.invalidatedAt);
  if(!invalidatedAt)return 1;
  return Date.parse(targetAt)<Date.parse(invalidatedAt)?1:0;
};
const labelFor=(row,metric)=>{
  if(metric.key==='INVALIDATION_FIRST')return rowResolution(row)?.state==='INVALIDATED_FIRST'?1:0;
  if(!targetExists(row,metric.slot))return null;
  return targetReachedBeforeInvalidation(row,metric.slot);
};

const eligibleRows=(rows)=>(Array.isArray(rows)?rows:[])
  .filter(row=>truthy(rowResolution(row)?.calibrationEligible)&&observedAt(row))
  .sort((a,b)=>Date.parse(observedAt(a))-Date.parse(observedAt(b))||String(a?.id||'').localeCompare(String(b?.id||'')));

const wilson=(hits,n,z=1.96)=>{
  if(!(n>0))return {low:null,high:null,width:null};
  const phat=hits/n,z2=z*z,denominator=1+z2/n;
  const center=(phat+z2/(2*n))/denominator;
  const margin=z*Math.sqrt((phat*(1-phat)+z2/(4*n))/n)/denominator;
  const low=Math.max(0,center-margin),high=Math.min(1,center+margin);
  return {low:round(low,4),high:round(high,4),width:round(high-low,4)};
};

const walkForwardPredictions=(labels,{warmup=20}={})=>{
  const values=(Array.isArray(labels)?labels:[]).map(Number).filter(value=>value===0||value===1);
  const start=Math.max(5,Math.floor(Number(warmup)||20));
  const predictions=[];
  let priorHits=0;
  for(let index=0;index<values.length;index+=1){
    if(index>=start){
      const probability=(priorHits+.5)/(index+1);
      predictions.push({index,probability,actual:values[index],brier:(probability-values[index])**2});
    }
    priorHits+=values[index];
  }
  return predictions;
};

const reliability=(predictions)=>{
  const bins=RELIABILITY_BINS.map(([low,high])=>{
    const members=predictions.filter(item=>item.probability>=low&&item.probability<high);
    if(!members.length)return null;
    return {
      low:round(low,2),
      high:round(Math.min(high,1),2),
      sampleSize:members.length,
      meanProbability:round(mean(members.map(item=>item.probability)),4),
      observedRate:round(mean(members.map(item=>item.actual)),4)
    };
  }).filter(Boolean);
  const total=predictions.length;
  const gap=total?bins.reduce((sum,bin)=>sum+bin.sampleSize*Math.abs(bin.meanProbability-bin.observedRate),0)/total:null;
  return {bins,gap:round(gap,4)};
};

const calibrationForSeries=(series,{minSamples=50,warmup=20}={})=>{
  const labels=series.map(item=>item.label);
  const n=labels.length;
  const hits=labels.reduce((sum,value)=>sum+value,0);
  const firstResolvedAt=n?series[0].resolvedAt:null,lastResolvedAt=n?series.at(-1).resolvedAt:null;
  if(n<minSamples)return {
    state:'UNCALIBRATED',
    eligible:false,
    sampleSize:n,
    hits,
    probability:null,
    confidenceInterval95:{low:null,high:null,width:null},
    brierScore:null,
    reliabilityGap:null,
    reliabilityBins:[],
    walkForwardSampleSize:0,
    firstResolvedAt,
    lastResolvedAt,
    reason:'Resolved real setup outcomes are below the minimum sample gate.'
  };
  const predictions=walkForwardPredictions(labels,{warmup});
  const brier=mean(predictions.map(item=>item.brier));
  const reliabilityResult=reliability(predictions);
  const ci=wilson(hits,n);
  const probability=(hits+.5)/(n+1);
  const brierOk=Number.isFinite(brier)&&brier<=.25;
  const reliabilityOk=Number.isFinite(reliabilityResult.gap)&&reliabilityResult.gap<=.12;
  const intervalOk=Number.isFinite(ci.width)&&ci.width<=.35;
  const enoughWalkForward=predictions.length>=Math.max(20,minSamples-warmup);
  const calibrated=brierOk&&reliabilityOk&&intervalOk&&enoughWalkForward;
  return {
    state:calibrated?'CALIBRATED':'WEAK_CALIBRATION',
    eligible:calibrated,
    sampleSize:n,
    hits,
    probability:calibrated?round(probability,4):null,
    confidenceInterval95:calibrated?ci:{low:null,high:null,width:ci.width},
    brierScore:round(brier,4),
    reliabilityGap:reliabilityResult.gap,
    reliabilityBins:reliabilityResult.bins,
    walkForwardSampleSize:predictions.length,
    firstResolvedAt,
    lastResolvedAt,
    reason:calibrated
      ?'Real setup outcomes clear the sample, Brier, reliability and confidence-interval gates.'
      :'Enough real outcomes exist, but the independent Brier, reliability or confidence-interval gate is not yet strong enough.'
  };
};

const seriesFor=(rows,metric)=>rows
  .map(row=>{
    const label=labelFor(row,metric);
    return label===0||label===1?{label,resolvedAt:observedAt(row),regime:rowRegime(row)}:null;
  })
  .filter(Boolean);

const segmentsFor=(series,{minSamples,warmup,minSegmentSamples})=>{
  const regimes=[...new Set(series.map(item=>item.regime))].sort();
  const segments={};
  for(const regime of regimes){
    const members=series.filter(item=>item.regime===regime);
    if(members.length<minSegmentSamples)continue;
    segments[regime]=calibrationForSeries(members,{minSamples:minSegmentSamples,warmup:Math.min(warmup,Math.max(5,Math.floor(minSegmentSamples*.4)))});
  }
  return segments;
};

export function buildTargetTouchCalibration(rows,{minSamples=50,warmup=20,minSegmentSamples=50,historyLimitReached=false}={}){
  const cleanRows=eligibleRows(rows);
  const metrics={};
  for(const metric of METRICS){
    const series=seriesFor(cleanRows,metric);
    metrics[metric.key]={
      label:metric.label,
      ...calibrationForSeries(series,{minSamples,warmup}),
      regimeSegments:segmentsFor(series,{minSamples,warmup,minSegmentSamples})
    };
  }
  const calibratedKeys=Object.entries(metrics).filter(([,value])=>value.eligible).map(([key])=>key);
  const coreCalibrated=Boolean(metrics.T1?.eligible&&metrics.INVALIDATION_FIRST?.eligible);
  const state=coreCalibrated?'CALIBRATED':cleanRows.length>=minSamples?'WEAK_CALIBRATION':'UNCALIBRATED';
  return {
    schemaVersion:'qelly.target-touch-calibration/1.0.0',
    state,
    eligible:coreCalibrated,
    eligibleResolvedSetups:cleanRows.length,
    minimumSampleGate:minSamples,
    walkForwardWarmup:warmup,
    minimumRegimeSegmentSample:minSegmentSamples,
    calibratedMetrics:calibratedKeys,
    metrics,
    firstResolvedAt:cleanRows.length?observedAt(cleanRows[0]):null,
    lastResolvedAt:cleanRows.length?observedAt(cleanRows.at(-1)):null,
    historyLimitReached:Boolean(historyLimitReached),
    method:'Chronological expanding-window empirical target-touch calibration. Each scored outcome is predicted only from earlier resolved setup outcomes; no future outcome is used in its own prediction.',
    leakageGuard:'Rows are ordered by resolution time. Walk-forward probabilities use prior labels only. Ambiguous intrabar outcomes and untriggered expiries are excluded by the ledger calibration-eligibility gate.',
    probabilityBoundary:'Target-touch probability remains null unless its metric independently clears sample size, Brier score, reliability and confidence-interval gates.',
    analogBoundary:'Historical analog positive-rate is not used as target-touch probability.',
    regimeBoundary:'Regime-specific estimates are computed only when that regime independently clears the minimum segment sample size.'
  };
}

export const __targetTouchCalibrationTest=Object.freeze({
  METRICS,RELIABILITY_BINS,eligibleRows,wilson,walkForwardPredictions,reliability,calibrationForSeries,seriesFor,labelFor,targetExists,targetReachedBeforeInvalidation
});
