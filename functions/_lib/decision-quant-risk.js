const QUANT_SCHEMA_VERSION='qelly.decision-quant-risk/1.0.0';
const finite=(value)=>value==null||value===''?null:Number.isFinite(Number(value))?Number(value):null;
const clamp=(value,min=0,max=1)=>Math.min(max,Math.max(min,value));
const round=(value,digits=4)=>Number.isFinite(value)?Number(value.toFixed(digits)):null;
const mean=(values)=>values.length?values.reduce((sum,value)=>sum+value,0)/values.length:0;
const quantile=(values,p)=>{if(!values.length)return null;const sorted=[...values].sort((a,b)=>a-b);const index=(sorted.length-1)*p;const low=Math.floor(index),weight=index-low;return sorted[low]+((sorted[low+1]??sorted[low])-sorted[low])*weight;};
const percentileRank=(values,value)=>{const valid=values.filter(Number.isFinite);if(!valid.length||!Number.isFinite(value))return null;return valid.filter(item=>item<=value).length/valid.length;};
const annualizer=(intervalMs)=>Math.sqrt(365*86_400_000/intervalMs);
const logReturn=(a,b)=>a>0&&b>0?Math.log(b/a):0;

function rollingRealized(candles,window=20){
  if(candles.length<=window)return [];
  const returns=[];
  for(let i=1;i<candles.length;i++)returns.push(logReturn(candles[i-1].close,candles[i].close));
  const prefix=[0],prefixSquares=[0];
  for(const value of returns){
    prefix.push(prefix.at(-1)+value);
    prefixSquares.push(prefixSquares.at(-1)+value*value);
  }
  const output=[];
  for(let end=window;end<candles.length;end++){
    const start=end-window,finish=end,count=finish-start;
    const sum=prefix[finish]-prefix[start];
    const sumSquares=prefixSquares[finish]-prefixSquares[start];
    const avg=sum/count;
    const variance=Math.max(0,sumSquares/count-avg*avg);
    output.push(Math.sqrt(variance));
  }
  return output;
}

function adx(candles,period=14){
  if(candles.length<period*2+1)return null;
  const trs=[],plus=[],minus=[];
  for(let i=1;i<candles.length;i++){
    const current=candles[i],previous=candles[i-1];
    const up=current.high-previous.high,down=previous.low-current.low;
    trs.push(Math.max(current.high-current.low,Math.abs(current.high-previous.close),Math.abs(current.low-previous.close)));
    plus.push(up>down&&up>0?up:0);
    minus.push(down>up&&down>0?down:0);
  }
  const prefix=(values)=>{const out=[0];for(const value of values)out.push(out.at(-1)+value);return out;};
  const trPrefix=prefix(trs),plusPrefix=prefix(plus),minusPrefix=prefix(minus),dx=[];
  for(let i=period-1;i<trs.length;i++){
    const start=i-period+1,end=i+1;
    const tr=(trPrefix[end]-trPrefix[start])/period;
    if(!(tr>0))continue;
    const p=100*((plusPrefix[end]-plusPrefix[start])/period)/tr;
    const m=100*((minusPrefix[end]-minusPrefix[start])/period)/tr;
    const denom=p+m;
    if(denom>0)dx.push(100*Math.abs(p-m)/denom);
  }
  return dx.length?mean(dx.slice(-period)):null;
}

function swingPoints(candles,wing=2){
  const highs=[],lows=[];
  for(let i=wing;i<candles.length-wing;i++){
    const current=candles[i];
    const neighbors=[...candles.slice(i-wing,i),...candles.slice(i+1,i+wing+1)];
    if(neighbors.every(item=>current.high>item.high))highs.push({time:current.time,price:current.high,index:i});
    if(neighbors.every(item=>current.low<item.low))lows.push({time:current.time,price:current.low,index:i});
  }
  return {highs:highs.slice(-10),lows:lows.slice(-10)};
}

function structure(candles){
  const last=candles.at(-1),recent=candles.slice(-80);
  if(!last||recent.length<20)return {
    state:'UNAVAILABLE',bias:'MIXED',strengthState:'UNAVAILABLE',strengthScore:null,
    support:null,resistance:null,breakout:'NONE',breakOfStructure:'NONE',changeOfCharacter:'NONE',
    failedBreakout:'NONE',retestState:'NONE',continuationState:'NONE',rejectionState:'NONE',exhaustionState:'NONE',
    rangePct:null,rangePosition:null,phase:'UNAVAILABLE',compressionState:'UNAVAILABLE',
    distanceToSupportPct:null,distanceToResistancePct:null,supportTouches:0,resistanceTouches:0,
    swings:{highs:[],lows:[]}
  };
  const swings=swingPoints(recent,2);
  const latestHigh=swings.highs.at(-1),priorHigh=swings.highs.at(-2);
  const latestLow=swings.lows.at(-1),priorLow=swings.lows.at(-2);
  const higherHigh=latestHigh&&priorHigh?latestHigh.price>priorHigh.price:false;
  const lowerHigh=latestHigh&&priorHigh?latestHigh.price<priorHigh.price:false;
  const higherLow=latestLow&&priorLow?latestLow.price>priorLow.price:false;
  const lowerLow=latestLow&&priorLow?latestLow.price<priorLow.price:false;
  const state=higherHigh&&higherLow?'HH_HL':lowerHigh&&lowerLow?'LH_LL':higherHigh&&lowerLow?'EXPANDING_RANGE':lowerHigh&&higherLow?'CONTRACTING_RANGE':'MIXED';

  const rangeWindow=recent.slice(-20);
  const rangeHigh=Math.max(...rangeWindow.map(item=>item.high));
  const rangeLow=Math.min(...rangeWindow.map(item=>item.low));
  const ranges=recent.slice(-40).map(item=>item.high-item.low).filter(value=>value>0);
  const medianRange=quantile(ranges,.5)??Math.max(1e-12,rangeHigh-rangeLow);
  const tolerance=Math.max(medianRange*.35,last.close*.0005);
  const resistanceCandidates=[...swings.highs.map(item=>item.price),rangeHigh].filter(value=>value>last.close).sort((a,b)=>a-b);
  const supportCandidates=[...swings.lows.map(item=>item.price),rangeLow].filter(value=>value<last.close).sort((a,b)=>b-a);
  const resistance=resistanceCandidates[0]??rangeHigh;
  const support=supportCandidates[0]??rangeLow;
  const priorResistance=resistanceCandidates[1]??priorHigh?.price??resistance;
  const priorSupport=supportCandidates[1]??priorLow?.price??support;
  const lastConfirmedHigh=latestHigh?.price??rangeHigh;
  const lastConfirmedLow=latestLow?.price??rangeLow;
  const breakOfStructure=last.close>lastConfirmedHigh?'UPSIDE':last.close<lastConfirmedLow?'DOWNSIDE':'NONE';
  const changeOfCharacter=state==='HH_HL'&&breakOfStructure==='DOWNSIDE'?'DOWNSIDE':state==='LH_LL'&&breakOfStructure==='UPSIDE'?'UPSIDE':'NONE';

  const previous=recent.at(-2);
  const base=recent.slice(-22,-2);
  const baseHigh=base.length?Math.max(...base.map(item=>item.high)):rangeHigh;
  const baseLow=base.length?Math.min(...base.map(item=>item.low)):rangeLow;
  const previousUpsideBreak=Boolean(previous&&previous.close>baseHigh);
  const previousDownsideBreak=Boolean(previous&&previous.close<baseLow);
  const failedBreakout=previousUpsideBreak&&last.close<baseHigh?'UPSIDE_FAILED':previousDownsideBreak&&last.close>baseLow?'DOWNSIDE_FAILED':'NONE';
  const retestState=previousUpsideBreak&&last.low<=baseHigh+tolerance&&last.close>=baseHigh
    ?'UPSIDE_HOLD'
    :previousDownsideBreak&&last.high>=baseLow-tolerance&&last.close<=baseLow
      ?'DOWNSIDE_HOLD'
      :failedBreakout;

  const averageRange=(rows)=>mean(rows.map(item=>item.high-item.low));
  const recentRange=averageRange(recent.slice(-10));
  const priorRange=averageRange(recent.slice(-30,-10));
  const compressionRatio=priorRange>0?recentRange/priorRange:null;
  const compressionState=compressionRatio===null?'UNAVAILABLE':compressionRatio<=.72?'COMPRESSION':compressionRatio>=1.35?'EXPANSION':'NORMAL';

  const candleRange=Math.max(1e-12,last.high-last.low);
  const body=Math.abs(last.close-last.open);
  const upperWick=Math.max(0,last.high-Math.max(last.open,last.close));
  const lowerWick=Math.max(0,Math.min(last.open,last.close)-last.low);
  const supportTouches=recent.slice(-40).filter(item=>Math.abs(item.low-support)<=tolerance).length;
  const resistanceTouches=recent.slice(-40).filter(item=>Math.abs(item.high-resistance)<=tolerance).length;
  const rejectionState=last.low<=support+tolerance&&lowerWick/candleRange>=.4&&lowerWick>body
    ?'SUPPORT_REJECTION'
    :last.high>=resistance-tolerance&&upperWick/candleRange>=.4&&upperWick>body
      ?'RESISTANCE_REJECTION'
      :'NONE';
  const rangePosition=rangeHigh>rangeLow?clamp((last.close-rangeLow)/(rangeHigh-rangeLow)):null;
  const exhaustionState=compressionState==='EXPANSION'&&rangePosition!==null&&rangePosition>=.75&&upperWick/candleRange>=.45
    ?'POTENTIAL_UPSIDE_EXHAUSTION'
    :compressionState==='EXPANSION'&&rangePosition!==null&&rangePosition<=.25&&lowerWick/candleRange>=.45
      ?'POTENTIAL_DOWNSIDE_EXHAUSTION'
      :'NONE';

  const sequenceBias=state==='HH_HL'?'UPSIDE':state==='LH_LL'?'DOWNSIDE':'MIXED';
  const bias=changeOfCharacter!=='NONE'?changeOfCharacter:breakOfStructure!=='NONE'?breakOfStructure:sequenceBias;
  const continuationState=retestState==='UPSIDE_HOLD'
    ?'UPSIDE_RETEST_HOLD'
    :retestState==='DOWNSIDE_HOLD'
      ?'DOWNSIDE_RETEST_HOLD'
      :breakOfStructure==='UPSIDE'
        ?'UPSIDE_BREAK'
        :breakOfStructure==='DOWNSIDE'
          ?'DOWNSIDE_BREAK'
          :sequenceBias==='UPSIDE'
            ?'UPSIDE_STRUCTURE'
            :sequenceBias==='DOWNSIDE'
              ?'DOWNSIDE_STRUCTURE'
              :'NONE';

  let strengthScore=0;
  if(latestHigh&&priorHigh&&latestLow&&priorLow)strengthScore+=2;
  if(state==='HH_HL'||state==='LH_LL')strengthScore+=2;
  if(breakOfStructure!=='NONE')strengthScore+=2;
  if(retestState==='UPSIDE_HOLD'||retestState==='DOWNSIDE_HOLD')strengthScore+=1;
  if(supportTouches>=2)strengthScore+=1;
  if(resistanceTouches>=2)strengthScore+=1;
  const strengthState=strengthScore>=7?'STRONG':strengthScore>=5?'MODERATE':strengthScore>=3?'DEVELOPING':'WEAK';

  const phase=breakOfStructure!=='NONE'
    ?'BREAKOUT'
    :retestState==='UPSIDE_HOLD'||retestState==='DOWNSIDE_HOLD'
      ?'RETEST'
      :failedBreakout!=='NONE'
        ?'FAILED_BREAKOUT'
        :compressionState==='COMPRESSION'
          ?'CONSOLIDATION'
          :state==='HH_HL'||state==='LH_LL'
            ?'TREND_CONTINUATION'
            :'RANGE';

  return {
    state,
    bias,
    strengthState,
    strengthScore,
    support:round(support,6),
    resistance:round(resistance,6),
    priorSupport:round(priorSupport,6),
    priorResistance:round(priorResistance,6),
    breakout:breakOfStructure,
    breakOfStructure,
    changeOfCharacter,
    failedBreakout,
    retestState,
    continuationState,
    rejectionState,
    exhaustionState,
    phase,
    compressionState,
    compressionRatio:round(compressionRatio,3),
    rangeHigh:round(rangeHigh,6),
    rangeLow:round(rangeLow,6),
    rangePct:rangeLow>0?round((rangeHigh/rangeLow-1)*100,3):null,
    rangePosition:round(rangePosition,3),
    supportTouches,
    resistanceTouches,
    distanceToSupportPct:support>0?round((last.close/support-1)*100,3):null,
    distanceToResistancePct:resistance>0?round((resistance/last.close-1)*100,3):null,
    methodology:'Structure is derived from confirmed local pivots, prior-range breaks, retest holds/failures, candle rejection and bounded recent-range compression. Potential exhaustion is a descriptive heuristic, not a reversal prediction.',
    swings:{
      highs:swings.highs.slice(-4).map(item=>({time:item.time,price:round(item.price,6)})),
      lows:swings.lows.slice(-4).map(item=>({time:item.time,price:round(item.price,6)}))
    }
  };
}

export function buildDecisionQuantRisk(candles,{intervalMs,horizonBars=16}={}){
  const rows=Array.isArray(candles)?candles.filter(item=>[item?.open,item?.high,item?.low,item?.close].every(value=>Number.isFinite(Number(value))&&Number(value)>0)):[];
  if(rows.length<40||!(intervalMs>0))return {schemaVersion:QUANT_SCHEMA_VERSION,state:'INSUFFICIENT_DATA',sampleSize:rows.length,calibration:{state:'UNCALIBRATED',sampleSize:0,brierScore:null,reliabilityBins:[]}};
  const returns=[];
  for(let i=1;i<rows.length;i++)returns.push(logReturn(rows[i-1].close,rows[i].close));
  const avg=mean(returns),sigma=Math.sqrt(mean(returns.map(value=>(value-avg)**2)));
  const downside=returns.filter(value=>value<0);
  const gk=rows.map(item=>.5*Math.log(item.high/item.low)**2-(2*Math.log(2)-1)*Math.log(item.close/item.open)**2).map(value=>Math.max(0,value));
  const rs=rows.map(item=>Math.log(item.high/item.open)*Math.log(item.high/item.close)+Math.log(item.low/item.open)*Math.log(item.low/item.close)).map(value=>Math.max(0,value));
  const ann=annualizer(intervalMs);
  const rolling=rollingRealized(rows,20),currentRolling=rolling.at(-1)??sigma,volPct=percentileRank(rolling,currentRolling);
  const closes=rows.map(item=>item.close),path=closes.slice(-20);
  const efficiency=path.length>1?Math.abs(path.at(-1)-path[0])/Math.max(1e-12,path.slice(1).reduce((sum,value,index)=>sum+Math.abs(value-path[index]),0)):0;
  const roc14=closes.length>14?(closes.at(-1)/closes.at(-15)-1)*100:null;
  const adx14=adx(rows,14);
  const marketStructure=structure(rows);
  const volatilityRegime=volPct===null?'UNKNOWN':volPct>=.85?'HIGH':volPct<=.2?'LOW':volPct>=.65?'ELEVATED':'NORMAL';
  const trendRegime=adx14!==null&&adx14>=25&&efficiency>=.35?(roc14??0)>=0?'TREND_UP':'TREND_DOWN':efficiency<=.18?'RANGE':'TRANSITION';
  const regime=volatilityRegime==='HIGH'?'HIGH_VOLATILITY':trendRegime==='RANGE'?'RANGING':trendRegime==='TREND_UP'||trendRegime==='TREND_DOWN'?'TRENDING':'TRANSITION';
  const horizon=Math.max(1,Math.min(168,Number(horizonBars)||16));
  const expectedMovePct=sigma*Math.sqrt(horizon)*100;
  const q05=quantile(returns,.05),q95=quantile(returns,.95);
  const tailFrequency=returns.length?returns.filter(value=>Math.abs(value-avg)>=2*Math.max(sigma,1e-12)).length/returns.length:null;
  const result={
    schemaVersion:QUANT_SCHEMA_VERSION,
    state:'DERIVED',
    sampleSize:rows.length,
    returns:{meanPct:round(avg*100,5),q05Pct:round((q05??0)*100,4),q95Pct:round((q95??0)*100,4)},
    volatility:{
      realizedPct:round(sigma*ann*100,2),
      downsideDeviationPct:round(Math.sqrt(mean(downside.map(value=>value**2)))*ann*100,2),
      garmanKlassPct:round(Math.sqrt(mean(gk))*ann*100,2),
      rogersSatchellPct:round(Math.sqrt(mean(rs))*ann*100,2),
      percentile:round(volPct,3),
      regime:volatilityRegime,
      expectedMovePct:round(expectedMovePct,3)
    },
    trend:{adx14:round(adx14,2),efficiencyRatio:round(efficiency,3),roc14Pct:round(roc14,3),regime:trendRegime},
    structure:marketStructure,
    distribution:{skewTailFrequency:round(tailFrequency,4)},
    regime,
    horizonBars:horizon,
    calibration:{state:'UNCALIBRATED',sampleSize:0,brierScore:null,reliabilityBins:[],note:'Scenario probabilities are model outputs until enough resolved out-of-sample outcomes exist for empirical calibration.'}
  };
  return JSON.parse(JSON.stringify(result,(key,value)=>Number.isFinite(value)||typeof value!=='number'?value:null));
}

export const __decisionQuantRiskTest=Object.freeze({structure,swingPoints,rollingRealized,adx});
