const SCHEMA_VERSION='qelly.decision-smc-price-action/1.0.0';
const finite=(value)=>value==null||value===''?null:Number.isFinite(Number(value))?Number(value):null;
const round=(value,digits=6)=>Number.isFinite(Number(value))?Number(Number(value).toFixed(digits)):null;
const clamp=(value,min=-1,max=1)=>Math.min(max,Math.max(min,Number(value)||0));
const mean=(values)=>values.length?values.reduce((sum,value)=>sum+value,0)/values.length:0;
const median=(values)=>{const valid=values.filter(Number.isFinite).sort((a,b)=>a-b);if(!valid.length)return null;const i=Math.floor(valid.length/2);return valid.length%2?valid[i]:(valid[i-1]+valid[i])/2;};

export const SMC_PRICE_ACTION_DEFINITIONS=Object.freeze({
  swing:'Swing high/low uses a symmetric two-candle wing: the pivot high must exceed both highs on each side; the pivot low must be below both lows on each side.',
  sequence:'HH/HL/LH/LL compares the two latest confirmed swing highs and lows.',
  bos:'Break of structure requires a close beyond the latest confirmed swing level by the deterministic tolerance.',
  choch:'Change of character requires a break opposite the prior HH/HL or LH/LL sequence.',
  displacement:'Displacement requires body >= 1.6x median prior-20 body, body/range >= 0.60, and close in the outer 25% of the candle range.',
  fvg:'Bullish FVG exists when candle i low is above candle i-2 high by at least 0.25x tolerance; bearish FVG is the inverse. Later overlap marks mitigation.',
  orderBlock:'Order block is the last opposite-colored candle within eight bars before a same-direction displacement plus BOS; bullish zone is low-to-open, bearish zone open-to-high.',
  mitigation:'An order-block or FVG zone is mitigated after formation when a later candle overlaps the zone.',
  liquiditySweep:'High sweep exceeds a confirmed swing high by tolerance but closes back below it; low sweep is the inverse.',
  equalHighLow:'Equal highs/lows are adjacent confirmed pivots within the deterministic tolerance.',
  premiumDiscount:'Premium/discount uses the latest confirmed swing range when valid, otherwise the prior 20-bar range; >55% is premium, <45% discount, otherwise equilibrium.',
  failedBreakout:'Failed breakout requires the prior candle to close beyond the preceding 20-bar range and the latest candle to close back inside.',
  rangeLiquidity:'Range liquidity reports repeated touches at deterministic support/resistance tolerance and equal-pivot pools.',
  breakout:'Price-action breakout requires the latest close beyond the previous 20-bar high/low by tolerance.',
  retest:'Retest requires the prior candle to break the previous range and the latest candle to revisit the broken level within tolerance while closing on the breakout side.',
  rejection:'Rejection requires price to test prior range support/resistance and the corresponding wick to be >=40% of candle range and larger than the body.',
  engulfing:'Bullish/bearish engulfing requires the current real body to fully contain the previous opposite real body.',
  insideBar:'Inside bar requires current high <= previous high and current low >= previous low.',
  outsideBar:'Outside bar requires current high >= previous high and current low <= previous low.',
  pinBar:'Pin/rejection bar requires one wick >=55% of total range and >=2x the real body.',
  compressionExpansion:'Compression/expansion compares mean range of latest five bars with prior fifteen: <=0.70 compression, >=1.35 expansion.',
  gap:'Gap up requires current low > previous high; gap down requires current high < previous low.',
  trendContinuation:'Trend continuation requires breakout/retest alignment with deterministic swing-sequence bias.',
  exhaustion:'Potential exhaustion requires expansion at a range edge plus an opposing rejection/pin pattern.',
  rangeBreakout:'Range breakout is the breakout state measured against the previous 20-bar range.'
});

const normalize=(raw)=>(Array.isArray(raw)?raw:[]).map((item,index)=>({
  index,
  time:finite(item?.time??item?.t),
  open:finite(item?.open??item?.o),
  high:finite(item?.high??item?.h),
  low:finite(item?.low??item?.l),
  close:finite(item?.close??item?.c),
  volume:finite(item?.volume??item?.v)??0
})).filter(item=>item.time>0&&item.open>0&&item.close>0&&item.low>0&&item.volume>=0&&item.high>=Math.max(item.open,item.close)&&item.low<=Math.min(item.open,item.close));

const candleRange=(item)=>Math.max(0,(item?.high??0)-(item?.low??0));
const body=(item)=>Math.abs((item?.close??0)-(item?.open??0));
const upperWick=(item)=>Math.max(0,(item?.high??0)-Math.max(item?.open??0,item?.close??0));
const lowerWick=(item)=>Math.max(0,Math.min(item?.open??0,item?.close??0)-(item?.low??0));
const directionOf=(item)=>item.close>item.open?'BULLISH':item.close<item.open?'BEARISH':'DOJI';

function pivots(rows,wing=2){
  const highs=[],lows=[];
  for(let i=wing;i<rows.length-wing;i++){
    const current=rows[i],neighbors=[...rows.slice(i-wing,i),...rows.slice(i+1,i+wing+1)];
    if(neighbors.every(item=>current.high>item.high))highs.push({index:i,time:current.time,price:current.high});
    if(neighbors.every(item=>current.low<item.low))lows.push({index:i,time:current.time,price:current.low});
  }
  return {highs,lows};
}
const toleranceFor=(rows)=>{
  const recent=rows.slice(-40),ranges=recent.map(candleRange).filter(value=>value>0),last=rows.at(-1)?.close||0;
  return Math.max(last*.0005,(median(ranges)??last*.001)*.15);
};
const sequenceFrom=(swings)=>{
  const h1=swings.highs.at(-2),h2=swings.highs.at(-1),l1=swings.lows.at(-2),l2=swings.lows.at(-1);
  if(!(h1&&h2&&l1&&l2))return 'MIXED';
  if(h2.price>h1.price&&l2.price>l1.price)return 'HH_HL';
  if(h2.price<h1.price&&l2.price<l1.price)return 'LH_LL';
  if(h2.price>h1.price&&l2.price<l1.price)return 'EXPANDING_RANGE';
  if(h2.price<h1.price&&l2.price>l1.price)return 'CONTRACTING_RANGE';
  return 'MIXED';
};
const overlap=(candle,zone)=>candle&&zone&&candle.high>=zone.low&&candle.low<=zone.high;

function detectFvgs(rows,tolerance){
  const output=[];
  for(let i=2;i<rows.length;i++){
    const a=rows[i-2],c=rows[i];
    if(c.low>a.high+tolerance*.25)output.push({id:'fvg-bull-'+i,direction:'BULLISH',formedIndex:i,formedAt:c.time,low:a.high,high:c.low});
    if(c.high<a.low-tolerance*.25)output.push({id:'fvg-bear-'+i,direction:'BEARISH',formedIndex:i,formedAt:c.time,low:c.high,high:a.low});
  }
  return output.slice(-12).map(zone=>{
    const later=rows.slice(zone.formedIndex+1),mitigation=later.find(item=>overlap(item,zone));
    return {...zone,low:round(zone.low),high:round(zone.high),sizePct:round((zone.high/zone.low-1)*100,4),mitigated:Boolean(mitigation),mitigatedAt:mitigation?new Date(mitigation.time).toISOString():null};
  });
}

function detectDisplacement(rows){
  const current=rows.at(-1),prior=rows.slice(-21,-1);
  if(!current||prior.length<10)return {state:'UNAVAILABLE',direction:'NONE',bodyRatio:null,bodyRangeRatio:null};
  const medianBody=median(prior.map(body).filter(value=>value>0))??0,range=candleRange(current),currentBody=body(current);
  const bodyRatio=medianBody>0?currentBody/medianBody:null,bodyRangeRatio=range>0?currentBody/range:null;
  const closeLocation=range>0?(current.close-current.low)/range:.5;
  const qualifies=bodyRatio!==null&&bodyRatio>=1.6&&bodyRangeRatio>=.60;
  const direction=qualifies&&current.close>current.open&&closeLocation>=.75?'BULLISH':qualifies&&current.close<current.open&&closeLocation<=.25?'BEARISH':'NONE';
  return {state:direction==='NONE'?'NONE':'DETECTED',direction,bodyRatio:round(bodyRatio,3),bodyRangeRatio:round(bodyRangeRatio,3),closeLocation:round(closeLocation,3),formedAt:new Date(current.time).toISOString()};
}

function detectOrderBlock(rows,{bos,displacement}){
  if(displacement.direction==='NONE'||bos==='NONE'||displacement.direction!==bos)return null;
  const bullish=bos==='BULLISH',end=rows.length-2;
  for(let i=end;i>=Math.max(0,end-7);i--){
    const candle=rows[i],opposite=bullish?candle.close<candle.open:candle.close>candle.open;
    if(!opposite)continue;
    const zone=bullish?{low:candle.low,high:candle.open}:{low:candle.open,high:candle.high};
    const mitigation=rows.slice(i+2).find(item=>overlap(item,zone));
    return {direction:bullish?'BULLISH':'BEARISH',formedAt:new Date(candle.time).toISOString(),formedIndex:i,low:round(zone.low),high:round(zone.high),mitigated:Boolean(mitigation),mitigatedAt:mitigation?new Date(mitigation.time).toISOString():null,rule:'last opposite candle before same-direction displacement + BOS'};
  }
  return null;
}

function priceAction(rows,tolerance,sequence){
  const current=rows.at(-1),previous=rows.at(-2);
  if(!current||!previous)return {state:'UNAVAILABLE',directionalScore:0};
  const priorRange=rows.slice(-21,-1),priorHigh=priorRange.length?Math.max(...priorRange.map(item=>item.high)):null,priorLow=priorRange.length?Math.min(...priorRange.map(item=>item.low)):null;
  const previousBase=rows.slice(-22,-2),previousBaseHigh=previousBase.length?Math.max(...previousBase.map(item=>item.high)):priorHigh,previousBaseLow=previousBase.length?Math.min(...previousBase.map(item=>item.low)):priorLow;
  const breakout=current.close>(priorHigh??Infinity)+tolerance?'BULLISH':current.close<(priorLow??-Infinity)-tolerance?'BEARISH':'NONE';
  const prevBreak=previous.close>(previousBaseHigh??Infinity)+tolerance?'BULLISH':previous.close<(previousBaseLow??-Infinity)-tolerance?'BEARISH':'NONE';
  const retest=prevBreak==='BULLISH'&&current.low<=previousBaseHigh+tolerance&&current.close>=previousBaseHigh?'BULLISH':prevBreak==='BEARISH'&&current.high>=previousBaseLow-tolerance&&current.close<=previousBaseLow?'BEARISH':'NONE';
  const failedBreakout=prevBreak==='BULLISH'&&current.close<previousBaseHigh?'BULLISH_FAILED':prevBreak==='BEARISH'&&current.close>previousBaseLow?'BEARISH_FAILED':'NONE';
  const bullishEngulf=current.close>current.open&&previous.close<previous.open&&current.open<=previous.close&&current.close>=previous.open;
  const bearishEngulf=current.close<current.open&&previous.close>previous.open&&current.open>=previous.close&&current.close<=previous.open;
  const engulfing=bullishEngulf?'BULLISH':bearishEngulf?'BEARISH':'NONE';
  const insideBar=current.high<=previous.high&&current.low>=previous.low;
  const outsideBar=current.high>=previous.high&&current.low<=previous.low;
  const range=Math.max(candleRange(current),1e-12),realBody=body(current),uw=upperWick(current),lw=lowerWick(current);
  const pinBar=lw/range>=.55&&lw>=realBody*2?'BULLISH':uw/range>=.55&&uw>=realBody*2?'BEARISH':'NONE';
  const rejection=current.low<=(priorLow??current.low)+tolerance&&lw/range>=.4&&lw>realBody?'BULLISH':current.high>=(priorHigh??current.high)-tolerance&&uw/range>=.4&&uw>realBody?'BEARISH':'NONE';
  const gap=current.low>previous.high?'UP':current.high<previous.low?'DOWN':'NONE';
  const latest5=rows.slice(-5).map(candleRange),prior15=rows.slice(-20,-5).map(candleRange),ratio=prior15.length&&mean(prior15)>0?mean(latest5)/mean(prior15):null;
  const rangeState=ratio===null?'UNAVAILABLE':ratio<=.70?'COMPRESSION':ratio>=1.35?'EXPANSION':'NORMAL';
  const continuation=(sequence==='HH_HL'&&(breakout==='BULLISH'||retest==='BULLISH'))?'BULLISH':(sequence==='LH_LL'&&(breakout==='BEARISH'||retest==='BEARISH'))?'BEARISH':'NONE';
  const rangePosition=priorHigh>priorLow?(current.close-priorLow)/(priorHigh-priorLow):null;
  const exhaustion=rangeState==='EXPANSION'&&rangePosition!==null&&rangePosition>=.8&&(pinBar==='BEARISH'||rejection==='BEARISH')?'UPSIDE_EXHAUSTION':rangeState==='EXPANSION'&&rangePosition!==null&&rangePosition<=.2&&(pinBar==='BULLISH'||rejection==='BULLISH')?'DOWNSIDE_EXHAUSTION':'NONE';
  const components=[
    breakout==='BULLISH'?.35:breakout==='BEARISH'?-.35:0,
    retest==='BULLISH'?.28:retest==='BEARISH'?-.28:0,
    engulfing==='BULLISH'?.18:engulfing==='BEARISH'?-.18:0,
    pinBar==='BULLISH'?.12:pinBar==='BEARISH'?-.12:0,
    rejection==='BULLISH'?.17:rejection==='BEARISH'?-.17:0,
    continuation==='BULLISH'?.25:continuation==='BEARISH'?-.25:0,
    exhaustion==='DOWNSIDE_EXHAUSTION'?.12:exhaustion==='UPSIDE_EXHAUSTION'?-.12:0,
    failedBreakout==='BEARISH_FAILED'?.18:failedBreakout==='BULLISH_FAILED'?-.18:0
  ];
  const directionalScore=clamp(components.reduce((sum,value)=>sum+value,0));
  return {
    state:'DERIVED',directionalScore:round(directionalScore,4),direction:directionalScore>.08?'BULLISH':directionalScore<-.08?'BEARISH':'NEUTRAL',
    breakout,retest,rejection,engulfing,insideBar,outsideBar,pinBar,gap,compressionExpansion:rangeState,rangeRatio:round(ratio,3),trendContinuation:continuation,exhaustion,rangeBreakout:breakout,failedBreakout,
    priorRange:{low:round(priorLow),high:round(priorHigh)},methodology:'All price-action labels are deterministic and use the published Wave CC definitions; they are descriptive evidence, not guaranteed reversal/continuation claims.'
  };
}

export function buildDecisionSmcPriceAction(raw){
  const rows=normalize(raw);
  if(rows.length<30)return {schemaVersion:SCHEMA_VERSION,state:'INSUFFICIENT_DATA',sampleSize:rows.length,smc:{state:'UNAVAILABLE'},priceAction:{state:'UNAVAILABLE'},definitions:SMC_PRICE_ACTION_DEFINITIONS};
  const swings=pivots(rows,2),sequence=sequenceFrom(swings),tolerance=toleranceFor(rows),last=rows.at(-1);
  const lastHigh=swings.highs.at(-1),lastLow=swings.lows.at(-1);
  const bos=lastHigh&&last.close>lastHigh.price+tolerance?'BULLISH':lastLow&&last.close<lastLow.price-tolerance?'BEARISH':'NONE';
  const choch=sequence==='LH_LL'&&bos==='BULLISH'?'BULLISH':sequence==='HH_HL'&&bos==='BEARISH'?'BEARISH':'NONE';
  const displacement=detectDisplacement(rows);
  const fvgs=detectFvgs(rows,tolerance);
  const activeFvgs=fvgs.filter(item=>!item.mitigated);
  const orderBlock=detectOrderBlock(rows,{bos,displacement});
  const highSweep=lastHigh&&last.high>lastHigh.price+tolerance&&last.close<lastHigh.price;
  const lowSweep=lastLow&&last.low<lastLow.price-tolerance&&last.close>lastLow.price;
  const liquiditySweep=highSweep?'HIGH_SWEEP':lowSweep?'LOW_SWEEP':'NONE';
  const equalHighs=[],equalLows=[];
  for(let i=1;i<swings.highs.length;i++)if(Math.abs(swings.highs[i].price-swings.highs[i-1].price)<=tolerance)equalHighs.push({a:round(swings.highs[i-1].price),b:round(swings.highs[i].price),latestAt:new Date(swings.highs[i].time).toISOString()});
  for(let i=1;i<swings.lows.length;i++)if(Math.abs(swings.lows[i].price-swings.lows[i-1].price)<=tolerance)equalLows.push({a:round(swings.lows[i-1].price),b:round(swings.lows[i].price),latestAt:new Date(swings.lows[i].time).toISOString()});
  const definedHigh=lastHigh?.price??Math.max(...rows.slice(-20).map(item=>item.high)),definedLow=lastLow?.price??Math.min(...rows.slice(-20).map(item=>item.low));
  const position=definedHigh>definedLow?(last.close-definedLow)/(definedHigh-definedLow):null;
  const premiumDiscount=position===null?'UNAVAILABLE':position>.55?'PREMIUM':position<.45?'DISCOUNT':'EQUILIBRIUM';
  const pa=priceAction(rows,tolerance,sequence);
  const smcParts=[
    bos==='BULLISH'?.35:bos==='BEARISH'?-.35:0,
    choch==='BULLISH'?.25:choch==='BEARISH'?-.25:0,
    displacement.direction==='BULLISH'?.18:displacement.direction==='BEARISH'?-.18:0,
    liquiditySweep==='LOW_SWEEP'?.22:liquiditySweep==='HIGH_SWEEP'?-.22:0
  ];
  const smcScore=clamp(smcParts.reduce((sum,value)=>sum+value,0));
  const supportTouches=rows.slice(-40).filter(item=>Math.abs(item.low-definedLow)<=tolerance).length,resistanceTouches=rows.slice(-40).filter(item=>Math.abs(item.high-definedHigh)<=tolerance).length;
  const smc={
    state:'DERIVED',directionalScore:round(smcScore,4),direction:smcScore>.08?'BULLISH':smcScore<-.08?'BEARISH':'NEUTRAL',
    tolerance:round(tolerance),swingSequence:sequence,breakOfStructure:bos,changeOfCharacter:choch,displacement,
    fairValueGaps:{count:fvgs.length,activeCount:activeFvgs.length,recent:fvgs.slice(-6)},
    orderBlock:orderBlock||{state:'NONE'},
    liquiditySweep,equalHighs:equalHighs.slice(-4),equalLows:equalLows.slice(-4),
    premiumDiscount:{state:premiumDiscount,position:round(position,3),rangeLow:round(definedLow),rangeHigh:round(definedHigh)},
    rangeLiquidity:{supportTouches,resistanceTouches,equalHighPools:equalHighs.length,equalLowPools:equalLows.length},
    failedBreakout:pa.failedBreakout,
    swings:{highs:swings.highs.slice(-4).map(item=>({time:new Date(item.time).toISOString(),price:round(item.price)})),lows:swings.lows.slice(-4).map(item=>({time:new Date(item.time).toISOString(),price:round(item.price)}))},
    methodology:'Deterministic SMC/market-structure classification using published pivot, tolerance, displacement, imbalance, order-block, sweep and range rules. No discretionary chart labels are inferred.'
  };
  return {schemaVersion:SCHEMA_VERSION,state:'DERIVED',sampleSize:rows.length,smc,priceAction:pa,definitions:SMC_PRICE_ACTION_DEFINITIONS,boundary:'SMC and price-action states are deterministic transformations of observed OHLCV. They are evidence features, not institutional-flow proof, not trader intent, and not standalone trade recommendations.'};
}

export const __decisionSmcPriceActionTest=Object.freeze({normalize,pivots,toleranceFor,sequenceFrom,detectFvgs,detectDisplacement,detectOrderBlock,priceAction});
