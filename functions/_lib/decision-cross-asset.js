const finite=(value)=>value==null||value===''?null:Number.isFinite(Number(value))?Number(value):null;
const round=(value,digits=6)=>Number.isFinite(value)?Number(value.toFixed(digits)):null;
const mean=(values)=>values.length?values.reduce((sum,value)=>sum+value,0)/values.length:null;
const std=(values)=>{if(values.length<2)return null;const m=mean(values);const variance=values.reduce((sum,value)=>sum+(value-m)**2,0)/values.length;return Math.sqrt(variance);};

const normalize=(raw)=>(Array.isArray(raw)?raw:[])
  .map(item=>({time:finite(item?.t??item?.time),close:finite(item?.c??item?.close)}))
  .filter(item=>item.time>0&&item.close>0)
  .sort((a,b)=>a.time-b.time);

const returns=(rows)=>{
  const output=[];
  for(let i=1;i<rows.length;i++){
    const a=rows[i-1],b=rows[i];
    if(a.close>0&&b.close>0)output.push({time:b.time,value:Math.log(b.close/a.close)});
  }
  return output;
};

const alignedReturnSeries=(assetReturns,benchmarkReturns)=>{
  const benchByTime=new Map(benchmarkReturns.map(item=>[item.time,item.value]));
  return assetReturns.map(item=>({time:item.time,asset:item.value,benchmark:benchByTime.get(item.time)})).filter(item=>Number.isFinite(item.benchmark));
};

const dependenceFromSeries=(series)=>{
  if(series.length<30)return null;
  const a=series.map(item=>item.asset),b=series.map(item=>item.benchmark);
  const ma=mean(a),mb=mean(b);
  let covariance=0,varA=0,varB=0;
  for(let i=0;i<series.length;i++){
    const da=a[i]-ma,db=b[i]-mb;
    covariance+=da*db;varA+=da*da;varB+=db*db;
  }
  covariance/=series.length;varA/=series.length;varB/=series.length;
  const correlation=varA>0&&varB>0?covariance/Math.sqrt(varA*varB):null;
  const beta=varB>0?covariance/varB:null;
  return {sampleSize:series.length,correlation,beta};
};

const dependence=(assetReturns,benchmarkReturns)=>dependenceFromSeries(alignedReturnSeries(assetReturns,benchmarkReturns));

const rollingDependence=(series,window)=>{
  if(series.length<window)return null;
  return dependenceFromSeries(series.slice(-window));
};

const alignedPrices=(assetRows,benchmarkRows)=>{
  const benchmarkByTime=new Map(benchmarkRows.map(item=>[item.time,item.close]));
  return assetRows.map(item=>({time:item.time,asset:item.close,benchmark:benchmarkByTime.get(item.time)})).filter(item=>item.asset>0&&item.benchmark>0);
};

const spreadContext=(assetRows,benchmarkRows,beta)=>{
  if(!Number.isFinite(beta))return {state:'UNAVAILABLE',zScore:null,sampleSize:0};
  const pairs=alignedPrices(assetRows,benchmarkRows).slice(-120);
  if(pairs.length<60)return {state:'UNAVAILABLE',zScore:null,sampleSize:pairs.length};
  const spreads=pairs.map(item=>Math.log(item.asset)-beta*Math.log(item.benchmark));
  const m=mean(spreads),s=std(spreads),latest=spreads.at(-1);
  const z=s>0?(latest-m)/s:null;
  return {
    state:Number.isFinite(z)?(Math.abs(z)>=2?'EXTREME':Math.abs(z)>=1?'ELEVATED':'NORMAL'):'UNAVAILABLE',
    zScore:round(z,4),
    sampleSize:pairs.length,
    method:'Beta-adjusted log-price spread z-score over aligned same-venue observations. Descriptive only; no cointegration claim.'
  };
};

const correlation=(a,b)=>{
  if(a.length!==b.length||a.length<30)return null;
  const ma=mean(a),mb=mean(b);
  let cov=0,va=0,vb=0;
  for(let i=0;i<a.length;i++){const da=a[i]-ma,db=b[i]-mb;cov+=da*db;va+=da*da;vb+=db*db;}
  return va>0&&vb>0?cov/Math.sqrt(va*vb):null;
};

const leadLagContext=(series,maxLag=3)=>{
  if(series.length<40)return {state:'UNAVAILABLE',bestLagBars:null,relation:'UNAVAILABLE',correlation:null,sampleSize:0};
  let best=null;
  for(let lag=-maxLag;lag<=maxLag;lag++){
    const a=[],b=[];
    for(let i=0;i<series.length;i++){
      const benchmarkIndex=i-lag;
      if(benchmarkIndex<0||benchmarkIndex>=series.length)continue;
      a.push(series[i].asset);b.push(series[benchmarkIndex].benchmark);
    }
    const value=correlation(a,b);
    if(!Number.isFinite(value))continue;
    const candidate={lag,correlation:value,sampleSize:a.length};
    if(!best||Math.abs(value)>Math.abs(best.correlation))best=candidate;
  }
  if(!best)return {state:'UNAVAILABLE',bestLagBars:null,relation:'UNAVAILABLE',correlation:null,sampleSize:0};
  const relation=best.lag>0?'BENCHMARK_LEADS':best.lag<0?'ASSET_LEADS':'CONTEMPORANEOUS';
  return {
    state:'EXPLORATORY',
    bestLagBars:best.lag,
    relation,
    correlation:round(best.correlation,4),
    sampleSize:best.sampleSize,
    method:'Exploratory ±3-bar return-correlation scan. It is not a causal or predictive lead/lag claim.'
  };
};

export function buildDecisionCrossAsset(assetRaw,benchmarkRaw,{asset='BTC',benchmark='ETH'}={}){
  const assetRows=normalize(assetRaw).slice(-240);
  const benchmarkRows=normalize(benchmarkRaw).slice(-240);
  const series=alignedReturnSeries(returns(assetRows),returns(benchmarkRows));
  const dep=dependenceFromSeries(series);
  if(!dep||assetRows.length<31||benchmarkRows.length<31)return {
    state:'unavailable',
    asset,
    benchmark,
    provider:'Hyperliquid candles',
    sampleSize:dep?.sampleSize??0,
    correlation:null,
    beta:null,
    rollingCorrelation30:null,
    rollingCorrelation90:null,
    assetReturnPct:null,
    benchmarkReturnPct:null,
    relativeStrengthPct:null,
    divergenceState:'UNAVAILABLE',
    spread:{state:'UNAVAILABLE',zScore:null,sampleSize:0},
    leadLag:{state:'UNAVAILABLE',bestLagBars:null,relation:'UNAVAILABLE',correlation:null,sampleSize:0},
    cointegration:{state:'NOT_TESTED',reason:'Cointegration is not claimed without a dedicated statistical validation workflow.'},
    reason:'Not enough aligned same-interval observations for cross-asset dependence.'
  };
  const assetReturnPct=(assetRows.at(-1).close/assetRows[0].close-1)*100;
  const benchmarkReturnPct=(benchmarkRows.at(-1).close/benchmarkRows[0].close-1)*100;
  const relativeStrengthPct=assetReturnPct-benchmarkReturnPct;
  const d30=rollingDependence(series,30),d90=rollingDependence(series,90);
  const correlationState=dep.correlation>=.7?'STRONG_POSITIVE':dep.correlation>=.3?'POSITIVE':dep.correlation<=-.7?'STRONG_NEGATIVE':dep.correlation<=-.3?'NEGATIVE':'WEAK';
  const relativeState=relativeStrengthPct>=1?'OUTPERFORMING':relativeStrengthPct<=-1?'UNDERPERFORMING':'ALIGNED';
  const oppositeSigns=Math.sign(assetReturnPct)!==0&&Math.sign(benchmarkReturnPct)!==0&&Math.sign(assetReturnPct)!==Math.sign(benchmarkReturnPct);
  const divergenceState=oppositeSigns&&Math.abs(relativeStrengthPct)>=1?'DIVERGING':Math.abs(relativeStrengthPct)>=2?'WIDE_RELATIVE_GAP':'ALIGNED';
  const spread=spreadContext(assetRows,benchmarkRows,dep.beta);
  const leadLag=leadLagContext(series);
  return {
    state:'available',
    asset,
    benchmark,
    provider:'Hyperliquid candles',
    sampleSize:dep.sampleSize,
    assetPoints:assetRows.length,
    benchmarkPoints:benchmarkRows.length,
    correlation:round(dep.correlation,4),
    correlationState,
    beta:round(dep.beta,4),
    rollingCorrelation30:round(d30?.correlation,4),
    rollingCorrelation90:round(d90?.correlation,4),
    rollingBeta30:round(d30?.beta,4),
    rollingBeta90:round(d90?.beta,4),
    assetReturnPct:round(assetReturnPct,3),
    benchmarkReturnPct:round(benchmarkReturnPct,3),
    relativeStrengthPct:round(relativeStrengthPct,3),
    relativeState,
    divergenceState,
    spread,
    leadLag,
    cointegration:{state:'NOT_TESTED',reason:'Cointegration is not claimed without a dedicated statistical validation workflow.'},
    observedAt:new Date(Math.min(assetRows.at(-1).time,benchmarkRows.at(-1).time)).toISOString(),
    method:'Same-venue, same-interval log-return dependence over aligned Hyperliquid candles, with bounded rolling windows, relative-strength divergence, beta-adjusted spread context and exploratory lag scan.',
    eligibilityImpact:'none',
    limitations:[
      'Cross-asset dependence is descriptive context and does not independently create BUY, SELL or NO TRADE eligibility.',
      'Correlation, beta, spread z-score and exploratory lag relationships are window-dependent and are not causal claims.',
      'Only the already-fetched crypto benchmark is evaluated; DXY, rates, equities, gold and other macro assets are not substituted.'
    ]
  };
}

export const __decisionCrossAssetTest=Object.freeze({normalize,returns,alignedReturnSeries,dependence,dependenceFromSeries,rollingDependence,spreadContext,leadLagContext,correlation});
