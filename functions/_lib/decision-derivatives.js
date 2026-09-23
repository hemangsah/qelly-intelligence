const finite=(value)=>Number.isFinite(Number(value))?Number(value):null;
const round=(value,digits=6)=>Number.isFinite(value)?Number(value.toFixed(digits)):null;
const median=(values)=>{if(!values.length)return null;const sorted=[...values].sort((a,b)=>a-b),mid=Math.floor(sorted.length/2);return sorted.length%2?sorted[mid]:(sorted[mid-1]+sorted[mid])/2;};
const percentileRank=(values,value)=>{
  const valid=values.filter(Number.isFinite);
  if(!valid.length||!Number.isFinite(value))return null;
  return valid.filter(item=>item<=value).length/valid.length;
};

export function buildFundingHistoryContext(raw,{currentFundingRate=null}={}){
  const rows=(Array.isArray(raw)?raw:[])
    .map(item=>({
      coin:String(item?.coin||'').toUpperCase(),
      time:finite(item?.time),
      fundingRate:finite(item?.fundingRate),
      premium:finite(item?.premium)
    }))
    .filter(item=>item.time>0&&Number.isFinite(item.fundingRate))
    .sort((a,b)=>a.time-b.time)
    .slice(-168);
  if(!rows.length)return {
    state:'unavailable',
    sampleSize:0,
    previousFundingRate:null,
    fundingChangeBps:null,
    fundingPercentile:null,
    medianFundingPct:null,
    minFundingPct:null,
    maxFundingPct:null,
    latestHistoricalAt:null,
    reason:'Historical funding observations are unavailable.'
  };
  const rates=rows.map(item=>item.fundingRate);
  const premiums=rows.map(item=>item.premium).filter(Number.isFinite);
  const current=finite(currentFundingRate);
  const previous=rows.at(-1)?.fundingRate??null;
  const firstTime=rows[0].time,lastTime=rows.at(-1).time;
  return {
    state:'available',
    sampleSize:rows.length,
    windowHours:round(Math.max(0,lastTime-firstTime)/3_600_000,1),
    previousFundingRate:round(previous,10),
    previousFundingPct:previous===null?null:round(previous*100,6),
    fundingChangeBps:current===null||previous===null?null:round((current-previous)*10_000,4),
    fundingPercentile:current===null?null:round(percentileRank(rates,current),4),
    medianFundingPct:round(median(rates)*100,6),
    minFundingPct:round(Math.min(...rates)*100,6),
    maxFundingPct:round(Math.max(...rates)*100,6),
    medianPremiumPct:premiums.length?round(median(premiums)*100,6):null,
    latestHistoricalAt:new Date(lastTime).toISOString(),
    method:'Hyperliquid settled funding history; current funding percentile is descriptive carry context, not a directional probability.',
    limitations:['Funding history does not provide open-interest history.','Funding percentile is not a win probability or trade signal.']
  };
}

export const __decisionDerivativesTest=Object.freeze({median,percentileRank});
