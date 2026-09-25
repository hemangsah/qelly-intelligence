import {normalizeCandles,DECISION_INTERVALS} from './decision-proven-graph.js';
import {buildDecisionQuantRisk} from './decision-quant-risk.js';

const MIN_ANALOG_SIMILARITY=.65;
const WILSON_Z_95=1.959963984540054;

const finite=(value)=>value==null||value===''?null:Number.isFinite(Number(value))?Number(value):null;
const round=(value,digits=4)=>Number.isFinite(value)?Number(value.toFixed(digits)):null;
const median=(values)=>{if(!values.length)return null;const sorted=[...values].sort((a,b)=>a-b),mid=Math.floor(sorted.length/2);return sorted.length%2?sorted[mid]:(sorted[mid-1]+sorted[mid])/2;};
const quantile=(values,p)=>{if(!values.length)return null;const sorted=[...values].sort((a,b)=>a-b);const index=(sorted.length-1)*p;const low=Math.floor(index),weight=index-low;return sorted[low]+((sorted[low+1]??sorted[low])-sorted[low])*weight;};
const scale=(difference,denominator)=>Math.abs(difference)/Math.max(denominator,1e-9);

function wilsonInterval(successes,total,z=WILSON_Z_95){
  const n=Math.max(0,Number(total)||0),k=Math.max(0,Math.min(n,Number(successes)||0));
  if(!n)return {low:null,high:null};
  const phat=k/n,z2=z*z,denominator=1+z2/n;
  const center=(phat+z2/(2*n))/denominator;
  const margin=(z*Math.sqrt((phat*(1-phat)+z2/(4*n))/n))/denominator;
  return {low:Math.max(0,center-margin),high:Math.min(1,center+margin)};
}

function features(window,{intervalMs,horizonBars}){
  const quant=buildDecisionQuantRisk(window,{intervalMs,horizonBars});
  if(quant.state!=='DERIVED')return null;
  return {
    regime:quant.regime,
    volatilityRegime:quant.volatility?.regime||'UNKNOWN',
    volatilityPercentile:finite(quant.volatility?.percentile),
    adx14:finite(quant.trend?.adx14),
    efficiencyRatio:finite(quant.trend?.efficiencyRatio),
    roc14Pct:finite(quant.trend?.roc14Pct),
    structureState:quant.structure?.state||'UNAVAILABLE',
    rangePct:finite(quant.structure?.rangePct)
  };
}

function distance(current,candidate){
  let total=0,weight=0;
  const add=(a,b,denominator,w)=>{
    if(!Number.isFinite(a)||!Number.isFinite(b))return;
    total+=Math.min(3,scale(a-b,denominator))*w;weight+=w;
  };
  add(current.volatilityPercentile,candidate.volatilityPercentile,.35,1.2);
  add(current.adx14,candidate.adx14,25,1);
  add(current.efficiencyRatio,candidate.efficiencyRatio,.35,1);
  add(current.roc14Pct,candidate.roc14Pct,6,1.2);
  add(current.rangePct,candidate.rangePct,4,.7);
  if(current.regime!=='UNKNOWN'&&candidate.regime!=='UNKNOWN'){total+=(current.regime===candidate.regime?0:.8)*1.1;weight+=1.1;}
  if(current.volatilityRegime!=='UNKNOWN'&&candidate.volatilityRegime!=='UNKNOWN'){total+=(current.volatilityRegime===candidate.volatilityRegime?0:.6)*.8;weight+=.8;}
  if(current.structureState!=='UNAVAILABLE'&&candidate.structureState!=='UNAVAILABLE'){total+=(current.structureState===candidate.structureState?0:.55)*.7;weight+=.7;}
  return weight?total/weight:null;
}

function attachResolvedOutcome(candles,descriptor,horizon){
  const cut=descriptor.cut;
  const entry=candles[cut-1]?.close,terminal=candles[cut+horizon-1]?.close;
  if(!(entry>0&&terminal>0))return null;
  const forwardReturnPct=(terminal/entry-1)*100;
  let maxFavorable=0,maxAdverse=0;
  for(const candle of candles.slice(cut,cut+horizon)){
    const high=(candle.high/entry-1)*100;
    const low=(candle.low/entry-1)*100;
    maxFavorable=Math.max(maxFavorable,high);
    maxAdverse=Math.min(maxAdverse,low);
  }
  return {
    ...descriptor,
    resolveTime:candles[cut+horizon-1].time,
    outcome:{forwardReturnPct,maxFavorablePct:maxFavorable,maxAdversePct:maxAdverse}
  };
}

export function buildDecisionHistoricalAnalogs(raw,{interval='15m',horizonBars=16,windowBars=100,limit=5}={}){
  const intervalMs=DECISION_INTERVALS[interval];
  const candles=normalizeCandles(raw);
  const horizon=Math.max(2,Math.min(168,Number(horizonBars)||16));
  const windowSize=Math.max(60,Math.min(180,Number(windowBars)||100));
  const outputLimit=Math.max(1,Math.min(8,Number(limit)||5));
  if(!intervalMs||candles.length<windowSize+horizon+20)return {
    state:'UNAVAILABLE',analogs:[],sampledWindows:0,similarityEligibleWindows:0,similarityRejectedWindows:0,
    temporalOverlapRejected:0,minimumSimilarity:MIN_ANALOG_SIMILARITY,
    reason:'Not enough resolved history for bounded analog matching.'
  };

  const currentWindow=candles.slice(-windowSize);
  const current=features(currentWindow,{intervalMs,horizonBars:horizon});
  if(!current)return {
    state:'UNAVAILABLE',analogs:[],sampledWindows:0,similarityEligibleWindows:0,similarityRejectedWindows:0,
    temporalOverlapRejected:0,minimumSimilarity:MIN_ANALOG_SIMILARITY,
    reason:'Current market-state features are unavailable.'
  };

  const candidateSpan=Math.max(0,candles.length-windowSize-horizon-Math.ceil(windowSize/4));
  const step=Math.max(8,horizon,Math.ceil(candidateSpan/32));
  const descriptors=[];
  for(let cut=windowSize;cut+horizon<candles.length-windowSize/4;cut+=step){
    const window=candles.slice(cut-windowSize,cut);
    const candidate=features(window,{intervalMs,horizonBars:horizon});
    if(!candidate)continue;
    const d=distance(current,candidate);
    if(!Number.isFinite(d))continue;
    const anchorTime=candles[cut-1]?.time;
    const entry=candles[cut-1]?.close;
    if(!Number.isFinite(anchorTime)||!(entry>0))continue;
    descriptors.push({
      cut,
      anchorTime,
      distance:d,
      similarity:1/(1+d),
      features:candidate
    });
  }

  descriptors.sort((a,b)=>a.distance-b.distance||b.anchorTime-a.anchorTime);
  const similarityEligible=descriptors.filter(item=>item.similarity>=MIN_ANALOG_SIMILARITY);
  const selectedDescriptors=[];
  let temporalOverlapRejected=0;
  for(const candidate of similarityEligible){
    if(selectedDescriptors.some(item=>Math.abs(item.anchorTime-candidate.anchorTime)<intervalMs*horizon)){
      temporalOverlapRejected+=1;
      continue;
    }
    selectedDescriptors.push(candidate);
    if(selectedDescriptors.length>=outputLimit)break;
  }

  const resolved=selectedDescriptors.map(item=>attachResolvedOutcome(candles,item,horizon)).filter(Boolean);
  const analogs=resolved.map((item,index)=>({
    rank:index+1,
    observedAt:new Date(item.anchorTime).toISOString(),
    resolvedAt:new Date(item.resolveTime).toISOString(),
    similarity:round(item.similarity,3),
    distance:round(item.distance,4),
    regime:item.features.regime,
    volatilityRegime:item.features.volatilityRegime,
    structure:item.features.structureState,
    forwardReturnPct:round(item.outcome.forwardReturnPct,3),
    maxFavorablePct:round(item.outcome.maxFavorablePct,3),
    maxAdversePct:round(item.outcome.maxAdversePct,3),
    timeToResolutionMs:Math.max(0,item.resolveTime-item.anchorTime)
  }));
  const returns=analogs.map(item=>item.forwardReturnPct).filter(Number.isFinite);
  const positiveCount=returns.filter(value=>value>0).length;
  const positiveInterval=wilsonInterval(positiveCount,returns.length);

  return {
    state:analogs.length?'AVAILABLE':'UNAVAILABLE',
    sampledWindows:descriptors.length,
    similarityEligibleWindows:similarityEligible.length,
    similarityRejectedWindows:Math.max(0,descriptors.length-similarityEligible.length),
    temporalOverlapRejected,
    selectedCount:analogs.length,
    minimumSimilarity:MIN_ANALOG_SIMILARITY,
    minimumAnchorSeparationBars:horizon,
    candidateStepBars:step,
    analogs,
    summary:analogs.length?{
      count:analogs.length,
      medianForwardReturnPct:round(median(returns),3),
      q25ForwardReturnPct:round(returns.length?quantile(returns,.25):null,3),
      q75ForwardReturnPct:round(returns.length?quantile(returns,.75):null,3),
      positiveShare:round(positiveCount/returns.length,3),
      negativeShare:round(returns.filter(value=>value<0).length/returns.length,3),
      positiveShareInterval95:{
        low:round(positiveInterval.low,3),
        high:round(positiveInterval.high,3),
        successes:positiveCount,
        sampleSize:returns.length,
        method:'Wilson score interval for the descriptive positive-return share.',
        boundary:'This interval describes uncertainty in a tiny selected historical sample. Analogs are not assumed IID, and the interval is not a win probability or calibration output.'
      },
      medianSimilarity:round(median(analogs.map(item=>item.similarity)),3),
      medianMfePct:round(median(analogs.map(item=>item.maxFavorablePct).filter(Number.isFinite)),3),
      medianMaePct:round(median(analogs.map(item=>item.maxAdversePct).filter(Number.isFinite)),3),
      medianTimeToResolutionMs:round(median(analogs.map(item=>item.timeToResolutionMs).filter(Number.isFinite)),0)
    }:null,
    current,
    reason:analogs.length?null:similarityEligible.length
      ?'No similarity-qualified historical window produced a complete resolved outcome.'
      :'No historical window cleared the fixed pre-outcome feature-similarity gate.',
    method:'Nearest prior market-state windows using only pre-anchor trend, volatility, momentum and structure features, with a bounded candidate stride capped to roughly 32 resolved windows per request. Candidates must clear a fixed 0.65 feature-similarity floor before any forward outcome is computed, and candidate stride is at least one full forecast horizon.',
    selectionPolicy:{
      similarityFloor:MIN_ANALOG_SIMILARITY,
      similarityBasis:'1 / (1 + normalized pre-anchor feature distance)',
      thresholdSelection:'Fixed research policy; not tuned from forward returns, MFE, MAE or time-to-resolution.',
      temporalSeparation:'Candidate stride and final selection require at least one forecast horizon between anchors so selected resolved outcome windows do not overlap.'
    },
    outcomeBoundary:'Forward return, MFE, MAE and time-to-resolution are computed only after similarity and temporal-selection gates. They remain descriptive historical context, not probability calibration, target-touch probability, expected value or a trade signal.',
    leakageGuard:'No forward return, favorable excursion or adverse excursion is used in feature distance, similarity acceptance or analog ranking. Terminal price or time-to-resolution is also excluded from matching and ranking.',
    uncertaintyBoundary:'The selected analog sample is small and conditionally matched. Summary intervals are descriptive uncertainty only and do not assume independent identical draws.',
    eligibilityImpact:'none'
  };
}

export const __decisionHistoricalAnalogsTest=Object.freeze({features,distance,median,wilsonInterval,MIN_ANALOG_SIMILARITY});
