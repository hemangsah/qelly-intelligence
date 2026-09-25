const finite=(value)=>value==null||value===''?null:Number.isFinite(Number(value))?Number(value):null;
const round=(value,digits=6)=>Number.isFinite(value)?Number(value.toFixed(digits)):null;
const median=(values)=>{if(!values.length)return null;const sorted=[...values].sort((a,b)=>a-b),mid=Math.floor(sorted.length/2);return sorted.length%2?sorted[mid]:(sorted[mid-1]+sorted[mid])/2;};
const percentileRank=(values,value)=>{
  const valid=values.filter(Number.isFinite);
  if(!valid.length||!Number.isFinite(value))return null;
  return valid.filter(item=>item<=value).length/valid.length;
};
const signedState=(value,{epsilon=.000005,positive='POSITIVE',negative='NEGATIVE',flat='NEAR_FLAT'}={})=>{
  if(!Number.isFinite(value))return 'UNAVAILABLE';
  if(value>epsilon)return positive;
  if(value<-epsilon)return negative;
  return flat;
};
const shiftState=(value,{epsilon=.05}={})=>{
  if(!Number.isFinite(value))return 'UNAVAILABLE';
  if(value>epsilon)return 'RISING';
  if(value<-epsilon)return 'FALLING';
  return 'FLAT';
};

const POSITIONING_DEFINITIONS=Object.freeze({
  LONG_BUILD_UP:'Price rising with verified open interest rising.',
  SHORT_BUILD_UP:'Price falling with verified open interest rising.',
  SHORT_COVERING:'Price rising with verified open interest falling.',
  LONG_UNWINDING:'Price falling with verified open interest falling.',
  NEUTRAL_MIXED:'Price or open-interest change is within the neutral threshold.',
  UNAVAILABLE:'Verified price and open-interest changes are both required.'
});

export function buildDerivativesPositioningState({
  priceChangePct=null,
  openInterestChangePct=null,
  fundingState='UNAVAILABLE',
  basisState='UNAVAILABLE',
  priceEpsilonPct=.1,
  openInterestEpsilonPct=.25
}={}){
  const price=finite(priceChangePct),oi=finite(openInterestChangePct);
  const priceEpsilon=Math.max(0,finite(priceEpsilonPct)??.1);
  const oiEpsilon=Math.max(0,finite(openInterestEpsilonPct)??.25);
  const annotations={fundingState:String(fundingState||'UNAVAILABLE'),basisState:String(basisState||'UNAVAILABLE')};
  if(price===null||oi===null)return {
    state:'UNAVAILABLE',
    available:false,
    priceChangePct:round(price,4),
    openInterestChangePct:round(oi,4),
    priceEpsilonPct:priceEpsilon,
    openInterestEpsilonPct:oiEpsilon,
    definition:POSITIONING_DEFINITIONS.UNAVAILABLE,
    reason:price===null&&oi===null?'Verified price change and historical open-interest change are unavailable.':price===null?'Verified price change is unavailable.':'Historical open-interest change is unavailable.',
    annotations,
    boundary:'Funding, premium and basis are descriptive annotations only and are never substituted for missing open-interest change. Positioning state is descriptive, not ground-truth trader positioning or a directional signal.'
  };
  const priceUp=price>priceEpsilon,priceDown=price< -priceEpsilon,oiUp=oi>oiEpsilon,oiDown=oi< -oiEpsilon;
  let state='NEUTRAL_MIXED';
  if(priceUp&&oiUp)state='LONG_BUILD_UP';
  else if(priceDown&&oiUp)state='SHORT_BUILD_UP';
  else if(priceUp&&oiDown)state='SHORT_COVERING';
  else if(priceDown&&oiDown)state='LONG_UNWINDING';
  return {
    state,
    available:true,
    priceChangePct:round(price,4),
    openInterestChangePct:round(oi,4),
    priceEpsilonPct:priceEpsilon,
    openInterestEpsilonPct:oiEpsilon,
    definition:POSITIONING_DEFINITIONS[state],
    reason:state==='NEUTRAL_MIXED'?'At least one verified change is inside the neutral threshold.':'State follows the explicit price/open-interest quadrant definition.',
    annotations,
    boundary:'Descriptive price/open-interest quadrant only. It does not identify individual trader positioning, prove institutional flow, or independently create BUY/SELL eligibility.'
  };
}

export function buildFundingHistoryContext(raw,{currentFundingRate=null,currentPremium=null}={}){
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
    fundingState:'UNAVAILABLE',
    fundingShiftState:'UNAVAILABLE',
    medianFundingPct:null,
    minFundingPct:null,
    maxFundingPct:null,
    previousPremium:null,
    premiumChangeBps:null,
    premiumPercentile:null,
    premiumState:'UNAVAILABLE',
    premiumShiftState:'UNAVAILABLE',
    medianPremiumPct:null,
    minPremiumPct:null,
    maxPremiumPct:null,
    latestHistoricalAt:null,
    reason:'Historical funding observations are unavailable.'
  };
  const rates=rows.map(item=>item.fundingRate);
  const premiums=rows.map(item=>item.premium).filter(Number.isFinite);
  const current=finite(currentFundingRate);
  const currentPremiumValue=finite(currentPremium);
  const previous=rows.at(-1)?.fundingRate??null;
  const previousPremium=[...rows].reverse().find(item=>Number.isFinite(item.premium))?.premium??null;
  const firstTime=rows[0].time,lastTime=rows.at(-1).time;
  const fundingChangeBps=current===null||previous===null?null:(current-previous)*10_000;
  const premiumChangeBps=currentPremiumValue===null||previousPremium===null?null:(currentPremiumValue-previousPremium)*10_000;
  const fundingPercentile=current===null?null:percentileRank(rates,current);
  const premiumPercentile=currentPremiumValue===null||!premiums.length?null:percentileRank(premiums,currentPremiumValue);
  return {
    state:'available',
    sampleSize:rows.length,
    premiumSampleSize:premiums.length,
    windowHours:round(Math.max(0,lastTime-firstTime)/3_600_000,1),
    previousFundingRate:round(previous,10),
    previousFundingPct:previous===null?null:round(previous*100,6),
    fundingChangeBps:round(fundingChangeBps,4),
    fundingPercentile:round(fundingPercentile,4),
    fundingState:signedState(current,{epsilon:.000005,positive:'POSITIVE_CARRY',negative:'NEGATIVE_CARRY',flat:'NEAR_ZERO_CARRY'}),
    fundingShiftState:shiftState(fundingChangeBps),
    medianFundingPct:round(median(rates)*100,6),
    minFundingPct:round(Math.min(...rates)*100,6),
    maxFundingPct:round(Math.max(...rates)*100,6),
    previousPremium:round(previousPremium,10),
    previousPremiumPct:previousPremium===null?null:round(previousPremium*100,6),
    premiumChangeBps:round(premiumChangeBps,4),
    premiumPercentile:round(premiumPercentile,4),
    premiumState:signedState(currentPremiumValue,{epsilon:.000005,positive:'POSITIVE_PREMIUM',negative:'NEGATIVE_PREMIUM',flat:'NEAR_FLAT_PREMIUM'}),
    premiumShiftState:shiftState(premiumChangeBps),
    medianPremiumPct:premiums.length?round(median(premiums)*100,6):null,
    minPremiumPct:premiums.length?round(Math.min(...premiums)*100,6):null,
    maxPremiumPct:premiums.length?round(Math.max(...premiums)*100,6):null,
    latestHistoricalAt:new Date(lastTime).toISOString(),
    method:'Hyperliquid settled funding history. Current funding and premium are compared only with prior settled observations from the same provider.',
    limitations:[
      'Funding history does not provide historical open interest.',
      'Funding and premium percentiles are descriptive carry context, not a win probability or trade signal.',
      'Historical mark/oracle basis change is not inferred from premium history.'
    ]
  };
}

export const __decisionDerivativesTest=Object.freeze({median,percentileRank,signedState,shiftState,POSITIONING_DEFINITIONS});