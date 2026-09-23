const finite=(value)=>Number.isFinite(Number(value))?Number(value):null;
const round=(value,digits=6)=>Number.isFinite(value)?Number(value.toFixed(digits)):null;
const mean=(values)=>values.length?values.reduce((sum,value)=>sum+value,0)/values.length:null;

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

const dependence=(assetReturns,benchmarkReturns)=>{
  const benchByTime=new Map(benchmarkReturns.map(item=>[item.time,item.value]));
  const pairs=assetReturns.map(item=>[item.value,benchByTime.get(item.time)]).filter(([,b])=>Number.isFinite(b));
  if(pairs.length<30)return null;
  const a=pairs.map(([value])=>value),b=pairs.map(([,value])=>value);
  const ma=mean(a),mb=mean(b);
  let covariance=0,varA=0,varB=0;
  for(let i=0;i<pairs.length;i++){
    const da=a[i]-ma,db=b[i]-mb;
    covariance+=da*db;varA+=da*da;varB+=db*db;
  }
  covariance/=pairs.length;varA/=pairs.length;varB/=pairs.length;
  const correlation=varA>0&&varB>0?covariance/Math.sqrt(varA*varB):null;
  const beta=varB>0?covariance/varB:null;
  return {sampleSize:pairs.length,correlation,beta};
};

export function buildDecisionCrossAsset(assetRaw,benchmarkRaw,{asset='BTC',benchmark='ETH'}={}){
  const assetRows=normalize(assetRaw).slice(-240);
  const benchmarkRows=normalize(benchmarkRaw).slice(-240);
  const dep=dependence(returns(assetRows),returns(benchmarkRows));
  if(!dep||assetRows.length<31||benchmarkRows.length<31)return {
    state:'unavailable',
    asset,
    benchmark,
    sampleSize:dep?.sampleSize??0,
    correlation:null,
    beta:null,
    assetReturnPct:null,
    benchmarkReturnPct:null,
    relativeStrengthPct:null,
    reason:'Not enough aligned same-interval observations for cross-asset dependence.'
  };
  const assetReturnPct=(assetRows.at(-1).close/assetRows[0].close-1)*100;
  const benchmarkReturnPct=(benchmarkRows.at(-1).close/benchmarkRows[0].close-1)*100;
  const relativeStrengthPct=assetReturnPct-benchmarkReturnPct;
  const correlationState=dep.correlation>=.7?'STRONG_POSITIVE':dep.correlation>=.3?'POSITIVE':dep.correlation<=-.7?'STRONG_NEGATIVE':dep.correlation<=-.3?'NEGATIVE':'WEAK';
  const relativeState=relativeStrengthPct>=1?'OUTPERFORMING':relativeStrengthPct<=-1?'UNDERPERFORMING':'ALIGNED';
  return {
    state:'available',
    asset,
    benchmark,
    sampleSize:dep.sampleSize,
    assetPoints:assetRows.length,
    benchmarkPoints:benchmarkRows.length,
    correlation:round(dep.correlation,4),
    correlationState,
    beta:round(dep.beta,4),
    assetReturnPct:round(assetReturnPct,3),
    benchmarkReturnPct:round(benchmarkReturnPct,3),
    relativeStrengthPct:round(relativeStrengthPct,3),
    relativeState,
    observedAt:new Date(Math.min(assetRows.at(-1).time,benchmarkRows.at(-1).time)).toISOString(),
    method:'Same-venue, same-interval log-return correlation and beta over aligned Hyperliquid candles.',
    eligibilityImpact:'none',
    limitations:['Cross-asset dependence is descriptive context and does not independently create BUY or SELL eligibility.','Correlation and beta are window-dependent and may change rapidly.']
  };
}

export const __decisionCrossAssetTest=Object.freeze({normalize,returns,dependence});
