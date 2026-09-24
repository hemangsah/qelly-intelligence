import {normalizeCandles,DECISION_INTERVALS} from './decision-proven-graph.js';
import {buildDecisionQuantRisk} from './decision-quant-risk.js';

const finite=(value)=>value==null||value===''?null:Number.isFinite(Number(value))?Number(value):null;
const round=(value,digits=4)=>Number.isFinite(value)?Number(value.toFixed(digits)):null;
const median=(values)=>{if(!values.length)return null;const sorted=[...values].sort((a,b)=>a-b),mid=Math.floor(sorted.length/2);return sorted.length%2?sorted[mid]:(sorted[mid-1]+sorted[mid])/2;};
const quantile=(values,p)=>{if(!values.length)return null;const sorted=[...values].sort((a,b)=>a-b);const index=(sorted.length-1)*p;const low=Math.floor(index),weight=index-low;return sorted[low]+((sorted[low+1]??sorted[low])-sorted[low])*weight;};
const scale=(difference,denominator)=>Math.abs(difference)/Math.max(denominator,1e-9);

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

export function buildDecisionHistoricalAnalogs(raw,{interval='15m',horizonBars=16,windowBars=100,limit=5}={}){
  const intervalMs=DECISION_INTERVALS[interval];
  const candles=normalizeCandles(raw);
  const horizon=Math.max(2,Math.min(168,Number(horizonBars)||16));
  const windowSize=Math.max(60,Math.min(180,Number(windowBars)||100));
  const outputLimit=Math.max(1,Math.min(8,Number(limit)||5));
  if(!intervalMs||candles.length<windowSize+horizon+20)return {state:'UNAVAILABLE',analogs:[],sampledWindows:0,reason:'Not enough resolved history for bounded analog matching.'};

  const currentWindow=candles.slice(-windowSize);
  const current=features(currentWindow,{intervalMs,horizonBars:horizon});
  if(!current)return {state:'UNAVAILABLE',analogs:[],sampledWindows:0,reason:'Current market-state features are unavailable.'};

  const candidateSpan=Math.max(0,candles.length-windowSize-horizon-Math.ceil(windowSize/4));
  const step=Math.max(8,horizon,Math.ceil(candidateSpan/32));
  const candidates=[];
  for(let cut=windowSize;cut+horizon<candles.length-windowSize/4;cut+=step){
    const window=candles.slice(cut-windowSize,cut);
    const candidate=features(window,{intervalMs,horizonBars:horizon});
    if(!candidate)continue;
    const d=distance(current,candidate);
    if(!Number.isFinite(d))continue;
    const entry=candles[cut-1]?.close,terminal=candles[cut+horizon-1]?.close;
    if(!(entry>0&&terminal>0))continue;
    const forwardReturnPct=(terminal/entry-1)*100;
    let maxFavorable=0,maxAdverse=0;
    for(const candle of candles.slice(cut,cut+horizon)){
      const high=(candle.high/entry-1)*100;
      const low=(candle.low/entry-1)*100;
      maxFavorable=Math.max(maxFavorable,high);
      maxAdverse=Math.min(maxAdverse,low);
    }
    candidates.push({
      anchorTime:candles[cut-1].time,
      resolveTime:candles[cut+horizon-1].time,
      distance:d,
      similarity:1/(1+d),
      features:candidate,
      outcome:{forwardReturnPct,maxFavorablePct:maxFavorable,maxAdversePct:maxAdverse}
    });
  }

  candidates.sort((a,b)=>a.distance-b.distance||b.anchorTime-a.anchorTime);
  const selected=[];
  for(const candidate of candidates){
    if(selected.some(item=>Math.abs(item.anchorTime-candidate.anchorTime)<intervalMs*horizon))continue;
    selected.push(candidate);
    if(selected.length>=outputLimit)break;
  }
  const analogs=selected.map((item,index)=>({
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
  return {
    state:analogs.length?'AVAILABLE':'UNAVAILABLE',
    sampledWindows:candidates.length,
    analogs,
    summary:analogs.length?{
      count:analogs.length,
      medianForwardReturnPct:round(median(returns),3),
      q25ForwardReturnPct:round(returns.length?quantile(returns,.25):null,3),
      q75ForwardReturnPct:round(returns.length?quantile(returns,.75):null,3),
      positiveShare:round(returns.filter(value=>value>0).length/returns.length,3),
      negativeShare:round(returns.filter(value=>value<0).length/returns.length,3),
      medianSimilarity:round(median(analogs.map(item=>item.similarity)),3),
      medianMfePct:round(median(analogs.map(item=>item.maxFavorablePct).filter(Number.isFinite)),3),
      medianMaePct:round(median(analogs.map(item=>item.maxAdversePct).filter(Number.isFinite)),3),
      medianTimeToResolutionMs:round(median(analogs.map(item=>item.timeToResolutionMs).filter(Number.isFinite)),0)
    }:null,
    current,
    candidateStepBars:step,
    method:'Nearest prior market-state windows using only pre-anchor trend, volatility, momentum and structure features, with a bounded candidate stride capped to roughly 32 resolved windows per request.',
    outcomeBoundary:'Forward return, MFE, MAE and time-to-resolution are attached only after analog selection and are descriptive historical context, not probability calibration or a trade signal.',
    leakageGuard:'No forward return, favorable excursion or adverse excursion is used in analog similarity distance.',
    eligibilityImpact:'none'
  };
}

export const __decisionHistoricalAnalogsTest=Object.freeze({features,distance,median});
