const SCHEMA_VERSION='qelly.decision-quant-research/1.0.0';
const finite=(value)=>value==null||value===''?null:Number.isFinite(Number(value))?Number(value):null;
const clamp=(value,min=-Infinity,max=Infinity)=>Math.min(max,Math.max(min,Number(value)));
const round=(value,digits=6)=>Number.isFinite(Number(value))?Number(Number(value).toFixed(digits)):null;
const mean=(values)=>values.length?values.reduce((sum,value)=>sum+value,0)/values.length:null;
const variance=(values)=>{const m=mean(values);return m==null?null:mean(values.map(value=>(value-m)**2));};
const std=(values)=>{const v=variance(values);return v==null?null:Math.sqrt(Math.max(0,v));};
const quantile=(values,p)=>{
  const valid=values.filter(Number.isFinite).sort((a,b)=>a-b);
  if(!valid.length)return null;
  const index=(valid.length-1)*clamp(p,0,1),low=Math.floor(index),weight=index-low;
  return valid[low]+((valid[low+1]??valid[low])-valid[low])*weight;
};
const median=(values)=>quantile(values,.5);
const percentileRank=(values,value)=>{
  const valid=values.filter(Number.isFinite);
  if(!valid.length||!Number.isFinite(value))return null;
  return valid.filter(item=>item<=value).length/valid.length;
};
const covariance=(a,b)=>{
  const n=Math.min(a.length,b.length);
  if(n<2)return null;
  const x=a.slice(-n),y=b.slice(-n),mx=mean(x),my=mean(y);
  return mean(x.map((value,index)=>(value-mx)*(y[index]-my)));
};
const correlation=(a,b)=>{
  const n=Math.min(a.length,b.length);
  if(n<3)return null;
  const x=a.slice(-n),y=b.slice(-n),sx=std(x),sy=std(y);
  if(!(sx>0&&sy>0))return null;
  return covariance(x,y)/(sx*sy);
};
const annualizer=(intervalMs)=>Math.sqrt(365*86_400_000/intervalMs);
const safeRatio=(numerator,denominator)=>Number.isFinite(numerator)&&Number.isFinite(denominator)&&Math.abs(denominator)>1e-12?numerator/denominator:null;
const sanitize=(value)=>JSON.parse(JSON.stringify(value,(key,item)=>typeof item==='number'&&!Number.isFinite(item)?null:item));

const FORMULAS=Object.freeze([
  ['arithmetic-return','returns','descriptive','Close-to-close arithmetic return.'],
  ['log-return','returns','descriptive','Natural-log close-to-close return.'],
  ['cumulative-return','returns','descriptive','First-to-last arithmetic return over the supplied sample.'],
  ['rolling-return','returns','descriptive','Arithmetic return over fixed rolling lookback windows.'],
  ['excess-return','returns','descriptive','Arithmetic return minus an explicit per-bar risk-free input.'],
  ['relative-return','returns','context_only','Cumulative return relative to an aligned benchmark.'],
  ['realized-volatility','volatility','risk_context','Annualized standard deviation of log returns.'],
  ['ewma-volatility','volatility','risk_context','Annualized EWMA volatility using explicit lambda.'],
  ['parkinson-volatility','volatility','risk_context','Range-based Parkinson volatility estimator.'],
  ['garman-klass-volatility','volatility','risk_context','OHLC Garman-Klass volatility estimator.'],
  ['rogers-satchell-volatility','volatility','risk_context','OHLC Rogers-Satchell volatility estimator.'],
  ['atr','volatility','risk_context','Average true range over the configured lookback.'],
  ['normalized-atr','volatility','risk_context','ATR divided by current close.'],
  ['downside-deviation','volatility','risk_context','Annualized root mean square of negative log returns.'],
  ['upside-deviation','volatility','risk_context','Annualized root mean square of positive log returns.'],
  ['volatility-percentile','volatility','risk_context','Percentile rank of current rolling realized volatility.'],
  ['volatility-cone','volatility','research_context','Current and historical volatility quantiles across multiple windows.'],
  ['mean','distribution','descriptive','Mean log return.'],
  ['median','distribution','descriptive','Median log return.'],
  ['variance','distribution','descriptive','Variance of log returns.'],
  ['skew','distribution','descriptive','Standardized third central moment.'],
  ['kurtosis','distribution','descriptive','Excess kurtosis from the standardized fourth central moment.'],
  ['quantiles','distribution','descriptive','Selected empirical log-return quantiles.'],
  ['tail-frequency','distribution','risk_context','Share of observations at least two standard deviations from the mean.'],
  ['z-score','distribution','research_context','Latest log return standardized by sample mean/std.'],
  ['robust-z-score','distribution','research_context','Latest log return standardized by median absolute deviation.'],
  ['mad','distribution','descriptive','Median absolute deviation of log returns.'],
  ['percentile-rank','distribution','descriptive','Empirical percentile rank of the latest log return.'],
  ['historical-var','risk','risk_context','Historical 95% one-bar Value at Risk from empirical returns.'],
  ['expected-shortfall','risk','risk_context','Historical 95% Expected Shortfall from the lower empirical tail.'],
  ['drawdown','risk','risk_context','Current drawdown from running peak.'],
  ['max-drawdown','risk','risk_context','Worst observed drawdown in the supplied sample.'],
  ['downside-risk','risk','risk_context','Root mean square downside return.'],
  ['upside-downside-capture','risk','context_only','Relative average returns during benchmark up/down observations.'],
  ['beta','dependence','context_only','Covariance with benchmark divided by benchmark variance.'],
  ['correlation','dependence','context_only','Pearson correlation against an aligned benchmark.'],
  ['tail-ratio','risk','risk_context','Upper-tail 95th quantile divided by absolute lower-tail 5th quantile.'],
  ['sma-hierarchy','trend','research_context','Relative ordering of short/medium/long simple moving averages.'],
  ['ema-hierarchy','trend','research_context','Relative ordering of short/medium/long exponential moving averages.'],
  ['ols-slope','trend','research_context','OLS log-price slope per bar.'],
  ['robust-slope','trend','research_context','Theil-Sen median pairwise log-price slope.'],
  ['efficiency-ratio','trend','research_context','Net displacement divided by absolute path distance.'],
  ['adx','trend','relevance_modifier','Average Directional Index from directional movement.'],
  ['directional-movement','trend','research_context','Positive/negative directional index pair.'],
  ['persistence','trend','research_context','Share of recent returns agreeing with net trend direction.'],
  ['trend-age','trend','research_context','Consecutive closes on the current side of EMA20.'],
  ['trend-acceleration','trend','research_context','Difference between recent and preceding OLS slopes.'],
  ['roc','momentum','research_context','14-bar rate of change.'],
  ['rsi','momentum','research_context','14-bar Relative Strength Index.'],
  ['macd','momentum','research_context','EMA12 minus EMA26 with EMA9 signal.'],
  ['normalized-momentum','momentum','research_context','ROC normalized by recent return dispersion.'],
  ['momentum-z-score','momentum','research_context','Latest rolling ROC standardized by historical rolling ROC distribution.'],
  ['momentum-acceleration','momentum','research_context','Difference between recent and preceding short-horizon ROC.'],
  ['stochastic','momentum','research_context','Close location within the 14-bar high/low range.'],
  ['donchian-channel','technical','research_context','20-bar prior high/low channel with current close position and breakout state.'],
  ['ichimoku-cloud','technical','research_context','Unshifted current Tenkan/Kijun and 52-bar cloud context; descriptive only.'],
  ['obv','technical','context_only','On-balance volume accumulation from close direction and observed bar volume.'],
  ['mfi','technical','context_only','14-bar Money Flow Index from typical-price direction and observed bar volume.'],
  ['cmf','technical','context_only','20-bar Chaikin Money Flow from close location and observed bar volume.'],
  ['classic-pivots','technical','research_context','Classic pivot, S1/S2 and R1/R2 levels from the previous completed bar.'],
  ['supertrend','technical','redundant_excluded','Explicitly excluded from voting because ATR, trend structure and breakout/retest evidence already cover its role.'],
  ['bollinger-z','mean_reversion','research_context','Close deviation from SMA20 in standard-deviation units.'],
  ['rolling-deviation','mean_reversion','research_context','Percent deviation of close from SMA20.'],
  ['range-position','mean_reversion','research_context','Close position within the recent high/low range.'],
  ['vwap-deviation','mean_reversion','research_context','Percent deviation from volume-weighted typical price.'],
  ['mean-reversion-half-life','mean_reversion','research_context','AR(1)-style half-life on bounded log-price deviations when statistically coherent.'],
  ['rolling-correlation','dependence','context_only','Recent return correlation against a benchmark.'],
  ['relative-strength','dependence','context_only','Cumulative return spread versus benchmark.'],
  ['rolling-regression','dependence','context_only','Return alpha/beta/R² against an aligned benchmark.'],
  ['spread-z-score','dependence','context_only','Standardized log-price spread using benchmark beta.'],
  ['lead-lag','dependence','context_only','Cross-correlation exploration over small integer lags.'],
  ['cointegration','dependence','unavailable_without_validated_test','Not inferred from correlation or spread z-score; requires a validated significance test.'],
  ['empirical-distribution','forecasting','research_input','Empirical one-bar return distribution used as a forecast input.'],
  ['block-bootstrap','forecasting','research_input','Implemented by the deterministic Decision scenario engine; preserves empirical return blocks.']
].map(([id,family,role,definition])=>Object.freeze({id,family,role,definition})));

const normalizeCandles=(input)=>Array.isArray(input)?input.map(item=>({
  time:finite(item?.time??item?.t),
  open:finite(item?.open??item?.o),
  high:finite(item?.high??item?.h),
  low:finite(item?.low??item?.l),
  close:finite(item?.close??item?.c),
  volume:Math.max(0,finite(item?.volume??item?.v)??0)
})).filter(item=>[item.time,item.open,item.high,item.low,item.close].every(Number.isFinite)&&item.time>0&&item.open>0&&item.high>0&&item.low>0&&item.close>0&&item.high>=Math.max(item.open,item.close)&&item.low<=Math.min(item.open,item.close)).sort((a,b)=>a.time-b.time):[];

const arithmeticReturns=(closes)=>closes.slice(1).map((value,index)=>value/closes[index]-1);
const logReturns=(closes)=>closes.slice(1).map((value,index)=>Math.log(value/closes[index]));

const sma=(values,period)=>values.length>=period?mean(values.slice(-period)):null;
const emaSeries=(values,period)=>{
  if(!values.length)return [];
  const alpha=2/(period+1),out=[values[0]];
  for(let index=1;index<values.length;index++)out.push(alpha*values[index]+(1-alpha)*out[index-1]);
  return out;
};
const ema=(values,period)=>emaSeries(values,period).at(-1)??null;

const rollingReturns=(closes,period)=>{
  const output=[];
  for(let i=period;i<closes.length;i++)output.push(closes[i]/closes[i-period]-1);
  return output;
};

const ols=(x,y)=>{
  const n=Math.min(x.length,y.length);
  if(n<3)return {alpha:null,beta:null,r2:null};
  const xs=x.slice(-n),ys=y.slice(-n),mx=mean(xs),my=mean(ys),vx=variance(xs);
  if(!(vx>1e-18))return {alpha:null,beta:null,r2:null};
  const beta=covariance(xs,ys)/vx,alpha=my-beta*mx,corr=correlation(xs,ys);
  return {alpha,beta,r2:corr==null?null:corr*corr};
};

const olsSlope=(values)=>{
  if(values.length<3)return null;
  const x=values.map((_,index)=>index);
  return ols(x,values).beta;
};

const theilSenSlope=(values,maxPoints=60)=>{
  const rows=values.slice(-maxPoints);
  if(rows.length<3)return null;
  const slopes=[];
  for(let i=0;i<rows.length-1;i++)for(let j=i+1;j<rows.length;j++)slopes.push((rows[j]-rows[i])/(j-i));
  return median(slopes);
};

const directionalMovement=(candles,period=14)=>{
  if(candles.length<period*2+1)return {adx:null,plusDI:null,minusDI:null};
  const trs=[],plusDM=[],minusDM=[];
  for(let i=1;i<candles.length;i++){
    const current=candles[i],previous=candles[i-1];
    const up=current.high-previous.high,down=previous.low-current.low;
    trs.push(Math.max(current.high-current.low,Math.abs(current.high-previous.close),Math.abs(current.low-previous.close)));
    plusDM.push(up>down&&up>0?up:0);
    minusDM.push(down>up&&down>0?down:0);
  }
  const dx=[],dis=[];
  for(let end=period;end<=trs.length;end++){
    const tr=mean(trs.slice(end-period,end));
    if(!(tr>0))continue;
    const plus=100*mean(plusDM.slice(end-period,end))/tr;
    const minus=100*mean(minusDM.slice(end-period,end))/tr;
    const denom=plus+minus;
    if(denom>0)dx.push(100*Math.abs(plus-minus)/denom);
    dis.push({plus,minus});
  }
  return {adx:dx.length?mean(dx.slice(-period)):null,plusDI:dis.at(-1)?.plus??null,minusDI:dis.at(-1)?.minus??null};
};

const rsi=(closes,period=14)=>{
  if(closes.length<=period)return null;
  const changes=closes.slice(1).map((value,index)=>value-closes[index]);
  const recent=changes.slice(-period),up=mean(recent.map(value=>Math.max(0,value))),down=mean(recent.map(value=>Math.max(0,-value)));
  if(down===0)return up>0?100:50;
  return 100-(100/(1+up/down));
};

const trueRanges=(candles)=>candles.slice(1).map((item,index)=>{
  const previousClose=candles[index].close;
  return Math.max(item.high-item.low,Math.abs(item.high-previousClose),Math.abs(item.low-previousClose));
});

const rollingVolatility=(returns,window,ann)=>{
  const series=[];
  for(let end=window;end<=returns.length;end++){
    const sigma=std(returns.slice(end-window,end));
    if(Number.isFinite(sigma))series.push(sigma*ann*100);
  }
  return series;
};

const drawdowns=(closes)=>{
  let peak=closes[0]??null;
  return closes.map(value=>{
    peak=peak==null?value:Math.max(peak,value);
    return peak>0?value/peak-1:0;
  });
};

const rollingRocSeries=(closes,period=14)=>{
  const output=[];
  for(let i=period;i<closes.length;i++)output.push(closes[i]/closes[i-period]-1);
  return output;
};

const windowMidpoint=(rows,period)=>{
  if(rows.length<period)return null;
  const window=rows.slice(-period),high=Math.max(...window.map(item=>item.high)),low=Math.min(...window.map(item=>item.low));
  return {high,low,mid:(high+low)/2};
};

const donchianChannel=(rows,period=20)=>{
  if(rows.length<period+1)return {state:'UNAVAILABLE',period,upper:null,lower:null,middle:null,position:null};
  const prior=rows.slice(-(period+1),-1),upper=Math.max(...prior.map(item=>item.high)),lower=Math.min(...prior.map(item=>item.low)),middle=(upper+lower)/2,current=rows.at(-1).close;
  const position=current>upper?'UPPER_BREAK':current<lower?'LOWER_BREAK':current>=middle?'UPPER_HALF':'LOWER_HALF';
  return {state:'AVAILABLE',period,upper:round(upper,6),lower:round(lower,6),middle:round(middle,6),position};
};

const ichimokuContext=(rows)=>{
  if(rows.length<52)return {state:'UNAVAILABLE',tenkan:null,kijun:null,spanA:null,spanB:null,cloudPosition:null,reason:'At least 52 validated OHLC bars are required.'};
  const p9=windowMidpoint(rows,9),p26=windowMidpoint(rows,26),p52=windowMidpoint(rows,52),tenkan=p9.mid,kijun=p26.mid,spanA=(tenkan+kijun)/2,spanB=p52.mid,current=rows.at(-1).close,top=Math.max(spanA,spanB),bottom=Math.min(spanA,spanB);
  return {state:'AVAILABLE',tenkan:round(tenkan,6),kijun:round(kijun,6),spanA:round(spanA,6),spanB:round(spanB,6),cloudPosition:current>top?'ABOVE':current<bottom?'BELOW':'INSIDE',boundary:'Current unshifted cloud context only; it is not an independent directional vote.'};
};

const onBalanceVolume=(rows)=>{
  if(rows.length<2)return {state:'UNAVAILABLE',value:null,change20:null};
  const series=[0];
  for(let i=1;i<rows.length;i++){
    const delta=rows[i].close>rows[i-1].close?rows[i].volume:rows[i].close<rows[i-1].close?-rows[i].volume:0;
    series.push(series.at(-1)+delta);
  }
  const start=Math.max(0,series.length-21);
  return {state:'AVAILABLE',value:round(series.at(-1),2),change20:round(series.at(-1)-series[start],2)};
};

const moneyFlowIndex=(rows,period=14)=>{
  if(rows.length<period+1)return {state:'UNAVAILABLE',period,value:null};
  const slice=rows.slice(-(period+1)),flows=[];
  for(let i=1;i<slice.length;i++){
    const current=(slice[i].high+slice[i].low+slice[i].close)/3,previous=(slice[i-1].high+slice[i-1].low+slice[i-1].close)/3,raw=current*slice[i].volume;
    flows.push({positive:current>previous?raw:0,negative:current<previous?raw:0});
  }
  const positive=flows.reduce((sum,item)=>sum+item.positive,0),negative=flows.reduce((sum,item)=>sum+item.negative,0);
  const value=negative===0?(positive>0?100:50):100-(100/(1+positive/negative));
  return {state:'AVAILABLE',period,value:round(value,3),positiveFlow:round(positive,2),negativeFlow:round(negative,2)};
};

const chaikinMoneyFlow=(rows,period=20)=>{
  if(rows.length<period)return {state:'UNAVAILABLE',period,value:null};
  const slice=rows.slice(-period);let flow=0,volume=0;
  for(const item of slice){
    const range=item.high-item.low,multiplier=range>0?((item.close-item.low)-(item.high-item.close))/range:0;
    flow+=multiplier*item.volume;volume+=item.volume;
  }
  return {state:'AVAILABLE',period,value:round(volume>0?flow/volume:0,4)};
};

const classicPivots=(rows)=>{
  if(rows.length<2)return {state:'UNAVAILABLE',pivot:null,r1:null,r2:null,s1:null,s2:null};
  const previous=rows.at(-2),pivot=(previous.high+previous.low+previous.close)/3,range=previous.high-previous.low;
  return {state:'AVAILABLE',pivot:round(pivot,6),r1:round(2*pivot-previous.low,6),r2:round(pivot+range,6),s1:round(2*pivot-previous.high,6),s2:round(pivot-range,6),sourceTime:previous.time};
};

const technicalAudit=(technical)=>[
  {id:'rsi',state:'IMPLEMENTED',role:'research_context'},
  {id:'macd',state:'IMPLEMENTED',role:'research_context'},
  {id:'adx',state:'IMPLEMENTED',role:'relevance_modifier'},
  {id:'atr',state:'IMPLEMENTED',role:'risk_context'},
  {id:'bollinger',state:'IMPLEMENTED',role:'research_context'},
  {id:'donchian',state:technical.donchian.state==='AVAILABLE'?'IMPLEMENTED':'UNAVAILABLE',role:'research_context'},
  {id:'ichimoku',state:technical.ichimoku.state==='AVAILABLE'?'IMPLEMENTED_RESEARCH_ONLY':'UNAVAILABLE',role:'research_context'},
  {id:'vwap',state:'IMPLEMENTED',role:'research_context'},
  {id:'obv',state:technical.obv.state==='AVAILABLE'?'IMPLEMENTED_RESEARCH_ONLY':'UNAVAILABLE',role:'context_only'},
  {id:'mfi',state:technical.mfi.state==='AVAILABLE'?'IMPLEMENTED_RESEARCH_ONLY':'UNAVAILABLE',role:'context_only'},
  {id:'cmf',state:technical.cmf.state==='AVAILABLE'?'IMPLEMENTED_RESEARCH_ONLY':'UNAVAILABLE',role:'context_only'},
  {id:'supertrend',state:'EXCLUDED_REDUNDANT',role:'redundant_excluded',reason:'ATR, deterministic trend structure and breakout/retest evidence already cover its research role; no extra vote is added.'},
  {id:'pivots',state:technical.pivots.state==='AVAILABLE'?'IMPLEMENTED_RESEARCH_ONLY':'UNAVAILABLE',role:'research_context'},
  {id:'moving-averages',state:'IMPLEMENTED',role:'research_context'}
];

const halfLife=(closes)=>{
  const logs=closes.slice(-80).map(Math.log);
  if(logs.length<30)return {state:'UNAVAILABLE',halfLifeBars:null,phi:null,r2:null,reason:'At least 30 observations are required.'};
  const center=mean(logs),dev=logs.map(value=>value-center);
  const x=dev.slice(0,-1),y=dev.slice(1),fit=ols(x,y),phi=fit.beta;
  if(!(phi>0&&phi<.999&&Number.isFinite(fit.r2)&&fit.r2>=.1))return {state:'UNAVAILABLE',halfLifeBars:null,phi:round(phi,4),r2:round(fit.r2,4),reason:'AR(1) persistence is not in the validated mean-reverting range or fit quality is too weak.'};
  return {state:'AVAILABLE',halfLifeBars:round(-Math.log(2)/Math.log(phi),3),phi:round(phi,4),r2:round(fit.r2,4),reason:'Descriptive AR(1) half-life on bounded log-price deviations; not proof of stationarity or cointegration.'};
};

const pairedBenchmark=(rows,benchmark)=>{
  const map=new Map(normalizeCandles(benchmark).map(item=>[item.time,item]));
  return rows.map(item=>({own:item,bench:map.get(item.time)})).filter(item=>item.bench);
};

const dependence=(rows,benchmarkCandles)=>{
  const paired=pairedBenchmark(rows,benchmarkCandles);
  if(paired.length<31)return {
    state:'UNAVAILABLE',sampleSize:paired.length,correlation:null,beta:null,relativeStrengthPct:null,rollingRegression:null,spreadZScore:null,leadLag:null,
    cointegration:{state:'NOT_EVALUATED',reason:'Cointegration requires a separately validated significance test; correlation or spread z-score is insufficient.'},
    reason:'At least 31 timestamp-aligned benchmark candles are required.'
  };
  const ownCloses=paired.map(item=>item.own.close),benchCloses=paired.map(item=>item.bench.close);
  const ownReturns=logReturns(ownCloses),benchReturns=logReturns(benchCloses),n=Math.min(60,ownReturns.length);
  const x=benchReturns.slice(-n),y=ownReturns.slice(-n),fit=ols(x,y),corr=correlation(x,y),beta=fit.beta;
  const rel=(ownCloses.at(-1)/ownCloses[0]-1)-(benchCloses.at(-1)/benchCloses[0]-1);
  const spreads=Number.isFinite(beta)?ownCloses.map((value,index)=>Math.log(value)-beta*Math.log(benchCloses[index])):[];
  const spreadMean=mean(spreads),spreadStd=std(spreads),spreadZ=spreadStd>0?(spreads.at(-1)-spreadMean)/spreadStd:null;
  const lagRows=[];
  for(let lag=-3;lag<=3;lag++){
    const a=[],b=[];
    for(let i=0;i<ownReturns.length;i++){
      const j=i-lag;
      if(j>=0&&j<benchReturns.length){a.push(ownReturns[i]);b.push(benchReturns[j]);}
    }
    lagRows.push({lag,correlation:round(correlation(a,b),4)});
  }
  const validLags=lagRows.filter(item=>Number.isFinite(item.correlation));
  validLags.sort((a,b)=>Math.abs(b.correlation)-Math.abs(a.correlation)||Math.abs(a.lag)-Math.abs(b.lag));
  const benchArithmetic=arithmeticReturns(benchCloses),ownArithmetic=arithmeticReturns(ownCloses);
  const upOwn=[],upBench=[],downOwn=[],downBench=[];
  for(let i=0;i<Math.min(benchArithmetic.length,ownArithmetic.length);i++){
    if(benchArithmetic[i]>0){upOwn.push(ownArithmetic[i]);upBench.push(benchArithmetic[i]);}
    if(benchArithmetic[i]<0){downOwn.push(ownArithmetic[i]);downBench.push(benchArithmetic[i]);}
  }
  return {
    state:'AVAILABLE',
    sampleSize:paired.length,
    correlation:round(corr,4),
    beta:round(beta,4),
    relativeStrengthPct:round(rel*100,3),
    rollingRegression:{alpha:round(fit.alpha,6),beta:round(fit.beta,4),r2:round(fit.r2,4),window:n},
    spreadZScore:round(spreadZ,4),
    upsideCapture:round(safeRatio(mean(upOwn),mean(upBench)),4),
    downsideCapture:round(safeRatio(mean(downOwn),mean(downBench)),4),
    leadLag:{window:ownReturns.length,best:validLags[0]??null,rows:lagRows},
    cointegration:{state:'NOT_EVALUATED',reason:'Cointegration is not inferred from correlation, beta or spread z-score. A separately validated Engle-Granger/ADF significance test is required.'},
    boundary:'Dependence metrics are descriptive benchmark context and do not become an independent BUY/SELL vote.'
  };
};

export function buildDecisionQuantResearch(input,{intervalMs,riskFreePerBar=0,benchmarkCandles=null}={}){
  const rows=normalizeCandles(input);
  if(rows.length<80||!(intervalMs>0))return sanitize({
    schemaVersion:SCHEMA_VERSION,state:'INSUFFICIENT_DATA',sampleSize:rows.length,formulaCatalog:FORMULAS,
    boundary:'At least 80 validated OHLC candles and a positive interval are required. No formula output is fabricated.'
  });

  const closes=rows.map(item=>item.close),logs=closes.map(Math.log),arith=arithmeticReturns(closes),log=logReturns(closes),ann=annualizer(intervalMs);
  const avg=mean(log),sigma=std(log),med=median(log),mad=median(log.map(value=>Math.abs(value-med))),robustScale=mad>0?1.4826*mad:null;
  const centered=log.map(value=>value-avg),q01=quantile(log,.01),q05=quantile(log,.05),q25=quantile(log,.25),q50=quantile(log,.5),q75=quantile(log,.75),q95=quantile(log,.95),q99=quantile(log,.99);
  const latestLog=log.at(-1),z=sigma>0?(latestLog-avg)/sigma:null,robustZ=robustScale>0?(latestLog-med)/robustScale:null;
  const downside=log.filter(value=>value<0),upside=log.filter(value=>value>0),trs=trueRanges(rows),atr14=mean(trs.slice(-14)),currentClose=closes.at(-1);
  let ewmaVar=variance(log)??0;for(const value of log)ewmaVar=.94*ewmaVar+.06*value*value;
  const parkinsonRows=rows.map(item=>Math.log(item.high/item.low)**2);
  const gkRows=rows.map(item=>Math.max(0,.5*Math.log(item.high/item.low)**2-(2*Math.log(2)-1)*Math.log(item.close/item.open)**2));
  const rsRows=rows.map(item=>Math.max(0,Math.log(item.high/item.open)*Math.log(item.high/item.close)+Math.log(item.low/item.open)*Math.log(item.low/item.close)));
  const rolling20=rollingVolatility(log,20,ann),currentRolling=rolling20.at(-1),volPercentile=percentileRank(rolling20,currentRolling);
  const volatilityRegime=volPercentile==null?'UNKNOWN':volPercentile>=.85?'HIGH':volPercentile<=.2?'LOW':volPercentile>=.65?'ELEVATED':'NORMAL';
  const cone=Object.fromEntries([10,20,40,80].filter(window=>log.length>=window).map(window=>{
    const series=rollingVolatility(log,window,ann);
    return [String(window),{currentPct:round(series.at(-1),3),p25Pct:round(quantile(series,.25),3),p50Pct:round(quantile(series,.5),3),p75Pct:round(quantile(series,.75),3),sampleWindows:series.length}];
  }));

  const dd=drawdowns(closes),maxDd=Math.min(...dd),currentDd=dd.at(-1);
  const tailRatio=Math.abs(q05??0)>1e-12?(q95??0)/Math.abs(q05):null;
  const tailFrequency=sigma>0?log.filter(value=>Math.abs(value-avg)>=2*sigma).length/log.length:null;
  const excessReturn=mean(arith.map(value=>value-Number(riskFreePerBar||0)));

  const sma10=sma(closes,10),sma20=sma(closes,20),sma50=sma(closes,50),ema12=ema(closes,12),ema20=ema(closes,20),ema26=ema(closes,26),ema50=ema(closes,50);
  const smaState=sma10>sma20&&sma20>sma50?'BULLISH':sma10<sma20&&sma20<sma50?'BEARISH':'MIXED';
  const emaState=ema12>ema26&&ema26>ema50?'BULLISH':ema12<ema26&&ema26<ema50?'BEARISH':'MIXED';
  const logSlope=olsSlope(logs.slice(-60)),robustLogSlope=theilSenSlope(logs,60);
  const path=closes.slice(-20),efficiency=path.length>1?Math.abs(path.at(-1)-path[0])/Math.max(1e-12,path.slice(1).reduce((sum,value,index)=>sum+Math.abs(value-path[index]),0)):null;
  const dm=directionalMovement(rows,14);
  const netTrend=Math.sign((closes.at(-1)??0)-(closes.at(-21)??closes[0]??0));
  const persistenceReturns=arith.slice(-20),persistence=netTrend===0?0:persistenceReturns.filter(value=>Math.sign(value)===netTrend).length/Math.max(1,persistenceReturns.length);
  let trendAge=0;const trendSide=currentClose>=ema20?1:-1;for(let i=closes.length-1;i>=0;i--){const emaAt=emaSeries(closes.slice(0,i+1),20).at(-1);if(!Number.isFinite(emaAt)||Math.sign(closes[i]-emaAt)!==trendSide)break;trendAge++;}
  const recentSlope=olsSlope(logs.slice(-10)),priorSlope=olsSlope(logs.slice(-20,-10)),acceleration=Number.isFinite(recentSlope)&&Number.isFinite(priorSlope)?recentSlope-priorSlope:null;

  const roc14=closes.length>14?closes.at(-1)/closes.at(-15)-1:null,rsi14=rsi(closes,14);
  const ema12Series=emaSeries(closes,12),ema26Series=emaSeries(closes,26),macdSeries=closes.map((_,i)=>(ema12Series[i]??closes[i])-(ema26Series[i]??closes[i])),signalSeries=emaSeries(macdSeries,9),macdLine=macdSeries.at(-1),macdSignal=signalSeries.at(-1),macdHist=Number.isFinite(macdLine)&&Number.isFinite(macdSignal)?macdLine-macdSignal:null;
  const rocSeries=rollingRocSeries(closes,14),rocMean=mean(rocSeries),rocStd=std(rocSeries),momentumZ=rocStd>0?(rocSeries.at(-1)-rocMean)/rocStd:null;
  const normalizedMomentum=sigma>0?roc14/(sigma*Math.sqrt(14)):null;
  const roc5=closes.length>5?closes.at(-1)/closes.at(-6)-1:null,priorRoc5=closes.length>10?closes.at(-6)/closes.at(-11)-1:null,momentumAcceleration=Number.isFinite(roc5)&&Number.isFinite(priorRoc5)?roc5-priorRoc5:null;
  const recent14=rows.slice(-14),low14=Math.min(...recent14.map(item=>item.low)),high14=Math.max(...recent14.map(item=>item.high)),stochastic=high14>low14?(currentClose-low14)/(high14-low14)*100:null;

  const last20=closes.slice(-20),mrMean=mean(last20),mrStd=std(last20),bollingerZ=mrStd>0?(currentClose-mrMean)/mrStd:null,rollingDeviation=mrMean>0?currentClose/mrMean-1:null;
  const recent20Rows=rows.slice(-20),rangeLow=Math.min(...recent20Rows.map(item=>item.low)),rangeHigh=Math.max(...recent20Rows.map(item=>item.high)),rangePosition=rangeHigh>rangeLow?(currentClose-rangeLow)/(rangeHigh-rangeLow):null;
  const weighted=recent20Rows.reduce((acc,item)=>{const typical=(item.high+item.low+item.close)/3;acc.pv+=typical*item.volume;acc.v+=item.volume;return acc;},{pv:0,v:0});
  const vwap=weighted.v>0?weighted.pv/weighted.v:null,vwapDeviation=vwap>0?currentClose/vwap-1:null,half=halfLife(closes);

  const technical={
    donchian:donchianChannel(rows,20),
    ichimoku:ichimokuContext(rows),
    obv:onBalanceVolume(rows),
    mfi:moneyFlowIndex(rows,14),
    cmf:chaikinMoneyFlow(rows,20),
    pivots:classicPivots(rows),
    supertrend:{state:'EXCLUDED_REDUNDANT',reason:'ATR, deterministic trend structure and breakout/retest evidence already cover its research role; adding Supertrend as another vote would double-count trend/volatility evidence.'}
  };
  technical.audit=technicalAudit(technical);

  const dep=dependence(rows,benchmarkCandles);
  const relativeReturn=dep.state==='AVAILABLE'?dep.relativeStrengthPct:null;

  return sanitize({
    schemaVersion:SCHEMA_VERSION,
    state:'DERIVED',
    sampleSize:rows.length,
    formulaCatalog:FORMULAS,
    boundary:'This library is research/descriptive context. Metrics are not independent votes and do not change Decision eligibility unless a separate governed adapter explicitly consumes them.',
    returns:{
      arithmeticLatestPct:round((arith.at(-1)??0)*100,5),
      logLatestPct:round((latestLog??0)*100,5),
      cumulativePct:round((closes.at(-1)/closes[0]-1)*100,4),
      rolling5Pct:round((rollingReturns(closes,5).at(-1)??0)*100,4),
      rolling20Pct:round((rollingReturns(closes,20).at(-1)??0)*100,4),
      rolling60Pct:round((rollingReturns(closes,60).at(-1)??0)*100,4),
      meanExcessPerBarPct:round((excessReturn??0)*100,6),
      relativeReturnPct:round(relativeReturn,4)
    },
    volatility:{
      realizedPct:round((sigma??0)*ann*100,3),
      ewmaPct:round(Math.sqrt(Math.max(0,ewmaVar))*ann*100,3),
      parkinsonPct:round(Math.sqrt(mean(parkinsonRows)/(4*Math.log(2)))*ann*100,3),
      garmanKlassPct:round(Math.sqrt(mean(gkRows))*ann*100,3),
      rogersSatchellPct:round(Math.sqrt(mean(rsRows))*ann*100,3),
      atr14:round(atr14,6),
      normalizedAtr14Pct:round(atr14/currentClose*100,4),
      downsideDeviationPct:round(Math.sqrt(mean(downside.map(value=>value*value))||0)*ann*100,3),
      upsideDeviationPct:round(Math.sqrt(mean(upside.map(value=>value*value))||0)*ann*100,3),
      percentile:round(volPercentile,4),
      regime:volatilityRegime,
      cone
    },
    distribution:{
      meanPct:round((avg??0)*100,6),medianPct:round((med??0)*100,6),variance:round(variance(log),10),
      skew:round(sigma>0?mean(centered.map(value=>value**3))/sigma**3:null,4),
      excessKurtosis:round(sigma>0?mean(centered.map(value=>value**4))/sigma**4-3:null,4),
      quantilesPct:{q01:round((q01??0)*100,5),q05:round((q05??0)*100,5),q25:round((q25??0)*100,5),q50:round((q50??0)*100,5),q75:round((q75??0)*100,5),q95:round((q95??0)*100,5),q99:round((q99??0)*100,5)},
      tailFrequency:round(tailFrequency,4),zScore:round(z,4),robustZScore:round(robustZ,4),madPct:round((mad??0)*100,6),latestPercentileRank:round(percentileRank(log,latestLog),4)
    },
    risk:{
      historicalVaR95Pct:round(-(q05??0)*100,4),
      expectedShortfall95Pct:round(-mean(log.filter(value=>value<=(q05??-Infinity)))*100,4),
      currentDrawdownPct:round((currentDd??0)*100,4),
      maxDrawdownPct:round((maxDd??0)*100,4),
      downsideRiskPerBarPct:round(Math.sqrt(mean(downside.map(value=>value*value))||0)*100,5),
      tailRatio:round(tailRatio,4),
      beta:dep.beta??null,
      correlation:dep.correlation??null,
      upsideCapture:dep.upsideCapture??null,
      downsideCapture:dep.downsideCapture??null
    },
    trend:{
      sma:{sma10:round(sma10,6),sma20:round(sma20,6),sma50:round(sma50,6),state:smaState},
      ema:{ema12:round(ema12,6),ema26:round(ema26,6),ema50:round(ema50,6),state:emaState},
      olsSlopePctPerBar:round(Number.isFinite(logSlope)?(Math.exp(logSlope)-1)*100:null,6),
      robustSlopePctPerBar:round(Number.isFinite(robustLogSlope)?(Math.exp(robustLogSlope)-1)*100:null,6),
      efficiencyRatio:round(efficiency,4),
      adx14:round(dm.adx,3),plusDI14:round(dm.plusDI,3),minusDI14:round(dm.minusDI,3),
      persistence:round(persistence,4),trendAgeBars:trendAge,
      accelerationPctPerBar:round(Number.isFinite(acceleration)?acceleration*100:null,6)
    },
    momentum:{
      roc14Pct:round((roc14??0)*100,4),rsi14:round(rsi14,3),
      macd:{linePct:round(macdLine/currentClose*100,5),signalPct:round(macdSignal/currentClose*100,5),histogramPct:round(macdHist/currentClose*100,5)},
      normalizedMomentum:round(normalizedMomentum,4),momentumZScore:round(momentumZ,4),accelerationPct:round((momentumAcceleration??0)*100,4),stochasticK14:round(stochastic,3)
    },
    meanReversion:{
      bollingerZ:round(bollingerZ,4),rollingDeviationPct:round((rollingDeviation??0)*100,4),rangePosition:round(rangePosition,4),
      vwap:round(vwap,6),vwapDeviationPct:round((vwapDeviation??0)*100,4),halfLife:half
    },
    technical,
    dependence:dep,
    forecasting:{
      empiricalDistribution:{sampleSize:log.length,q05Pct:round((q05??0)*100,5),q50Pct:round((q50??0)*100,5),q95Pct:round((q95??0)*100,5)},
      blockBootstrap:{state:'IMPLEMENTED_IN_DECISION_SCENARIO_ENGINE',boundary:'The proven-graph scenario engine uses deterministic block bootstrap. This library does not duplicate it into an independent probability vote.'},
      monteCarlo:{state:'NOT_USED',reason:'No parametric Monte Carlo is added merely for breadth; explicit assumptions and separate validation would be required.'},
      stateSpace:{state:'NOT_USED',reason:'Kalman/state-space filtering remains excluded until separately justified and unit-tested.'}
    }
  });
}

export const QUANT_RESEARCH_FORMULAS=FORMULAS;
export const __decisionQuantResearchTest=Object.freeze({
  arithmeticReturns,logReturns,sma,emaSeries,ols,theilSenSlope,directionalMovement,rsi,trueRanges,rollingVolatility,drawdowns,rollingRocSeries,
  windowMidpoint,donchianChannel,ichimokuContext,onBalanceVolume,moneyFlowIndex,chaikinMoneyFlow,classicPivots,technicalAudit,halfLife,dependence
});
