const INTERVAL_MS=Object.freeze({'1m':60_000,'3m':180_000,'5m':300_000,'15m':900_000,'30m':1_800_000,'1h':3_600_000,'2h':7_200_000,'4h':14_400_000,'8h':28_800_000,'12h':43_200_000,'1d':86_400_000});
const finite=(value)=>Number.isFinite(Number(value))?Number(value):null;
const clamp=(value,min,max)=>Math.min(max,Math.max(min,value));
const mean=(values)=>values.length?values.reduce((sum,value)=>sum+value,0)/values.length:0;
const quantile=(values,p)=>{if(!values.length)return null;const sorted=[...values].sort((a,b)=>a-b);const index=(sorted.length-1)*p;const low=Math.floor(index);const weight=index-low;return sorted[low]+((sorted[low+1]??sorted[low])-sorted[low])*weight;};
const round=(value,digits=4)=>Number.isFinite(value)?Number(value.toFixed(digits)):null;
const hash=(text)=>{let value=2166136261;for(const character of text){value^=character.charCodeAt(0);value=Math.imul(value,16777619);}return(value>>>0).toString(16).padStart(8,'0');};
const rng=(seed)=>()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};

export function normalizeCandles(input){
  const byTime=new Map();
  for(const raw of Array.isArray(input)?input:[]){
    const time=finite(raw?.t??raw?.time),open=finite(raw?.o??raw?.open),high=finite(raw?.h??raw?.high),low=finite(raw?.l??raw?.low),close=finite(raw?.c??raw?.close),volume=finite(raw?.v??raw?.volume);
    if(![time,open,high,low,close,volume].every(Number.isFinite)||time<=0||open<=0||close<=0||low<=0||high<Math.max(open,close)||low>Math.min(open,close)||volume<0)continue;
    byTime.set(time,{time,open,high,low,close,volume,trades:Math.max(0,Math.floor(finite(raw?.n??raw?.trades)??0))});
  }
  return [...byTime.values()].sort((a,b)=>a.time-b.time);
}

function metricSet(candles,intervalMs){
  const closes=candles.map(item=>item.close);const returns=[];
  for(let index=1;index<closes.length;index++)returns.push(Math.log(closes[index]/closes[index-1]));
  const average=mean(returns);const variance=mean(returns.map(value=>(value-average)**2));const sigma=Math.sqrt(variance);
  let ewma=variance;for(const value of returns)ewma=.94*ewma+.06*value**2;
  const trs=candles.slice(1).map((item,index)=>Math.max(item.high-item.low,Math.abs(item.high-closes[index]),Math.abs(item.low-closes[index])));
  const parkinson=Math.sqrt(mean(candles.map(item=>Math.log(item.high/item.low)**2))/(4*Math.log(2)));
  const xMean=(closes.length-1)/2;const yMean=mean(closes);let numerator=0,denominator=0;
  closes.forEach((value,index)=>{numerator+=(index-xMean)*(value-yMean);denominator+=(index-xMean)**2;});
  const slope=denominator?numerator/denominator:0;
  let peak=closes[0],maxDrawdown=0;for(const value of closes){peak=Math.max(peak,value);maxDrawdown=Math.min(maxDrawdown,value/peak-1);}
  const losses=returns.filter(value=>value<=quantile(returns,.05));const centered=returns.map(value=>value-average);
  const up=mean(returns.slice(-14).map(value=>Math.max(0,value)));const down=mean(returns.slice(-14).map(value=>Math.max(0,-value)));
  const annualizer=Math.sqrt(365*86_400_000/intervalMs);
  return {returns,average,sigma,metrics:{realizedVolatilityPct:round(sigma*annualizer*100,2),ewmaVolatilityPct:round(Math.sqrt(ewma)*annualizer*100,2),parkinsonVolatilityPct:round(parkinson*annualizer*100,2),atrPct:round(mean(trs.slice(-14))/closes.at(-1)*100,2),trendPerBarPct:round(slope/closes.at(-1)*100,4),rsi14:round(down===0?100:100-(100/(1+up/down)),1),returnZScore:round(sigma?(returns.at(-1)-average)/sigma:0,2),skewness:round(sigma?mean(centered.map(value=>value**3))/sigma**3:0,2),excessKurtosis:round(sigma?mean(centered.map(value=>value**4))/sigma**4-3:0,2),historicalVaR95Pct:round(-(quantile(returns,.05)??0)*100,2),expectedShortfall95Pct:round(-mean(losses)*100,2),maxDrawdownPct:round(maxDrawdown*100,2),averageVolume:round(mean(candles.slice(-30).map(item=>item.volume)),2)}};
}

function scenarios(candles,returns,horizonBars,seed){
  const random=rng(seed);const sample=returns.slice(-Math.min(240,returns.length));const paths=800;const series=Array.from({length:horizonBars},()=>[]);const terminal=[];const block=Math.max(2,Math.round(Math.sqrt(horizonBars)));const last=candles.at(-1).close;
  for(let path=0;path<paths;path++){
    let price=last;
    for(let step=0;step<horizonBars;step++){
      const blockStart=Math.floor(random()*Math.max(1,sample.length-block));const shock=sample[(blockStart+(step%block))%sample.length]??0;price*=Math.exp(shock);series[step].push(price);
    }
    terminal.push(price);
  }
  const fan=series.map((values,index)=>({step:index+1,p05:round(quantile(values,.05),2),p25:round(quantile(values,.25),2),p50:round(quantile(values,.5),2),p75:round(quantile(values,.75),2),p95:round(quantile(values,.95),2)}));
  const neutral=Math.max(.002,Math.sqrt(horizonBars)*(.25*(quantile(sample,.75)-quantile(sample,.25))));
  const bull=terminal.filter(value=>value/last-1>neutral).length/paths;const bear=terminal.filter(value=>value/last-1< -neutral).length/paths;
  return {paths,fan,probabilities:{bull:round(bull,4),base:round(1-bull-bear,4),bear:round(bear,4)},terminal:{p05:fan.at(-1).p05,p50:fan.at(-1).p50,p95:fan.at(-1).p95}};
}

export function buildDecisionProvenGraph(raw,{asset='BTC',interval='15m',horizonBars=16,now=Date.now()}={}){
  const intervalMs=INTERVAL_MS[interval];if(!intervalMs)throw new Error('Unsupported interval');
  const candles=normalizeCandles(raw).filter(item=>item.time<=now+intervalMs);
  if(candles.length<80)throw new Error('At least 80 valid candles are required');
  const {returns,metrics}=metricSet(candles,intervalMs);const fingerprint=hash(JSON.stringify(candles));const forecast=scenarios(candles,returns,horizonBars,parseInt(fingerprint,16));const observedAt=candles.at(-1).time;const ageMs=Math.max(0,now-observedAt);
  const truthState=ageMs<=intervalMs*2?'LIVE':ageMs<=intervalMs*6?'DELAYED':ageMs<=intervalMs*24?'STALE':'DEGRADED';
  const confidence=round(clamp(.35+Math.min(.35,candles.length/1000)+Math.max(0,.2-ageMs/(intervalMs*100)),.2,.9),2);
  const last=candles.at(-1).close;const graphId=`dpg-${asset.toLowerCase()}-${interval}-${observedAt}-${fingerprint}`;
  const nodes=[{id:'history',kind:'observation',label:`${candles.length} authorized candles`,state:truthState},{id:'present',kind:'market-state',label:`${asset} ${last}`,state:truthState},{id:'model',kind:'transformation',label:'Deterministic block bootstrap v1.0.0',state:'DERIVED'},{id:'future',kind:'scenario',label:`${horizonBars}-bar probability fan`,state:'MODELLED'},{id:'decision',kind:'human-gate',label:'Human decision required',state:'NOT_EXECUTED'}];
  const edges=[['history','present','establishes'],['history','model','samples'],['present','future','anchors'],['model','future','derives'],['future','decision','informs']].map(([from,to,type])=>({from,to,type}));
  return {schemaVersion:'qelly.decision-proven-graph/1.0.0',graphId,generatedAt:new Date(now).toISOString(),truthState,execution:false,asset,interval,horizonBars,observedAt:new Date(observedAt).toISOString(),freshness:{ageMs,intervalMs,state:truthState},market:{lastPrice:last,firstTime:new Date(candles[0].time).toISOString(),points:candles.length,candles:candles.slice(-240)},metrics,forecast,confidence:{score:confidence,calibration:'Out-of-sample calibration is not yet measured; confidence reflects sample size and freshness only.'},invalidation:{lower:forecast.terminal.p05,upper:forecast.terminal.p95,condition:`Recalculate when price exits the model p05–p95 interval (${forecast.terminal.p05}–${forecast.terminal.p95}) or source freshness degrades.`},provenance:{provider:'Hyperliquid',sourceType:'authorized-public-read',endpoint:'https://api.hyperliquid.xyz/info',documentation:'https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/info-endpoint',request:{type:'candleSnapshot',coin:asset,interval},dataFingerprint:fingerprint,model:{id:'qelly-deterministic-block-bootstrap',version:'1.0.0',paths:forecast.paths,features:['log returns','EWMA volatility','ATR','Parkinson volatility','trend OLS','RSI','historical VaR/ES','drawdown'],limitations:['Scenarios are statistical, not predictions or investment advice.','One public venue is observed; cross-provider agreement is unavailable.','No transaction costs, liquidity depth, news or macro regime inputs are modelled.']}},graph:{nodes,edges,textAlternative:edges.map(edge=>`${nodes.find(node=>node.id===edge.from).label} ${edge.type} ${nodes.find(node=>node.id===edge.to).label}.`)}};
}

export const DECISION_INTERVALS=INTERVAL_MS;

