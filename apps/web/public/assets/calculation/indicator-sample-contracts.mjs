const DEFAULT_LENGTH=96;
const DEFAULT_PERIOD=14;

const round=(value)=>Number(value.toFixed(6));

export function createIndicatorSampleInputs(definition,{length=DEFAULT_LENGTH}={}){
  const size=Math.max(48,Math.min(512,Math.trunc(Number(length)||DEFAULT_LENGTH)));
  const close=Array.from({length:size},(_,index)=>{
    const trend=100+index*.18;
    const mediumCycle=Math.sin(index/4.25)*3.4;
    const shortCycle=Math.cos(index/1.9)*1.15;
    const regime=index>size*.62?-((index-size*.62)*.055):0;
    return round(Math.max(1,trend+mediumCycle+shortCycle+regime));
  });
  const open=close.map((value,index)=>round(Math.max(1,value+Math.sin(index*1.37)*.72)));
  const high=close.map((value,index)=>round(Math.max(value,open[index])+1.05+(index%5)*.09));
  const low=close.map((value,index)=>round(Math.max(.01,Math.min(value,open[index])-1.02-(index%4)*.08)));
  const volume=close.map((_,index)=>Math.round(1250+index*19+(index%7)*83+Math.abs(Math.sin(index/3))*420));
  const configured=definition?.parameters&&typeof definition.parameters==='object'?definition.parameters:{};
  return {
    open,
    high,
    low,
    close,
    volume,
    period:Number.isFinite(Number(configured.period))?Number(configured.period):DEFAULT_PERIOD,
    ...configured
  };
}

export function indicatorSampleContractMetadata(){
  return Object.freeze({
    purpose:'presentation-only deterministic indicator sample',
    length:DEFAULT_LENGTH,
    inputOrdering:'oldest-to-newest',
    includes:['open','high','low','close','volume'],
    externalProviderRequired:false,
    calculationEngineModified:false
  });
}
