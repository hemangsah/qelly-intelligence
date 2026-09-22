import {computeAdvancedDecisionMetrics,buildHistoricalDecisionAnalogs} from './decision-advanced-quant.js';

const INTERVAL_MS=Object.freeze({'1m':60_000,'3m':180_000,'5m':300_000,'15m':900_000,'30m':1_800_000,'1h':3_600_000,'2h':7_200_000,'4h':14_400_000,'8h':28_800_000,'12h':43_200_000,'1d':86_400_000});
const finite=(value)=>Number.isFinite(Number(value))?Number(value):null;
const clamp=(value,min,max)=>Math.min(max,Math.max(min,value));
const mean=(values)=>values.length?values.reduce((sum,value)=>sum+value,0)/values.length:0;
const quantile=(values,p)=>{if(!values.length)return null;const sorted=[...values].sort((a,b)=>a-b);const index=(sorted.length-1)*p;const low=Math.floor(index);const weight=index-low;return sorted[low]+((sorted[low+1]??sorted[low])-sorted[low])*weight;};
const round=(value,digits=4)=>Number.isFinite(value)?Number(value.toFixed(digits)):null;
const hash=(value)=>{let result=2166136261;for(const character of value){result^=character.charCodeAt(0);result=Math.imul(result,16777619);}return(result>>>0).toString(16).padStart(8,'0');};
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
  const losses=returns.filter(value=>value<=(quantile(returns,.05)??0));const centered=returns.map(value=>value-average);
  const recent=returns.slice(-14);const up=mean(recent.map(value=>Math.max(0,value)));const down=mean(recent.map(value=>Math.max(0,-value)));
  const annualizer=Math.sqrt(365*86_400_000/intervalMs);
  return {returns,average,sigma,metrics:{realizedVolatilityPct:round(sigma*annualizer*100,2),ewmaVolatilityPct:round(Math.sqrt(ewma)*annualizer*100,2),parkinsonVolatilityPct:round(parkinson*annualizer*100,2),atrPct:round(mean(trs.slice(-14))/closes.at(-1)*100,2),trendPerBarPct:round(slope/closes.at(-1)*100,4),rsi14:round(down===0?100:100-(100/(1+up/down)),1),returnZScore:round(sigma?(returns.at(-1)-average)/sigma:0,2),skewness:round(sigma?mean(centered.map(value=>value**3))/sigma**3:0,2),excessKurtosis:round(sigma?mean(centered.map(value=>value**4))/sigma**4-3:0,2),historicalVaR95Pct:round(-(quantile(returns,.05)??0)*100,2),expectedShortfall95Pct:round(-mean(losses)*100,2),maxDrawdownPct:round(maxDrawdown*100,2),averageVolume:round(mean(candles.slice(-30).map(item=>item.volume)),2)}};
}

function scenarios(candles,returns,horizonBars,seed){
  const random=rng(seed);const sample=returns.slice(-Math.min(240,returns.length));const paths=800;const series=Array.from({length:horizonBars},()=>[]);const terminal=[];const block=Math.max(2,Math.round(Math.sqrt(horizonBars)));const last=candles.at(-1).close;
  for(let path=0;path<paths;path++){let price=last;for(let step=0;step<horizonBars;step++){const blockStart=Math.floor(random()*Math.max(1,sample.length-block));const shock=sample[(blockStart+(step%block))%sample.length]??0;price*=Math.exp(shock);series[step].push(price);}terminal.push(price);}
  const fan=series.map((values,index)=>({step:index+1,p05:round(quantile(values,.05),2),p25:round(quantile(values,.25),2),p50:round(quantile(values,.5),2),p75:round(quantile(values,.75),2),p95:round(quantile(values,.95),2)}));
  const neutral=Math.max(.002,Math.sqrt(horizonBars)*(.25*((quantile(sample,.75)??0)-(quantile(sample,.25)??0))));
  const bull=round(terminal.filter(value=>value/last-1>neutral).length/paths,4);
  let bear=round(terminal.filter(value=>value/last-1< -neutral).length/paths,4);
  let base=round(1-bull-bear,4);
  if(base<0){base=0;bear=round(1-bull,4);}
  return {paths,fan,probabilities:{bull,base,bear},terminal:{p05:fan.at(-1).p05,p50:fan.at(-1).p50,p95:fan.at(-1).p95}};
}

function marketState(metrics){
  const trend=metrics.trendPerBarPct>.015?'uptrend':metrics.trendPerBarPct<-.015?'downtrend':'range';
  const momentum=metrics.rsi14>=70?'overbought':metrics.rsi14<=30?'oversold':metrics.rsi14>=55?'positive momentum':metrics.rsi14<=45?'negative momentum':'neutral momentum';
  return {trend,momentum,label:trend+' · '+momentum};
}

function makeQellyView(metrics,forecast,last,truthState,confidence){
  const freshnessOk=truthState==='LIVE'||truthState==='DELAYED';const bull=forecast.probabilities.bull;const bear=forecast.probabilities.bear;
  const bullish=metrics.trendPerBarPct>0&&metrics.rsi14>=50&&metrics.rsi14<72&&bull>bear+.08;
  const bearish=metrics.trendPerBarPct<0&&metrics.rsi14<=50&&metrics.rsi14>28&&bear>bull+.08;
  let action='WAIT';if(!freshnessOk||confidence<.55)action='NO TRADE';else if(bullish)action='BUY';else if(bearish)action='SELL';
  const supported=(action==='BUY'||action==='SELL')&&confidence>=.62&&Number.isFinite(metrics.atrPct)&&metrics.atrPct>0;
  const direction=action==='BUY'?1:-1;const atr=last*metrics.atrPct/100;let levels=null;
  if(supported){const entry=[last-.2*atr,last+.2*atr].sort((a,b)=>a-b);const invalidation=last-direction*1.25*atr;const targets=[last+direction*atr,last+direction*2*atr,last+direction*3*atr];levels={entryZone:entry.map(value=>round(value,2)),invalidation:round(invalidation,2),targets:targets.map(value=>round(value,2)),riskReward:[round(1/1.25,2),round(2/1.25,2),round(3/1.25,2)]};}
  const leading=action==='BUY'?bull:action==='SELL'?bear:Math.max(bull,bear);
  const why=[metrics.trendPerBarPct>=0?'Trend slope is non-negative.':'Trend slope is negative.',metrics.rsi14>=50?'RSI shows stronger buying momentum.':'RSI shows weaker buying momentum.','Scenario balance is '+Math.round(bull*100)+'% bull / '+Math.round(forecast.probabilities.base*100)+'% base / '+Math.round(bear*100)+'% bear.'];
  return {action,confidence:round(Math.min(confidence,.45+leading*.55),2),levels,why,changesIf:action==='BUY'?'Momentum falls below neutral, price breaches invalidation, or fresh evidence weakens the bull case.':action==='SELL'?'Momentum recovers above neutral, price breaches invalidation, or fresh evidence weakens the bear case.':'A clearer directional edge appears with fresh evidence and aligned trend, momentum and scenario probabilities.',label:action==='NO TRADE'?'Evidence quality is too weak for a directional research signal.':action==='WAIT'?'No directional edge clears the evidence threshold.':'Research signal only — not a recommendation or guaranteed outcome.'};
}

function analyzeSelection(candles,selection,intervalMs){
  const start=finite(selection?.start),end=finite(selection?.end);if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start)return null;
  const selected=candles.filter(item=>item.time>=start&&item.time<=end);if(selected.length<1)return null;
  const previous=candles.filter(item=>item.time<start).slice(-selected.length);const first=selected[0],last=selected.at(-1);const changePct=(last.close/first.open-1)*100;
  const selectedReturns=selected.slice(1).map((item,index)=>Math.log(item.close/selected[index].close));const previousReturns=previous.slice(1).map((item,index)=>Math.log(item.close/previous[index].close));
  const volatility=(items)=>items.length?Math.sqrt(mean(items.map(value=>(value-mean(items))**2)))*100:null;
  const singleCandleRange=(item)=>item?Math.log(item.high/item.low)*100:null;
  const selectedVolatility=selectedReturns.length?volatility(selectedReturns):singleCandleRange(first);
  const previousVolatility=previousReturns.length?volatility(previousReturns):previous.length===1?singleCandleRange(previous[0]):null;
  const selectedVolume=mean(selected.map(item=>item.volume));const previousVolume=mean(previous.map(item=>item.volume));const volumeRatio=previousVolume?selectedVolume/previousVolume:null;
  const selectedMetrics=selected.length>=15?metricSet(selected,intervalMs).metrics:null;const previousMetrics=previous.length>=15?metricSet(previous,intervalMs).metrics:null;
  const technicalComparison=selectedMetrics&&previousMetrics?{rsi14:{before:previousMetrics.rsi14,during:selectedMetrics.rsi14,change:round(selectedMetrics.rsi14-previousMetrics.rsi14,1)},trendPerBarPct:{before:previousMetrics.trendPerBarPct,during:selectedMetrics.trendPerBarPct,change:round(selectedMetrics.trendPerBarPct-previousMetrics.trendPerBarPct,4)},atrPct:{before:previousMetrics.atrPct,during:selectedMetrics.atrPct,change:round(selectedMetrics.atrPct-previousMetrics.atrPct,2)}}:null;
  const evidence=[
    {type:'price',title:(changePct>=0?'Price advanced ':'Price declined ')+Math.abs(round(changePct,2))+'%',detail:'From '+round(first.open,2)+' to '+round(last.close,2)+' across '+selected.length+' candles.',direction:changePct>=0?'supports upside':'supports downside',strength:clamp(Math.abs(changePct)/5,0,1)},
    {type:'volume',title:Number.isFinite(volumeRatio)?'Volume ran '+round(volumeRatio,2)+'× the prior window':'Prior volume comparison unavailable',detail:'Average selected-window volume compared with an equal-length preceding window.',direction:Number.isFinite(volumeRatio)&&volumeRatio>=1.25?'confirms participation':'does not confirm broad participation',strength:Number.isFinite(volumeRatio)?clamp(Math.abs(volumeRatio-1),0,1):0},
    {type:'volatility',title:(selected.length===1?'Intrabar range proxy ':'Realized move volatility ')+round(selectedVolatility,2)+'%',detail:previousVolatility!==null?'Prior equal window: '+round(previousVolatility,2)+'%.':'Not enough preceding candles for a stable comparison.',direction:previousVolatility!==null&&selectedVolatility>previousVolatility*1.25?'regime expansion':'stable or contracting regime',strength:previousVolatility!==null?clamp(Math.abs(selectedVolatility-previousVolatility)*5,0,1):0},
    ...(technicalComparison?[{type:'technical',title:'RSI shifted '+technicalComparison.rsi14.before+' → '+technicalComparison.rsi14.during,detail:'Trend per bar changed from '+technicalComparison.trendPerBarPct.before+'% to '+technicalComparison.trendPerBarPct.during+'%; ATR changed from '+technicalComparison.atrPct.before+'% to '+technicalComparison.atrPct.during+'%.',direction:technicalComparison.rsi14.change>=5?'momentum strengthened':technicalComparison.rsi14.change<=-5?'momentum weakened':'momentum broadly stable',strength:clamp(Math.abs(technicalComparison.rsi14.change)/25+Math.abs(technicalComparison.trendPerBarPct.change)*4,0,1)}]:[])
  ].sort((a,b)=>b.strength-a.strength).map((item,index)=>({...item,rank:index+1,strength:round(item.strength,2)}));
  return {start:new Date(first.time).toISOString(),end:new Date(last.time+intervalMs-1).toISOString(),candles:selected.length,changePct:round(changePct,2),rangePct:round((Math.max(...selected.map(item=>item.high))/Math.min(...selected.map(item=>item.low))-1)*100,2),volumeRatio:round(volumeRatio,2),volatilityPct:round(selectedVolatility,2),priorVolatilityPct:previousVolatility===null?null:round(previousVolatility,2),technicalComparison,evidence};
}

export function buildDecisionProvenGraph(raw,{asset='BTC',interval='15m',horizonBars=16,now=Date.now(),selection=null}={}){
  const intervalMs=INTERVAL_MS[interval];if(!intervalMs)throw new Error('Unsupported interval');
  const candles=normalizeCandles(raw).filter(item=>item.time<=now+intervalMs);if(candles.length<80)throw new Error('At least 80 valid candles are required');
  const {returns,metrics}=metricSet(candles,intervalMs);const fingerprint=hash(JSON.stringify(candles));const forecast=scenarios(candles,returns,horizonBars,parseInt(fingerprint,16));const observedAt=candles.at(-1).time;const ageMs=Math.max(0,now-observedAt);
  const truthState=ageMs<=intervalMs*2?'LIVE':ageMs<=intervalMs*6?'DELAYED':ageMs<=intervalMs*24?'STALE':'DEGRADED';const confidence=round(clamp(.35+Math.min(.35,candles.length/1000)+Math.max(0,.2-ageMs/(intervalMs*100)),.2,.9),2);
  const advancedMetrics=computeAdvancedDecisionMetrics(candles,{intervalMs});const historicalAnalogs=buildHistoricalDecisionAnalogs(candles,{lookbackBars:20,horizonBars,maxAnalogs:12});
  const last=candles.at(-1).close;const state=marketState(metrics);const qellyView=makeQellyView(metrics,forecast,last,truthState,confidence);const selectedMove=analyzeSelection(candles,selection,intervalMs);const graphId='dpg-'+asset.toLowerCase()+'-'+interval+'-'+observedAt+'-'+fingerprint;
  const nodes=[{id:'history',kind:'observation',label:candles.length+' validated candles',state:truthState},{id:'present',kind:'market-state',label:asset+' '+last,state:truthState},{id:'model',kind:'transformation',label:'Deterministic block bootstrap v1.1.0',state:'DERIVED'},{id:'future',kind:'scenario',label:horizonBars+'-bar probability fan',state:'MODELLED'},{id:'decision',kind:'research-view',label:'QELLY VIEW '+qellyView.action,state:'RESEARCH_ONLY'}];
  const edges=[['history','present','establishes'],['history','model','samples'],['present','future','anchors'],['model','future','derives'],['future','decision','informs']].map(([from,to,type])=>({from,to,type}));
  return {schemaVersion:'qelly.decision-proven-graph/1.1.0',graphId,generatedAt:new Date(now).toISOString(),truthState,execution:false,asset,interval,horizonBars,observedAt:new Date(observedAt).toISOString(),freshness:{ageMs,intervalMs,state:truthState},market:{lastPrice:last,firstTime:new Date(candles[0].time).toISOString(),points:candles.length,currentState:state,candles:candles.slice(-240)},metrics,advancedMetrics,historicalAnalogs,forecast,qellyView,selection:selectedMove,confidence:{score:confidence,calibration:'Confidence reflects evidence freshness, sample depth and scenario agreement; it is not a success probability.'},invalidation:{lower:forecast.terminal.p05,upper:forecast.terminal.p95,condition:'Recalculate when price exits the model p05–p95 interval ('+forecast.terminal.p05+'–'+forecast.terminal.p95+') or evidence freshness degrades.'},provenance:{provider:'Hyperliquid',sourceType:'public market data',documentation:'https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/info-endpoint',request:{type:'candleSnapshot',coin:asset,interval},dataFingerprint:fingerprint,model:{id:'qelly-deterministic-block-bootstrap',version:'1.1.0',paths:forecast.paths,features:['log returns','EWMA volatility','ATR','Parkinson volatility','Garman-Klass volatility','Rogers-Satchell volatility','trend OLS','trend efficiency','RSI','historical VaR/ES','drawdown','historical analog distance'],limitations:['Scenarios are statistical research, not predictions or investment advice.','One public venue is observed; cross-provider agreement is not yet available.','No transaction costs or user-specific suitability are modelled.','Historical analogs are descriptive nearest-neighbour comparisons and are not treated as calibrated probabilities.']}},graph:{nodes,edges,textAlternative:edges.map(edge=>nodes.find(node=>node.id===edge.from).label+' '+edge.type+' '+nodes.find(node=>node.id===edge.to).label+'.')}};
}

export const DECISION_INTERVALS=INTERVAL_MS;
