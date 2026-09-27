const finite=(value)=>value==null||value===''?null:Number.isFinite(Number(value))?Number(value):null;
const round=(value,digits=4)=>Number.isFinite(Number(value))?Number(Number(value).toFixed(digits)):null;
const candleTime=(row)=>finite(row?.time??row?.t);
const candle=(row)=>({
  time:candleTime(row),open:finite(row?.open??row?.o),high:finite(row?.high??row?.h),low:finite(row?.low??row?.l),close:finite(row?.close??row?.c),volume:finite(row?.volume??row?.v)
});
const selectionBounds=(selection)=>{
  const start=Date.parse(String(selection?.start||'')),end=Date.parse(String(selection?.end||''));
  return Number.isFinite(start)&&Number.isFinite(end)&&start<end?{start,end}:null;
};
const strengthFromVolume=(ratio)=>{
  const value=finite(ratio);
  if(value===null)return 'UNAVAILABLE';
  if(value>=1.5)return 'STRONG';
  if(value>=1.2)return 'MODERATE';
  if(value>=.9)return 'WEAK';
  return 'CONTEXT_ONLY';
};

export function buildDirectionalBarVolumeProxy(rows,selection){
  const bounds=selectionBounds(selection);
  if(!bounds)return {state:'UNAVAILABLE',sampleSize:0,reason:'A valid historical selection is required.'};
  const selected=(Array.isArray(rows)?rows:[]).map(candle).filter(item=>
    item.time!==null&&item.time>=bounds.start&&item.time<=bounds.end&&
    item.open!==null&&item.close!==null&&item.volume!==null&&item.volume>=0
  );
  if(!selected.length)return {state:'UNAVAILABLE',sampleSize:0,reason:'No volume-bearing candles overlap the selected range.'};
  let upVolume=0,downVolume=0,flatVolume=0;
  for(const item of selected){
    if(item.close>item.open)upVolume+=item.volume;
    else if(item.close<item.open)downVolume+=item.volume;
    else flatVolume+=item.volume;
  }
  const totalVolume=upVolume+downVolume+flatVolume;
  const upShare=totalVolume>0?upVolume/totalVolume:null,downShare=totalVolume>0?downVolume/totalVolume:null;
  const imbalanceProxy=totalVolume>0?(upVolume-downVolume)/totalVolume:null;
  let state='BALANCED_BAR_VOLUME_PROXY';
  if(Number.isFinite(imbalanceProxy)&&imbalanceProxy>=.12)state='UPSIDE_BAR_VOLUME_PROXY';
  else if(Number.isFinite(imbalanceProxy)&&imbalanceProxy<=-.12)state='DOWNSIDE_BAR_VOLUME_PROXY';
  return {
    state,sampleSize:selected.length,totalVolume:round(totalVolume,4),upBarVolume:round(upVolume,4),downBarVolume:round(downVolume,4),flatBarVolume:round(flatVolume,4),
    upShare:round(upShare,4),downShare:round(downShare,4),imbalanceProxyPct:imbalanceProxy===null?null:round(imbalanceProxy*100,2),
    method:'Classify each OHLCV candle by close versus open and compare the volume attached to up bars versus down bars.',
    boundary:'Directional bar-volume is a price/volume participation proxy only. It is not taker buy/sell volume, volume delta, CVD, exchange-reported order flow, or proof of buyer/seller identity.'
  };
}

export function buildDecisionRangeFlowParticipation({graph,evidence={}}={}){
  const selection=graph?.selection;
  if(!selection)return {
    schemaVersion:'qelly.decision-range-flow/1.0.0',state:'NOT_SELECTED',actorIdentity:'UNAVAILABLE',sections:{},
    boundary:'Select an exact historical range before participation evidence is assembled.'
  };
  const proxy=buildDirectionalBarVolumeProxy(graph?.market?.candles||[],selection);
  const volumeRatio=finite(selection?.volumeRatio),moveReturnPct=finite(selection?.changePct);
  const funding=evidence?.historicalDerivatives?.fundingHistory||null;
  const fundingAvailable=String(funding?.state||'').toLowerCase()==='available'&&Number(funding?.sampleSize)>0;
  const participationAvailable=proxy.state!=='UNAVAILABLE'||volumeRatio!==null||fundingAvailable;
  const proxyDirection=String(proxy.state||'').startsWith('UPSIDE')?'UPSIDE':String(proxy.state||'').startsWith('DOWNSIDE')?'DOWNSIDE':'MIXED';
  const namedFlows={
    state:'UNAVAILABLE',label:'Known named flows',actorIdentity:'UNAVAILABLE',items:[],
    reason:'No authorized source connected to this crypto range identifies a named buyer, seller, fund, institution, insider, ETF allocation, block-trade counterparty, or exchange-flow owner.',
    disclosure:'Actor identity unavailable.'
  };
  const observedOrderFlow={
    state:participationAvailable?'PARTIAL':'UNAVAILABLE',label:'Observed order flow',
    trueOrderFlowState:'UNAVAILABLE',volumeDeltaState:'UNAVAILABLE',cvdState:'UNAVAILABLE',takerSideState:'UNAVAILABLE',historicalBookState:'UNAVAILABLE',
    participationProxy:proxy,
    averageVolume:finite(selection?.averageVolume),volumeRatioVsPrior:volumeRatio,
    evidenceStrength:strengthFromVolume(volumeRatio),
    directionalContext:proxyDirection,
    description:proxy.state==='UNAVAILABLE'
      ?'Historical trade-side/order-flow data are unavailable for this range.'
      :'OHLCV shows '+proxyDirection.toLowerCase()+' bar-volume participation context; this is not verified aggressive buyer/seller flow.',
    boundary:'Observed OHLCV participation may describe pressure consistent with the move, but QELLY does not relabel it as order-flow imbalance without trade-side data.'
  };
  const institutional={
    state:'UNAVAILABLE',label:'Public institutional data',
    etfFlowState:'UNAVAILABLE',filingState:'UNAVAILABLE',blockTradeState:'UNAVAILABLE',cotState:'NOT_APPLICABLE',insiderState:'NOT_APPLICABLE',exchangeFlowState:'UNAVAILABLE',
    reason:'No governed historical ETF/fund-flow, filing, block-trade, COT, insider, or attributed exchange-flow dataset is connected to this crypto range.',
    boundary:'News mentions of ETFs, funds, institutions or large transfers are not converted into flow quantities or actor identity.'
  };
  const unknown={
    state:participationAvailable?'PARTIAL':'UNAVAILABLE',label:'Unknown actor activity',actorIdentity:'UNAVAILABLE',
    moveReturnPct,volumeRatioVsPrior:volumeRatio,barVolumeProxy:proxy,
    settledFunding:fundingAvailable?{
      state:'AVAILABLE',sampleSize:Number(funding.sampleSize)||0,windowHours:finite(funding.windowHours),
      medianFundingPct:finite(funding.medianFundingPct),minFundingPct:finite(funding.minFundingPct),maxFundingPct:finite(funding.maxFundingPct),
      latestHistoricalAt:funding.latestHistoricalAt||null,method:funding.method||null
    }:{state:'UNAVAILABLE',sampleSize:0},
    historicalOpenInterestState:evidence?.historicalDerivatives?.historicalOpenInterestState||'UNAVAILABLE',
    liquidationsState:evidence?.historicalDerivatives?.liquidationsState||'UNAVAILABLE',
    interpretation:participationAvailable
      ?'Unidentified market participants produced the observed price/volume pattern'+(fundingAvailable?' alongside settled funding observations.':'.')
      :'Historical participation evidence is insufficient to characterize activity.',
    disclosure:'Actor identity unavailable. Do not infer whales, institutions, funds, insiders, market makers, or coordinated actors from price, volume, funding, or news alone.'
  };
  return {
    schemaVersion:'qelly.decision-range-flow/1.0.0',
    state:participationAvailable?'PARTIAL':'UNAVAILABLE',
    asset:graph?.asset||null,interval:graph?.interval||null,
    rangeStart:selection.start||null,rangeEnd:selection.end||null,
    actorIdentity:'UNAVAILABLE',
    source:graph?.provenance?.provider||'Hyperliquid',
    sourceUrl:graph?.provenance?.documentation||null,
    sections:{knownNamedFlows:namedFlows,observedOrderFlow,publicInstitutionalData:institutional,unknownActorActivity:unknown},
    summary:{
      state:participationAvailable?'PARTIAL':'UNAVAILABLE',
      evidenceStrength:strengthFromVolume(volumeRatio),
      directionalContext:proxyDirection,
      volumeRatioVsPrior:volumeRatio,
      settledFundingSamples:fundingAvailable?Number(funding.sampleSize)||0:0,
      actorIdentity:'UNAVAILABLE'
    },
    allowedLanguage:[
      'Observed participation proxy',
      'Observed upside/downside bar-volume context',
      'Settled funding observations',
      'Actor identity unavailable'
    ],
    prohibitedInference:[
      'Named whale/institution without a source',
      'Order-flow imbalance without trade-side data',
      'Volume delta or CVD without the underlying transaction feed',
      'Historical open-interest change when no history is connected'
    ],
    boundary:'Flow/participation evidence is source- and capability-bounded. Named buyer/seller attribution requires a direct authorized source. Price/volume/funding context may describe anonymous participation but cannot establish who traded or prove causal intent.'
  };
}

export const __decisionRangeFlowTest=Object.freeze({finite,strengthFromVolume,selectionBounds});
