import {DECISION_INTERVALS} from './decision-proven-graph.js';

const MIN_SIMILARITY=.62;
const MAX_ANALOGS=6;
const finite=(value)=>value==null||value===''?null:Number.isFinite(Number(value))?Number(value):null;
const round=(value,digits=4)=>Number.isFinite(value)?Number(value.toFixed(digits)):null;
const mean=(values)=>values.length?values.reduce((sum,value)=>sum+value,0)/values.length:null;
const median=(values)=>{if(!values.length)return null;const sorted=[...values].sort((a,b)=>a-b),mid=Math.floor(sorted.length/2);return sorted.length%2?sorted[mid]:(sorted[mid-1]+sorted[mid])/2;};
const quantile=(values,p)=>{if(!values.length)return null;const sorted=[...values].sort((a,b)=>a-b);const index=(sorted.length-1)*p,low=Math.floor(index),weight=index-low;return sorted[low]+((sorted[low+1]??sorted[low])-sorted[low])*weight;};
const iso=(value)=>Number.isFinite(Number(value))?new Date(Number(value)).toISOString():null;
const parseTime=(value)=>{
  if(value==null||value==='')return null;
  const numeric=Number(value);
  if(Number.isFinite(numeric))return Math.abs(numeric)<100_000_000_000?numeric*1000:numeric;
  const raw=String(value).trim();
  const compact=raw.match(/^(\d{4})(\d{2})(\d{2})T?(\d{2})(\d{2})(\d{2})Z?$/);
  const parsed=Date.parse(compact?`${compact[1]}-${compact[2]}-${compact[3]}T${compact[4]}:${compact[5]}:${compact[6]}Z`:raw);
  return Number.isFinite(parsed)?parsed:null;
};
const normalizeCandles=(raw)=>(Array.isArray(raw)?raw:[]).map(item=>({
  time:finite(item?.t??item?.time),
  open:finite(item?.o??item?.open),
  high:finite(item?.h??item?.high),
  low:finite(item?.l??item?.low),
  close:finite(item?.c??item?.close),
  volume:finite(item?.v??item?.volume)
})).filter(item=>item.time>0&&item.open>0&&item.high>0&&item.low>0&&item.close>0).sort((a,b)=>a.time-b.time);
const normalizeFunding=(raw)=>(Array.isArray(raw)?raw:[]).map(item=>({
  time:parseTime(item?.time),
  fundingRate:finite(item?.fundingRate),
  premium:finite(item?.premium)
})).filter(item=>item.time>0).sort((a,b)=>a.time-b.time);
const normalizeNews=(raw)=>(Array.isArray(raw)?raw:[]).map(item=>({
  title:String(item?.title||'').trim(),
  source:String(item?.source||item?.domain||'').trim(),
  url:item?.url||null,
  time:parseTime(item?.publishedAt??item?.seenAt??item?.seendate??item?.date??item?.timestamp)
})).filter(item=>item.title&&item.time>0).sort((a,b)=>a.time-b.time);
const realizedVolPct=(rows)=>{
  const returns=[];
  for(let i=1;i<rows.length;i++)if(rows[i-1].close>0&&rows[i].close>0)returns.push(Math.log(rows[i].close/rows[i-1].close));
  if(!returns.length)return null;
  const m=mean(returns),variance=mean(returns.map(value=>(value-m)**2));
  return Number.isFinite(variance)?Math.sqrt(variance)*100:null;
};
const rangeFeatures=(rows,priorRows=[])=>{
  if(rows.length<2)return null;
  const first=rows[0],last=rows.at(-1),high=Math.max(...rows.map(item=>item.high)),low=Math.min(...rows.map(item=>item.low));
  const returnPct=(last.close/first.open-1)*100,rangePct=(high/low-1)*100;
  const path=rows.slice(1).reduce((sum,row,index)=>sum+Math.abs(row.close-rows[index].close),0);
  const efficiency=path>0?Math.abs(last.close-first.open)/path:0;
  const upShare=rows.filter(item=>item.close>item.open).length/rows.length;
  const volumes=rows.map(item=>item.volume).filter(Number.isFinite),priorVolumes=priorRows.map(item=>item.volume).filter(Number.isFinite);
  const avgVolume=volumes.length?mean(volumes):null,priorAvg=priorVolumes.length?mean(priorVolumes):null;
  return {
    returnPct,rangePct,realizedVolatilityPct:realizedVolPct(rows),efficiency,upShare,
    volumeRatio:avgVolume!==null&&priorAvg>0?avgVolume/priorAvg:null
  };
};
const featureDistance=(target,candidate)=>{
  let total=0,weight=0;
  const add=(a,b,scale,w)=>{if(!Number.isFinite(a)||!Number.isFinite(b))return;total+=Math.min(3,Math.abs(a-b)/Math.max(scale,1e-9))*w;weight+=w;};
  add(target.returnPct,candidate.returnPct,Math.max(1,Math.abs(target.returnPct)*.75),1.5);
  add(target.rangePct,candidate.rangePct,Math.max(1,target.rangePct*.6),1.1);
  add(target.realizedVolatilityPct,candidate.realizedVolatilityPct,Math.max(.1,(target.realizedVolatilityPct||.1)*.75),1);
  add(target.efficiency,candidate.efficiency,.35,.9);
  add(target.upShare,candidate.upShare,.35,.7);
  add(target.volumeRatio,candidate.volumeRatio,.75,.6);
  return weight?total/weight:null;
};
const outcomeFor=(candles,afterIndex,horizonBars,targetMoveAbsPct,intervalMs)=>{
  const entry=candles[afterIndex-1]?.close,future=candles.slice(afterIndex,afterIndex+horizonBars);
  if(!(entry>0)||!future.length)return null;
  const terminal=future.at(-1).close,forwardReturnPct=(terminal/entry-1)*100;
  let mfe=0,mae=0,resolutionIndex=null,resolutionDirection='UNRESOLVED';
  for(let i=0;i<future.length;i++){
    const favorable=(future[i].high/entry-1)*100,adverse=(future[i].low/entry-1)*100;
    mfe=Math.max(mfe,favorable);mae=Math.min(mae,adverse);
    if(resolutionIndex===null&&targetMoveAbsPct>0){
      if(favorable>=targetMoveAbsPct){resolutionIndex=i;resolutionDirection='UPSIDE_THRESHOLD';}
      else if(Math.abs(adverse)>=targetMoveAbsPct){resolutionIndex=i;resolutionDirection='DOWNSIDE_THRESHOLD';}
    }
  }
  const resolvedBars=resolutionIndex===null?future.length:resolutionIndex+1;
  return {
    forwardReturnPct:round(forwardReturnPct,3),
    maxFavorablePct:round(mfe,3),
    maxAdversePct:round(mae,3),
    timeToResolutionBars:resolvedBars,
    timeToResolutionMs:resolvedBars*intervalMs,
    resolutionState:resolutionIndex===null?'HORIZON_ENDED':resolutionDirection,
    resolvedAt:iso(future[Math.min(resolvedBars-1,future.length-1)]?.time)
  };
};

export function buildDecisionRangeReplay({candles=[],selection=null,interval='15m',newsArticles=[],fundingRows=[],benchmarkCandles=[],benchmark='BTC'}={}){
  const rows=normalizeCandles(candles),start=parseTime(selection?.start),end=parseTime(selection?.end),intervalMs=DECISION_INTERVALS[interval];
  if(!intervalMs||!Number.isFinite(start)||!Number.isFinite(end)||start>=end)return {
    schemaVersion:'qelly.decision-range-replay/1.0.0',state:'NOT_SELECTED',frames:[],reason:'Select a valid historical range before replay.'
  };
  const selected=rows.filter(item=>item.time>=start&&item.time<=end);
  if(!selected.length)return {
    schemaVersion:'qelly.decision-range-replay/1.0.0',state:'UNAVAILABLE',frames:[],reason:'The selected candles are outside the returned provider history.'
  };
  const news=normalizeNews(newsArticles).filter(item=>item.time>=start&&item.time<=end);
  const funding=normalizeFunding(fundingRows).filter(item=>item.time>=start&&item.time<=end);
  const benchmarkRows=normalizeCandles(benchmarkCandles).filter(item=>item.time>=start&&item.time<=end);
  const benchmarkStart=benchmarkRows[0]?.close??null;
  const frames=selected.map((candle,index)=>{
    const observed=selected.slice(0,index+1),first=observed[0],high=Math.max(...observed.map(item=>item.high)),low=Math.min(...observed.map(item=>item.low));
    const visibleNews=news.filter(item=>item.time<=candle.time);
    const visibleFunding=funding.filter(item=>item.time<=candle.time);
    const visibleBenchmark=benchmarkRows.filter(item=>item.time<=candle.time);
    const benchmarkLatest=visibleBenchmark.at(-1)?.close??null;
    return {
      index,
      candleNumber:index+1,
      totalCandles:selected.length,
      observedAt:iso(candle.time),
      candle:{open:round(candle.open,8),high:round(candle.high,8),low:round(candle.low,8),close:round(candle.close,8),volume:round(candle.volume,4)},
      knownRange:{
        returnPct:round((candle.close/first.open-1)*100,4),
        high:round(high,8),
        low:round(low,8),
        rangePct:round((high/low-1)*100,4),
        realizedVolatilityPct:round(realizedVolPct(observed),5),
        averageVolume:round(mean(observed.map(item=>item.volume).filter(Number.isFinite)),4)
      },
      evidenceAvailableAsOf:{
        news:{count:visibleNews.length,latest:visibleNews.slice(-3).map(item=>({timestamp:iso(item.time),title:item.title,source:item.source,url:item.url}))},
        settledFunding:{count:visibleFunding.length,latestRate:round(visibleFunding.at(-1)?.fundingRate,10),latestPremium:round(visibleFunding.at(-1)?.premium,10),latestAt:iso(visibleFunding.at(-1)?.time)},
        benchmark:{symbol:benchmark,state:benchmarkStart>0&&benchmarkLatest>0?'AVAILABLE':'UNAVAILABLE',observations:visibleBenchmark.length,returnPct:benchmarkStart>0&&benchmarkLatest>0?round((benchmarkLatest/benchmarkStart-1)*100,4):null}
      },
      futureEvidenceHidden:index<selected.length-1,
      boundary:'This replay frame includes only observations timestamped at or before this candle. Later selected-range candles, later headlines and later settled funding are hidden.'
    };
  });
  return {
    schemaVersion:'qelly.decision-range-replay/1.0.0',
    state:'AVAILABLE',
    interval,
    rangeStart:iso(start),
    rangeEnd:iso(end),
    totalFrames:frames.length,
    frames,
    evidenceCoverage:{news:news.length?'RANGE_BOUNDED':'NO_MATCHES',settledFunding:funding.length?'RANGE_BOUNDED':'UNAVAILABLE',benchmark:benchmarkRows.length?'RANGE_BOUNDED':'UNAVAILABLE',historicalLiquidity:'UNAVAILABLE'},
    hindsightGuard:'Each frame is assembled from a timestamp cutoff at that candle. Full-range high/low, ending return, later news, later funding and later benchmark observations are not copied backward into earlier frames.',
    currentContextBoundary:'Current L2, current derivatives, current macro reference values and current fundamentals are not replayed as historical observations.'
  };
}

export function buildSelectedRangeSimilarMoves(raw,{selection=null,interval='15m',limit=5}={}){
  const candles=normalizeCandles(raw),start=parseTime(selection?.start),end=parseTime(selection?.end),intervalMs=DECISION_INTERVALS[interval];
  if(!intervalMs||!Number.isFinite(start)||!Number.isFinite(end)||start>=end)return {
    schemaVersion:'qelly.selected-range-similar-moves/1.0.0',state:'NOT_SELECTED',analogs:[],reason:'Select a valid historical range before similarity research.'
  };
  const targetIndices=candles.map((item,index)=>item.time>=start&&item.time<=end?index:-1).filter(index=>index>=0);
  if(targetIndices.length<3)return {
    schemaVersion:'qelly.selected-range-similar-moves/1.0.0',state:'UNAVAILABLE',analogs:[],reason:'At least three returned candles are required inside the selected range.'
  };
  const targetStartIndex=targetIndices[0],targetEndIndex=targetIndices.at(-1),windowBars=targetEndIndex-targetStartIndex+1;
  const targetRows=candles.slice(targetStartIndex,targetEndIndex+1);
  const targetPrior=candles.slice(Math.max(0,targetStartIndex-windowBars),targetStartIndex);
  const target=rangeFeatures(targetRows,targetPrior);
  if(!target)return {schemaVersion:'qelly.selected-range-similar-moves/1.0.0',state:'UNAVAILABLE',analogs:[],reason:'Selected-range features are unavailable.'};
  const horizonBars=windowBars,targetMoveAbsPct=Math.abs(target.returnPct||0),descriptors=[];
  const latestAllowedOutcomeIndex=targetStartIndex;
  for(let candidateStart=Math.max(windowBars,2);candidateStart+windowBars+horizonBars<=latestAllowedOutcomeIndex;candidateStart+=Math.max(2,Math.floor(windowBars/3))){
    const candidateEnd=candidateStart+windowBars;
    const rows=candles.slice(candidateStart,candidateEnd),prior=candles.slice(candidateStart-windowBars,candidateStart);
    const candidate=rangeFeatures(rows,prior);
    if(!candidate)continue;
    const distance=featureDistance(target,candidate);
    if(!Number.isFinite(distance))continue;
    descriptors.push({candidateStart,candidateEnd,distance,similarity:1/(1+distance),features:candidate});
  }
  const qualified=descriptors.filter(item=>item.similarity>=MIN_SIMILARITY).sort((a,b)=>a.distance-b.distance||b.candidateStart-a.candidateStart);
  const selected=[];
  let temporalOverlapRejected=0;
  for(const item of qualified){
    if(selected.some(previous=>Math.abs(previous.candidateStart-item.candidateStart)<windowBars*2)){temporalOverlapRejected+=1;continue;}
    selected.push(item);
    if(selected.length>=Math.max(1,Math.min(MAX_ANALOGS,Number(limit)||5)))break;
  }
  const analogs=selected.map((item,index)=>{
    const rangeRows=candles.slice(item.candidateStart,item.candidateEnd);
    const outcome=outcomeFor(candles,item.candidateEnd,horizonBars,targetMoveAbsPct,intervalMs);
    if(!outcome)return null;
    return {
      rank:index+1,
      rangeStart:iso(rangeRows[0]?.time),
      rangeEnd:iso(rangeRows.at(-1)?.time),
      similarity:round(item.similarity,3),
      distance:round(item.distance,4),
      observedFeatures:{
        returnPct:round(item.features.returnPct,3),rangePct:round(item.features.rangePct,3),
        realizedVolatilityPct:round(item.features.realizedVolatilityPct,4),efficiency:round(item.features.efficiency,3),
        upCandleShare:round(item.features.upShare,3),volumeRatio:round(item.features.volumeRatio,3)
      },
      outcome
    };
  }).filter(Boolean);
  const returns=analogs.map(item=>item.outcome.forwardReturnPct).filter(Number.isFinite);
  const mfe=analogs.map(item=>item.outcome.maxFavorablePct).filter(Number.isFinite),mae=analogs.map(item=>item.outcome.maxAdversePct).filter(Number.isFinite),resolution=analogs.map(item=>item.outcome.timeToResolutionMs).filter(Number.isFinite);
  return {
    schemaVersion:'qelly.selected-range-similar-moves/1.0.0',
    state:analogs.length?'AVAILABLE':'UNAVAILABLE',
    target:{rangeStart:iso(candles[targetStartIndex]?.time),rangeEnd:iso(candles[targetEndIndex]?.time),windowBars,features:{returnPct:round(target.returnPct,3),rangePct:round(target.rangePct,3),realizedVolatilityPct:round(target.realizedVolatilityPct,4),efficiency:round(target.efficiency,3),upCandleShare:round(target.upShare,3),volumeRatio:round(target.volumeRatio,3)}},
    sampledWindows:descriptors.length,
    similarityEligibleWindows:qualified.length,
    temporalOverlapRejected,
    minimumSimilarity:MIN_SIMILARITY,
    analogs,
    summary:analogs.length?{
      count:analogs.length,
      medianForwardReturnPct:round(median(returns),3),
      q25ForwardReturnPct:round(quantile(returns,.25),3),
      q75ForwardReturnPct:round(quantile(returns,.75),3),
      medianMfePct:round(median(mfe),3),
      medianMaePct:round(median(mae),3),
      medianTimeToResolutionMs:round(median(resolution),0)
    }:null,
    reason:analogs.length?null:'No fully resolved prior window cleared the fixed selected-range similarity policy inside returned provider history.',
    method:'Match prior equal-length ranges on observed return, range, realized volatility, directional efficiency, up-candle share and volume ratio. Forward outcomes are attached only after similarity ranking.',
    selectionPolicy:{similarityFloor:MIN_SIMILARITY,priorOnly:true,requiredOutcomeBeforeSelection:true,anchorSeparationBars:windowBars*2},
    leakageGuard:'Candidate matching and ranking use only candidate-range observations and their pre-range volume baseline. Post-range forward return, MFE, MAE and time-to-resolution are computed only after candidate selection, and every candidate outcome ends before the selected target range begins.',
    outcomeBoundary:'Analog outcomes are descriptive historical context only. They are not calibrated probabilities, target-touch probabilities, expected returns or setup eligibility.',
    eligibilityImpact:'none'
  };
}

export const __decisionRangeHistoryTest=Object.freeze({normalizeCandles,normalizeNews,normalizeFunding,rangeFeatures,featureDistance,outcomeFor,parseTime,MIN_SIMILARITY});
