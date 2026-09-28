import {buildDecisionCrossAsset} from './decision-cross-asset.js';

const finite=(value)=>value==null||value===''?null:Number.isFinite(Number(value))?Number(value):null;
const round=(value,digits=4)=>Number.isFinite(Number(value))?Number(Number(value).toFixed(digits)):null;
const epoch=(value)=>{
  const numeric=Number(value);
  if(Number.isFinite(numeric))return Math.abs(numeric)<100_000_000_000?numeric*1000:numeric;
  const parsed=Date.parse(String(value||''));
  return Number.isFinite(parsed)?parsed:null;
};
const iso=(value)=>Number.isFinite(Number(value))?new Date(Number(value)).toISOString():null;
const normalize=(raw)=>(Array.isArray(raw)?raw:[]).map(item=>({
  time:epoch(item?.t??item?.time),
  open:finite(item?.o??item?.open),
  high:finite(item?.h??item?.high),
  low:finite(item?.l??item?.low),
  close:finite(item?.c??item?.close),
  volume:finite(item?.v??item?.volume)
})).filter(item=>item.time>0&&item.close>0).sort((a,b)=>a.time-b.time);

const filterWindow=(rows,start,end,{includeStart=true,includeEnd=true}={})=>rows.filter(item=>
  (includeStart?item.time>=start:item.time>start)&&(includeEnd?item.time<=end:item.time<end)
);

const alignedPriceReceipt=(assetRows,benchmarkRows)=>{
  const benchmarkByTime=new Map(benchmarkRows.map(item=>[item.time,item.close]));
  const pairs=assetRows.map(item=>({time:item.time,asset:item.close,benchmark:benchmarkByTime.get(item.time)})).filter(item=>item.asset>0&&item.benchmark>0);
  if(pairs.length<2)return {state:'UNAVAILABLE',alignedPriceSamples:pairs.length,assetReturnPct:null,benchmarkReturnPct:null,relativeStrengthPct:null,directionAgreement:'UNAVAILABLE'};
  const first=pairs[0],last=pairs.at(-1);
  const assetReturnPct=(last.asset/first.asset-1)*100,benchmarkReturnPct=(last.benchmark/first.benchmark-1)*100,relativeStrengthPct=assetReturnPct-benchmarkReturnPct;
  const sign=(value)=>Math.abs(value)<.05?0:Math.sign(value);
  const aSign=sign(assetReturnPct),bSign=sign(benchmarkReturnPct);
  return {
    state:'AVAILABLE',
    alignedPriceSamples:pairs.length,
    start:iso(first.time),
    end:iso(last.time),
    assetReturnPct:round(assetReturnPct),
    benchmarkReturnPct:round(benchmarkReturnPct),
    relativeStrengthPct:round(relativeStrengthPct),
    directionAgreement:aSign===0||bSign===0?'MIXED':aSign===bSign?'SAME_DIRECTION':'OPPOSITE_DIRECTION'
  };
};

const evidenceStrength=(window)=>{
  const samples=Number(window?.alignedPriceSamples)||0,corr=Math.abs(Number(window?.correlation));
  if(samples>=60&&Number.isFinite(corr)&&corr>=.7)return 'STRONG';
  if(samples>=30&&Number.isFinite(corr))return 'MODERATE';
  if(samples>=10)return 'WEAK';
  return 'CONTEXT_ONLY';
};

const analyzeWindow=(assetRows,benchmarkRows,bounds,{asset,benchmark,label})=>{
  const left=filterWindow(assetRows,bounds.start,bounds.end,bounds.filter||{}),right=filterWindow(benchmarkRows,bounds.start,bounds.end,bounds.filter||{});
  const receipt=alignedPriceReceipt(left,right);
  const dependence=buildDecisionCrossAsset(left,right,{asset,benchmark});
  const dependencyAvailable=dependence?.state==='available';
  return {
    label,
    state:receipt.state,
    window:{start:iso(bounds.start),end:iso(bounds.end)},
    ...receipt,
    correlation:dependencyAvailable?finite(dependence.correlation):null,
    correlationState:dependencyAvailable?dependence.correlationState:'LIMITED_SAMPLE',
    beta:dependencyAvailable?finite(dependence.beta):null,
    rollingCorrelation30:dependencyAvailable?finite(dependence.rollingCorrelation30):null,
    divergenceState:dependencyAvailable?dependence.divergenceState:receipt.directionAgreement==='OPPOSITE_DIRECTION'?'DIVERGING':Math.abs(Number(receipt.relativeStrengthPct)||0)>=2?'WIDE_RELATIVE_GAP':'UNRESOLVED',
    spread:dependencyAvailable?dependence.spread:{state:'UNAVAILABLE',zScore:null,sampleSize:0},
    leadLag:dependencyAvailable?dependence.leadLag:{state:'UNAVAILABLE',bestLagBars:null,relation:'UNAVAILABLE',correlation:null,sampleSize:0},
    dependenceSampleSize:dependencyAvailable?Number(dependence.sampleSize)||0:0,
    dependenceState:dependencyAvailable?'AVAILABLE':'LIMITED_SAMPLE',
    evidenceStrength:evidenceStrength({...receipt,correlation:dependencyAvailable?dependence.correlation:null})
  };
};

const classificationFor=({asset,benchmark,during,assetClass})=>{
  if(during?.state!=='AVAILABLE')return {id:'UNAVAILABLE',label:'Cross-asset classification unavailable',strength:'UNAVAILABLE',rationale:'Not enough aligned selected-range observations exist to compare the asset and benchmark.',causalClaim:false,broadRiskClaim:false};
  if(String(assetClass).toLowerCase()!=='crypto')return {id:'PAIRWISE_CONTEXT_ONLY',label:'Pairwise context only',strength:during.evidenceStrength,rationale:'A bounded pairwise comparison is available, but no asset-class-specific classification is asserted.',causalClaim:false,broadRiskClaim:false};
  const a=Number(during.assetReturnPct),b=Number(during.benchmarkReturnPct),rel=Math.abs(Number(during.relativeStrengthPct)||0),corr=finite(during.correlation);
  const aSign=Math.abs(a)<.05?0:Math.sign(a),bSign=Math.abs(b)<.05?0:Math.sign(b),same=aSign!==0&&aSign===bSign,opposite=aSign!==0&&bSign!==0&&aSign!==bSign;
  const divergenceThreshold=Math.max(2.5,Math.abs(b)*1.5+1);
  if(opposite||rel>=divergenceThreshold||(Number.isFinite(corr)&&corr<.15&&rel>=1.5))return {
    id:'ASSET_SPECIFIC_DIVERGENCE',label:'Asset-specific divergence context',strength:during.evidenceStrength,
    rationale:'The selected asset diverged materially from '+benchmark+' inside the exact range. This is evidence of relative behavior, not proof of an asset-specific causal driver.',
    causalClaim:false,broadRiskClaim:false
  };
  if(asset!=='BTC'&&benchmark==='BTC'&&Number.isFinite(corr)&&corr>=.55&&same&&rel<=Math.max(1.5,Math.abs(b)*.75+.5))return {
    id:'BTC_LED_CONTEXT',label:'Consistent with BTC-led context',strength:during.evidenceStrength,
    rationale:'The asset and BTC moved in the same direction with positive selected-range dependence and a bounded relative gap. This is consistent with BTC-led context; it does not prove BTC caused the move.',
    causalClaim:false,broadRiskClaim:false
  };
  if(Number.isFinite(corr)&&corr>=.65&&same)return {
    id:'BROAD_CRYPTO_ALIGNMENT_CONTEXT',label:'Broad crypto alignment context',strength:during.evidenceStrength,
    rationale:'The selected pair moved together with strong positive selected-range dependence. Pairwise alignment is only a proxy for broad crypto risk and is not proof of a market-wide causal driver.',
    causalClaim:false,broadRiskClaim:false
  };
  return {
    id:'MIXED_CROSS_ASSET_CONTEXT',label:'Mixed cross-asset context',strength:during.evidenceStrength,
    rationale:'The selected-range relationship does not clear the conservative BTC-led, broad-alignment, or asset-specific-divergence rules.',
    causalClaim:false,broadRiskClaim:false
  };
};

const delta=(a,b)=>Number.isFinite(Number(a))&&Number.isFinite(Number(b))?round(Number(a)-Number(b)):null;

export function buildSelectedRangeCrossAssetAnalysis(assetRaw,benchmarkRaw,{selection,asset='BTC',benchmark='ETH',assetClass='crypto',provider='Hyperliquid candles'}={}){
  const start=epoch(selection?.start),end=epoch(selection?.end);
  if(start===null||end===null||!(start<end))return {
    schemaVersion:'qelly.selected-range-cross-asset/1.0.0',state:'NOT_SELECTED',asset,benchmark,assetClass,provider,windows:null,classification:{id:'UNAVAILABLE',label:'Select a range',strength:'UNAVAILABLE',rationale:'Select an exact historical range before cross-asset comparison.',causalClaim:false,broadRiskClaim:false},
    eligibilityImpact:'none',boundary:'Cross-asset context never creates setup eligibility by itself.'
  };
  const assetRows=normalize(assetRaw),benchmarkRows=normalize(benchmarkRaw),duration=end-start;
  const before=analyzeWindow(assetRows,benchmarkRows,{start:Math.max(0,start-duration),end:start,filter:{includeStart:true,includeEnd:false}},{asset,benchmark,label:'BEFORE'});
  const during=analyzeWindow(assetRows,benchmarkRows,{start,end,filter:{includeStart:true,includeEnd:true}},{asset,benchmark,label:'DURING'});
  const after=analyzeWindow(assetRows,benchmarkRows,{start:end,end:end+duration,filter:{includeStart:false,includeEnd:true}},{asset,benchmark,label:'AFTER'});
  const classification=classificationFor({asset,benchmark,during,assetClass});
  const state=during.state==='AVAILABLE'?'AVAILABLE':'UNAVAILABLE';
  const comparison={
    relativeStrengthShiftVsBefore:delta(during.relativeStrengthPct,before.relativeStrengthPct),
    relativeStrengthShiftAfter:delta(after.relativeStrengthPct,during.relativeStrengthPct),
    correlationShiftVsBefore:delta(during.correlation,before.correlation),
    correlationShiftAfter:delta(after.correlation,during.correlation)
  };
  const returnText=(value)=>Number.isFinite(Number(value))?(Number(value)>=0?'+':'')+Number(value).toFixed(2)+'%':'unavailable';
  const dataStory=state==='AVAILABLE'
    ?asset+' returned '+returnText(during.assetReturnPct)+' while '+benchmark+' returned '+returnText(during.benchmarkReturnPct)+' in the exact selected range; relative strength was '+returnText(during.relativeStrengthPct)+'. '+classification.rationale
    :'The selected range does not contain enough aligned '+asset+' / '+benchmark+' observations for a cross-asset comparison.';
  return {
    schemaVersion:'qelly.selected-range-cross-asset/1.0.0',
    state,asset,benchmark,assetClass,provider,
    selection:{start:iso(start),end:iso(end),durationMs:duration},
    windows:{before,during,after},
    selectedRange:during,
    comparison,
    classification,
    dataStory,
    evidenceStrength:during.evidenceStrength,
    eligibilityImpact:'none',
    method:'Equal-duration BEFORE / DURING / AFTER comparison using same-venue, same-interval aligned closes. Correlation, beta, spread and exploratory lag reuse the existing Decision cross-asset engine when its sample gate is met.',
    boundary:'Descriptive pairwise context only. Correlation is not causation; BTC-led or broad-alignment labels describe co-movement context and never prove a causal driver or create BUY/SELL eligibility.',
    limitations:[
      'The comparison is pairwise and same-venue; it is not a full-market factor model.',
      'BTC-led context is reported only when selected-range dependence and relative-gap rules are satisfied; it does not prove BTC caused the asset move.',
      'Broad crypto alignment is a pairwise proxy and is not proof of a broad risk move.',
      'DXY, rates, equities, gold and other macro benchmarks are not substituted because those Decision-grade historical providers are not connected.',
      'Correlation and beta are withheld when the selected window does not clear the existing cross-asset sample gate.'
    ]
  };
}

export const __selectedRangeCrossAssetTest=Object.freeze({finite,epoch,normalize,filterWindow,alignedPriceReceipt,evidenceStrength,analyzeWindow,classificationFor,delta});
