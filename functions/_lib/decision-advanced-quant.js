const finite=(value)=>Number.isFinite(Number(value))?Number(value):null;
const mean=(values)=>values.length?values.reduce((sum,value)=>sum+value,0)/values.length:0;
const std=(values)=>{if(!values.length)return 0;const m=mean(values);return Math.sqrt(mean(values.map(value=>(value-m)**2)));};
const quantile=(values,p)=>{if(!values.length)return null;const sorted=[...values].sort((a,b)=>a-b);const index=(sorted.length-1)*p;const low=Math.floor(index),weight=index-low;return sorted[low]+((sorted[low+1]??sorted[low])-sorted[low])*weight;};
const round=(value,digits=4)=>Number.isFinite(value)?Number(value.toFixed(digits)):null;
const clamp=(value,min=0,max=1)=>Math.min(max,Math.max(min,value));

const validCandles=(candles)=>(Array.isArray(candles)?candles:[]).filter(item=>[item?.open,item?.high,item?.low,item?.close,item?.volume].every(value=>Number.isFinite(Number(value)))&&Number(item.open)>0&&Number(item.high)>0&&Number(item.low)>0&&Number(item.close)>0);

const logReturns=(candles)=>candles.slice(1).map((item,index)=>Math.log(Number(item.close)/Number(candles[index].close)));

const efficiencyRatio=(closes)=>{
  if(closes.length<2)return null;
  const net=Math.abs(closes.at(-1)-closes[0]);
  const path=closes.slice(1).reduce((sum,value,index)=>sum+Math.abs(value-closes[index]),0);
  return path?net/path:0;
};

const rollingVolatility=(returns,window=20)=>{
  const values=[];
  for(let end=window;end<=returns.length;end++)values.push(std(returns.slice(end-window,end)));
  return values;
};

export function computeAdvancedDecisionMetrics(candles,{intervalMs=900_000}={}){
  const rows=validCandles(candles);
  if(rows.length<20)return {
    garmanKlassVolatilityPct:null,
    rogersSatchellVolatilityPct:null,
    efficiencyRatio:null,
    roc14Pct:null,
    bollingerZ20:null,
    rangePosition20Pct:null,
    volatilityPercentile:null,
    volatilityRegime:'unavailable',
    downsideDeviationPct:null
  };
  const closes=rows.map(item=>Number(item.close));
  const returns=logReturns(rows);
  const annualizer=Math.sqrt(365*86_400_000/Math.max(1,Number(intervalMs)||900_000));

  const gkTerms=rows.map(item=>{
    const high=Number(item.high),low=Number(item.low),open=Number(item.open),close=Number(item.close);
    const hl=Math.log(high/low),co=Math.log(close/open);
    return .5*hl**2-(2*Math.log(2)-1)*co**2;
  });
  const rsTerms=rows.map(item=>{
    const high=Number(item.high),low=Number(item.low),open=Number(item.open),close=Number(item.close);
    return Math.log(high/open)*Math.log(high/close)+Math.log(low/open)*Math.log(low/close);
  });
  const gk=Math.sqrt(Math.max(0,mean(gkTerms)))*annualizer*100;
  const rs=Math.sqrt(Math.max(0,mean(rsTerms)))*annualizer*100;

  const recent20=closes.slice(-20),mean20=mean(recent20),std20=std(recent20);
  const recentRange=rows.slice(-20),rangeLow=Math.min(...recentRange.map(item=>Number(item.low))),rangeHigh=Math.max(...recentRange.map(item=>Number(item.high)));
  const last=closes.at(-1);
  const rolling=rollingVolatility(returns,20),currentVol=rolling.at(-1)??null;
  const percentile=currentVol===null||!rolling.length?null:rolling.filter(value=>value<=currentVol).length/rolling.length;
  const regime=percentile===null?'unavailable':percentile<.25?'low':percentile<.75?'normal':percentile<.9?'elevated':'high';
  const downside=returns.filter(value=>value<0);
  const downsideDeviation=Math.sqrt(mean(downside.map(value=>value**2)))*annualizer*100;

  return {
    garmanKlassVolatilityPct:round(gk,2),
    rogersSatchellVolatilityPct:round(rs,2),
    efficiencyRatio:round(efficiencyRatio(closes),3),
    roc14Pct:closes.length>=15?round((last/closes.at(-15)-1)*100,2):null,
    bollingerZ20:std20?round((last-mean20)/std20,2):0,
    rangePosition20Pct:rangeHigh>rangeLow?round((last-rangeLow)/(rangeHigh-rangeLow)*100,1):null,
    volatilityPercentile:percentile===null?null:round(percentile,3),
    volatilityRegime:regime,
    downsideDeviationPct:round(downsideDeviation,2)
  };
}

const windowFeatures=(candles,start,end)=>{
  const window=candles.slice(start,end);
  if(window.length<2)return null;
  const closes=window.map(item=>Number(item.close));
  const returns=logReturns(window);
  const cumulative=Math.log(closes.at(-1)/closes[0]);
  const volatility=std(returns);
  const range=(Math.max(...window.map(item=>Number(item.high)))/Math.min(...window.map(item=>Number(item.low)))-1);
  const efficiency=efficiencyRatio(closes)??0;
  const volumeMean=mean(window.map(item=>Number(item.volume)));
  return {cumulative,volatility,range,efficiency,volumeMean};
};

export function buildHistoricalDecisionAnalogs(candles,{lookbackBars=20,horizonBars=16,maxAnalogs=12}={}){
  const rows=validCandles(candles);
  const lookback=Math.max(10,Math.min(60,Math.floor(Number(lookbackBars)||20)));
  const horizon=Math.max(2,Math.min(64,Math.floor(Number(horizonBars)||16)));
  const limit=Math.max(3,Math.min(20,Math.floor(Number(maxAnalogs)||12)));
  if(rows.length<lookback+horizon+40)return {state:'insufficient-history',count:0,analogs:[],summary:null,methodology:'Historical analogs require enough non-overlapping observed history.'};

  const current=windowFeatures(rows,rows.length-lookback,rows.length);
  const candidates=[];
  const step=Math.max(2,Math.floor(lookback/4));
  for(let end=lookback;end<=rows.length-horizon-lookback;end+=step){
    const features=windowFeatures(rows,end-lookback,end);
    if(!features)continue;
    const entry=Number(rows[end-1].close),exit=Number(rows[end+horizon-1].close);
    if(!(entry>0&&exit>0))continue;
    candidates.push({end,features,outcome:exit/entry-1,startTime:rows[end-lookback].time,endTime:rows[end-1].time});
  }
  if(candidates.length<3)return {state:'insufficient-history',count:0,analogs:[],summary:null,methodology:'Historical analogs require at least three eligible prior windows.'};

  const keys=['cumulative','volatility','range','efficiency'];
  const scales=Object.fromEntries(keys.map(key=>[key,std(candidates.map(item=>item.features[key]))||1]));
  const ranked=candidates.map(item=>{
    const distance=Math.sqrt(keys.reduce((sum,key)=>sum+((item.features[key]-current[key])/scales[key])**2,0));
    return {...item,distance};
  }).sort((a,b)=>a.distance-b.distance).slice(0,limit);

  const outcomes=ranked.map(item=>item.outcome);
  const summary={
    medianOutcomePct:round((quantile(outcomes,.5)??0)*100,2),
    p25OutcomePct:round((quantile(outcomes,.25)??0)*100,2),
    p75OutcomePct:round((quantile(outcomes,.75)??0)*100,2),
    positiveRate:round(outcomes.filter(value=>value>0).length/outcomes.length,3),
    negativeRate:round(outcomes.filter(value=>value<0).length/outcomes.length,3)
  };
  return {
    state:'derived',
    count:ranked.length,
    lookbackBars:lookback,
    horizonBars:horizon,
    analogs:ranked.map(item=>({
      startTime:item.startTime,
      endTime:item.endTime,
      distance:round(item.distance,3),
      outcomePct:round(item.outcome*100,2)
    })),
    summary,
    methodology:'Nearest prior windows are ranked by standardized distance across cumulative return, realized volatility, range and trend efficiency. Results are descriptive historical analogs, not forecast probabilities.'
  };
}
