const finite=(value)=>{if(value==null||value==='')return null;const number=Number(value);return Number.isFinite(number)?number:null;};
const round=(value,digits=6)=>Number.isFinite(Number(value))?Number(Number(value).toFixed(digits)):null;
const timeMs=(value)=>{const numeric=Number(value);if(Number.isFinite(numeric))return numeric;const parsed=Date.parse(String(value||''));return Number.isFinite(parsed)?parsed:null;};
const iso=(value)=>{const time=timeMs(value);return time===null?null:new Date(time).toISOString();};
const stableHash=(value)=>{
  let hash=2166136261;
  for(const char of String(value||'')){hash^=char.charCodeAt(0);hash=Math.imul(hash,16777619);}
  return (hash>>>0).toString(16).padStart(8,'0');
};
const mean=(values)=>values.length?values.reduce((sum,value)=>sum+value,0)/values.length:null;
const candleTime=(candle)=>finite(candle?.time??candle?.t);
const normalizeCandles=(rows)=>Array.isArray(rows)?rows.map(row=>({
  time:candleTime(row),open:finite(row?.open??row?.o),high:finite(row?.high??row?.h),low:finite(row?.low??row?.l),close:finite(row?.close??row?.c),volume:finite(row?.volume??row?.v)
})).filter(row=>row.time!==null&&row.open!==null&&row.high!==null&&row.low!==null&&row.close!==null).sort((a,b)=>a.time-b.time):[];

export const windowStats=(rows)=>{
  const candles=normalizeCandles(rows);
  if(!candles.length)return {state:'UNAVAILABLE',samples:0};
  const first=candles[0],last=candles.at(-1),high=Math.max(...candles.map(x=>x.high)),low=Math.min(...candles.map(x=>x.low));
  const returns=candles.slice(1).map((row,index)=>Math.log(row.close/candles[index].close)).filter(Number.isFinite);
  const avgReturn=mean(returns);
  const variance=returns.length&&avgReturn!==null?mean(returns.map(value=>(value-avgReturn)**2)):null;
  const volumes=candles.map(x=>x.volume).filter(Number.isFinite);
  return {
    state:'AVAILABLE',samples:candles.length,start:iso(first.time),end:iso(last.time),
    open:round(first.open),close:round(last.close),high:round(high),low:round(low),
    returnPct:first.open!==0?round((last.close/first.open-1)*100,4):null,
    rangePct:low!==0?round((high/low-1)*100,4):null,
    averageVolume:volumes.length?round(mean(volumes),4):null,
    realizedVolatilityPct:variance===null?null:round(Math.sqrt(variance)*100,5)
  };
};

export const buildRangeWindows=(candles,selection)=>{
  const rows=normalizeCandles(candles),start=timeMs(selection?.start),end=timeMs(selection?.end);
  if(start===null||end===null||!(start<end))return {before:{state:'UNAVAILABLE',samples:0},during:{state:'UNAVAILABLE',samples:0},after:{state:'UNAVAILABLE',samples:0}};
  const during=rows.filter(row=>row.time>=start&&row.time<=end);
  const count=Math.max(1,during.length);
  const before=rows.filter(row=>row.time<start).slice(-count);
  const after=rows.filter(row=>row.time>end).slice(0,count);
  return {before:windowStats(before),during:windowStats(during),after:windowStats(after)};
};

const family=(id,label,state,temporalScope,source,data=null,limitations=[])=>({id,label,state,temporalScope,source,data,limitations});
const unavailable=(id,label,scope,reason)=>family(id,label,'UNAVAILABLE',scope,null,null,[reason]);
const currentOnly=(id,label,value,reason)=>family(id,label,value?.state||'UNAVAILABLE','CURRENT_CONTEXT',value?.provider||null,value||null,[reason]);

export function buildDecisionRangeEvidence({graph,evidence={},assetClass='crypto',venue='Hyperliquid',timezone='UTC'}={}){
  const selection=graph?.selection;
  if(!selection)return {
    schemaVersion:'qelly.decision-range-evidence/1.0.0',state:'NOT_SELECTED',request:null,summary:null,comparison:null,evidenceFamilies:[],coverage:[],uncertainty:['Select a historical candle range before range-specific evidence is assembled.'],
    boundary:'No selected range exists. Current market context must not be presented as historical range evidence.'
  };
  const rangeStart=timeMs(selection.start),rangeEnd=timeMs(selection.end);
  const durationMs=rangeStart!==null&&rangeEnd!==null?Math.max(1,rangeEnd-rangeStart):null;
  const preWindow=durationMs===null?null:{start:new Date(Math.max(0,rangeStart-durationMs)).toISOString(),end:new Date(rangeStart).toISOString()};
  const postWindow=durationMs===null?null:{start:new Date(rangeEnd).toISOString(),end:new Date(rangeEnd+durationMs).toISOString()};
  const selectionId='range-'+stableHash([graph?.asset,graph?.interval,rangeStart,rangeEnd,graph?.provenance?.dataFingerprint].join('|'));
  const request={
    asset:graph?.asset||null,assetClass,venue,source:graph?.provenance?.provider||venue,interval:graph?.interval||null,
    rangeStart:iso(rangeStart),rangeEnd:iso(rangeEnd),preWindow,postWindow,timezone,selectionId
  };
  const comparison=buildRangeWindows(graph?.market?.candles||[],selection);
  const news=evidence?.news||{},historicalDerivatives=evidence?.historicalDerivatives||{},selectedCrossAsset=evidence?.selectedCrossAsset||{};
  const priceData={
    start:selection.start,end:selection.end,candles:selection.candles,startPrice:finite(selection.startPrice),endPrice:finite(selection.endPrice),
    returnPct:finite(selection.changePct),rangePct:finite(selection.rangePct),high:comparison.during?.high??null,low:comparison.during?.low??null,
    volatilityPct:finite(selection.volatilityPct),volumeRatio:finite(selection.volumeRatio),structure:selection.structure||null,regime:selection.regime||'UNAVAILABLE',
    support:finite(selection.support),resistance:finite(selection.resistance),technicalComparison:selection.technicalComparison||null
  };
  const newsData={
    window:{start:request.rangeStart,end:request.rangeEnd},articles:Array.isArray(news.articles)?news.articles:[],
    clusters:Array.isArray(news.clusters)?news.clusters:[],clustering:news.clustering||null,
    coverageDisclosure:'Relevant indexed news and events found for this exact selected window; absence of a result is not proof that no event occurred.'
  };
  const regulatoryClusters=(newsData.clusters||[]).filter(cluster=>(cluster.topicHints||[]).includes('REGULATION_POLICY'));
  const flowEvidence={
    actorIdentity:'UNAVAILABLE',
    actorIdentityDisclosure:'Actor identity unavailable unless a named buyer or seller is supported by an authorized public source.',
    observedVolume:{averageVolume:finite(selection.averageVolume),volumeRatioVsPrior:finite(selection.volumeRatio)},
    settledFunding:historicalDerivatives?.fundingHistory||null,
    historicalOpenInterestState:historicalDerivatives?.historicalOpenInterestState||'UNAVAILABLE',
    liquidationState:historicalDerivatives?.liquidationsState||'UNAVAILABLE',
    orderFlowState:'UNAVAILABLE',
    volumeDeltaState:'UNAVAILABLE',
    cvdState:'UNAVAILABLE'
  };
  const families=[
    family('price-structure','Price / structure','AVAILABLE','HISTORICAL_EXACT',graph?.provenance?.provider||venue,priceData),
    family('volume','Volume','AVAILABLE','HISTORICAL_EXACT',graph?.provenance?.provider||venue,{averageVolume:finite(selection.averageVolume),volumeRatioVsPrior:finite(selection.volumeRatio)}),
    family('news','News / indexed events',String(news.state||'UNAVAILABLE').toUpperCase(),'HISTORICAL_RANGE_BOUNDED',news.provider||null,newsData,news.fallbackReason?[String(news.fallbackReason)]:[]),
    family('derivatives','Derivatives',String(historicalDerivatives.state||'UNAVAILABLE').toUpperCase(),'HISTORICAL_RANGE_BOUNDED',historicalDerivatives.provider||null,historicalDerivatives,[historicalDerivatives.boundary||'Historical derivatives are included only where provider history overlaps the selected range.']),
    unavailable('liquidity','Liquidity / order flow','HISTORICAL_UNAVAILABLE','Only a current point-in-time L2 snapshot is connected; historical book depth, CVD, aggressive flow and persistent liquidity states are not inferred.'),
    currentOnly('liquidity-current','Liquidity current context',evidence?.liquidity,'Current L2 is labeled CURRENT CONTEXT and is never backfilled into the selected historical range.'),
    currentOnly('derivatives-current','Derivatives current context',evidence?.derivatives,'Current OI, mark/oracle and live perpetual context are labeled CURRENT CONTEXT and are not evidence of the historical range.'),
    currentOnly('macro-current','Macro current context',evidence?.macro,'Connected macro references are current/delayed context only unless a historical release feed explicitly overlaps the selected range.'),
    unavailable('macro-events','Historical macro releases','HISTORICAL_UNAVAILABLE','No verified machine-readable historical macro release feed is connected to this range engine yet.'),
    unavailable('fundamentals','Fundamentals','HISTORICAL_UNAVAILABLE',assetClass==='crypto'?'No governed historical fundamental dataset is connected for this crypto range.':'No governed historical fundamental dataset is connected for this instrument.'),
    family('regulatory','Regulatory evidence',regulatoryClusters.length?'INDEXED_NEWS_ONLY':'UNAVAILABLE','HISTORICAL_RANGE_BOUNDED',news.provider||null,{clusters:regulatoryClusters},['News topic matching is contextual and does not establish causation or regulatory impact.']),
    unavailable('geopolitics','Geopolitics','HISTORICAL_UNAVAILABLE','No dedicated structured geopolitical event feed is connected; generic timing-based causation is not inferred.'),
    family('cross-asset','Cross-asset',selectedCrossAsset?.state==='available'?'AVAILABLE':'UNAVAILABLE','HISTORICAL_RANGE_BOUNDED',selectedCrossAsset?.provider||null,selectedCrossAsset,[selectedCrossAsset?.reason||'Cross-asset evidence requires aligned benchmark observations inside the selected range.']),
    unavailable('sector-index','Sector / index','NOT_APPLICABLE',assetClass==='crypto'?'Sector/index decomposition is not applicable to the current crypto-only provider profile.':'Sector/index evidence is not connected.'),
    unavailable('on-chain','On-chain','HISTORICAL_UNAVAILABLE',evidence?.onChain?.message||'Authorized on-chain history is not connected.'),
    unavailable('options','Options','HISTORICAL_UNAVAILABLE',evidence?.options?.message||'Authorized options history is not connected.'),
    family('flow-participation','Flow / participation',historicalDerivatives?.state==='available'||finite(selection.volumeRatio)!==null?'PARTIAL':'UNAVAILABLE','HISTORICAL_RANGE_BOUNDED',historicalDerivatives?.provider||graph?.provenance?.provider||null,flowEvidence,['Named buyer/seller identity is never inferred from volume, funding, price action, or order-book imbalance.'])
  ];
  const coverage=families.filter(item=>!item.id.endsWith('-current')).map(item=>({id:item.id,label:item.label,state:item.state,temporalScope:item.temporalScope,available:['AVAILABLE','PARTIAL','INDEXED_NEWS_ONLY','LIVE','CACHED','NO-MATCHES'].includes(item.state)}));
  const primaryThemes=(Array.isArray(selection.evidence)?selection.evidence:[]).slice(0,3).map(item=>({type:item.type,title:item.title,strength:finite(item.strength),direction:item.direction}));
  const summary={
    returnPct:finite(selection.changePct),durationMs,candles:Number(selection.candles)||0,high:comparison.during?.high??null,low:comparison.during?.low??null,
    direction:(finite(selection.changePct)??0)>0?'UP':(finite(selection.changePct)??0)<0?'DOWN':'FLAT',
    volatilityPct:finite(selection.volatilityPct),primaryEvidenceThemes:primaryThemes,
    explanationConfidenceState:'ASSOCIATION_ONLY',
    unresolvedUncertainty:'Observed timing and market evidence can support association; named actor identity and true causal attribution remain unavailable unless directly sourced.'
  };
  const uncertainty=[
    'Timing correlation alone is not causation.',
    'Current-context liquidity, derivatives and macro values are separated from historical range evidence.',
    'Named buyer or seller identity is unavailable unless directly sourced.',
    'Unavailable historical OI, liquidation, options, on-chain, macro-event and order-flow data are not synthesized from price action.'
  ];
  const dataStory=`${graph?.asset||'The asset'} moved ${summary.returnPct===null?'an unquantified amount':(summary.returnPct>=0?'+':'')+summary.returnPct+'%'} across ${summary.candles} ${graph?.interval||''} candles. The strongest directly observed evidence is price/structure, volume and volatility inside the selected window; bounded news, settled funding and cross-asset evidence are attached only when their timestamps overlap. Current market context is shown separately and is not used as proof of what caused the historical move.`;
  return {
    schemaVersion:'qelly.decision-range-evidence/1.0.0',state:'AVAILABLE',request,summary,dataStory,comparison,evidenceFamilies:families,coverage,
    evidenceStrengthScale:['Strong','Moderate','Weak','Context only','Contradictory'],
    uncertainty,
    causalityBoundary:'Use language such as occurred before, coincided with, consistent with, likely contributed, may have contributed, or insufficient evidence to attribute. Never assert causation solely from timing.',
    currentContextBoundary:'Any evidence family marked CURRENT_CONTEXT describes the present snapshot only and must not be represented as historical evidence for the selected range.'
  };
}

export const __decisionRangeEvidenceTest=Object.freeze({finite,timeMs,iso,stableHash,normalizeCandles});
