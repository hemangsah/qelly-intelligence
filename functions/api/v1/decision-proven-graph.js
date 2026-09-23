import {buildDecisionProvenGraph,buildDecisionWalkForwardCalibration,DECISION_INTERVALS} from '../../_lib/decision-proven-graph.js';
import {buildTradeResearch} from '../../_lib/decision-trade-research.js';
import {buildDecisionHistoricalAnalogs} from '../../_lib/decision-historical-analogs.js';
import {normalizeDecisionLiquidity} from '../../_lib/decision-liquidity.js';
import {buildFundingHistoryContext} from '../../_lib/decision-derivatives.js';
import {buildDecisionCrossAsset} from '../../_lib/decision-cross-asset.js';
import {HttpError,enforceRateLimit,errorResponse,fetcher,responseJson} from '../../_lib/runtime.js';

const ASSETS=new Set(['BTC','ETH','SOL','HYPE','XRP','DOGE']);
const HORIZONS=Object.freeze({'1h':3_600_000,'4h':14_400_000,'12h':43_200_000,'1d':86_400_000,'3d':259_200_000,'7d':604_800_000});
const TIMEFRAMES=Object.freeze(['15m','1h','4h','1d']);
const NEWS_TERMS=Object.freeze({BTC:'Bitcoin OR BTC',ETH:'Ethereum OR Ether',SOL:'Solana',HYPE:'Hyperliquid',XRP:'XRP OR Ripple',DOGE:'Dogecoin OR DOGE'});
const HYPERLIQUID_INFO_URL='https://api.hyperliquid.xyz/info';
const HYPERLIQUID_PERP_DOCS='https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/info-endpoint/perpetuals';
const HYPERLIQUID_L2_DOCS='https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/info-endpoint';
const ip=(request)=>request.headers.get('cf-connecting-ip')||request.headers.get('x-forwarded-for')?.split(',')[0]||'anonymous';
const gdeltTime=(time)=>new Date(time).toISOString().replace(/\D/g,'').slice(0,14);
const safeUrl=(value)=>{try{const url=new URL(value);return url.protocol==='https:'||url.protocol==='http:'?url.href:null;}catch{return null;}};
const finite=(value)=>{const number=Number(value);return Number.isFinite(number)?number:null;};
const round=(value,digits=6)=>Number.isFinite(value)?Number(value.toFixed(digits)):null;
const clamp=(value,min=0,max=1)=>Math.min(max,Math.max(min,value));

async function fetchCandles(fetchImpl,asset,interval,endTime,points=500){
  const response=await fetchImpl(HYPERLIQUID_INFO_URL,{method:'POST',headers:{'content-type':'application/json','user-agent':'QELLY-Intelligence/decision-intelligence'},body:JSON.stringify({type:'candleSnapshot',req:{coin:asset,interval,startTime:endTime-DECISION_INTERVALS[interval]*points,endTime}}),signal:AbortSignal.timeout(8_000)});
  if(!response.ok)throw new HttpError(503,'provider_unavailable','Live market data is unavailable',{retryable:true});
  try{return await response.json();}catch{throw new HttpError(503,'provider_invalid_response','Live market data returned an invalid response',{retryable:true});}
}

async function fetchOptionalCandles(fetchImpl,asset,interval,endTime,points=240){
  try{return await fetchCandles(fetchImpl,asset,interval,endTime,points);}catch{return null;}
}

async function fetchFundingHistory(fetchImpl,asset,endTime){
  try{
    const response=await fetchImpl(HYPERLIQUID_INFO_URL,{
      method:'POST',
      headers:{'content-type':'application/json','user-agent':'QELLY-Intelligence/decision-intelligence'},
      body:JSON.stringify({type:'fundingHistory',coin:asset,startTime:endTime-72*3_600_000,endTime}),
      signal:AbortSignal.timeout(6_000)
    });
    if(!response.ok)return [];
    const payload=await response.json();
    return Array.isArray(payload)?payload:[];
  }catch{return [];}
}

async function fetchLiquidityContext(fetchImpl,asset){
  const unavailable=(reason='Current L2 liquidity context is unavailable, so spread and book imbalance are not inferred.')=>({
    state:'unavailable',
    provider:'Hyperliquid',
    documentation:HYPERLIQUID_L2_DOCS,
    asset,
    currentOnly:true,
    reason,
    spreadState:'UNAVAILABLE',
    imbalanceState:'UNAVAILABLE',
    spreadBps:null,
    top5BidDepthUsd:null,
    top5AskDepthUsd:null,
    top5Imbalance:null
  });
  try{
    const response=await fetchImpl(HYPERLIQUID_INFO_URL,{
      method:'POST',
      headers:{'content-type':'application/json','user-agent':'QELLY-Intelligence/decision-intelligence'},
      body:JSON.stringify({type:'l2Book',coin:asset}),
      signal:AbortSignal.timeout(5_000)
    });
    if(!response.ok)return unavailable();
    const normalized=normalizeDecisionLiquidity(await response.json(),{asset,provider:'Hyperliquid'});
    return {...normalized,documentation:HYPERLIQUID_L2_DOCS};
  }catch{
    return unavailable();
  }
}

async function fetchDerivativesContext(fetchImpl,asset,observedAt){
  const unavailable=(message='Current funding and open-interest context is unavailable, so it is not inferred.')=>({state:'unavailable',provider:'Hyperliquid',documentation:HYPERLIQUID_PERP_DOCS,currentOnly:true,message});
  try{
    const response=await fetchImpl(HYPERLIQUID_INFO_URL,{
      method:'POST',
      headers:{'content-type':'application/json','user-agent':'QELLY-Intelligence/decision-intelligence'},
      body:JSON.stringify({type:'metaAndAssetCtxs'}),
      signal:AbortSignal.timeout(8_000)
    });
    if(!response.ok)return unavailable();
    const payload=await response.json();
    const meta=Array.isArray(payload)?payload[0]:null;
    const contexts=Array.isArray(payload)?payload[1]:null;
    const universe=Array.isArray(meta?.universe)?meta.universe:[];
    if(!Array.isArray(contexts))return unavailable();
    const index=universe.findIndex(item=>String(item?.name||'').toUpperCase()===asset);
    if(index<0||!contexts[index])return unavailable('Hyperliquid does not currently expose perpetual context for this asset.');
    const context=contexts[index];
    const fundingRate=finite(context.funding);
    const openInterest=finite(context.openInterest);
    const markPrice=finite(context.markPx);
    const oraclePrice=finite(context.oraclePx);
    const dayNotionalVolumeUsd=finite(context.dayNtlVlm);
    const premium=finite(context.premium);
    if([fundingRate,openInterest,markPrice,oraclePrice,dayNotionalVolumeUsd,premium].every(value=>value===null))return unavailable();
    return {
      state:'live',
      provider:'Hyperliquid',
      documentation:HYPERLIQUID_PERP_DOCS,
      observedAt:new Date(observedAt).toISOString(),
      currentOnly:true,
      fundingRate:round(fundingRate,10),
      fundingPct:fundingRate===null?null:round(fundingRate*100,6),
      openInterest:round(openInterest,6),
      openInterestNotionalUsd:openInterest===null||markPrice===null?null:round(openInterest*markPrice,2),
      markPrice:round(markPrice,6),
      oraclePrice:round(oraclePrice,6),
      markOracleBasisPct:markPrice===null||oraclePrice===null||oraclePrice===0?null:round((markPrice/oraclePrice-1)*100,6),
      dayNotionalVolumeUsd:round(dayNotionalVolumeUsd,2),
      premiumPct:premium===null?null:round(premium*100,6),
      message:'Current Hyperliquid perpetual context. It is not backfilled into a selected historical move or treated as causal evidence.'
    };
  }catch{
    return unavailable();
  }
}

const newsUrl=(asset,start,end,{fallback=false}={})=>{const url=new URL('https://api.gdeltproject.org/api/v2/doc/doc');url.searchParams.set('query','('+NEWS_TERMS[asset]+') sourcelang:english');url.searchParams.set('mode','artlist');url.searchParams.set('format','json');url.searchParams.set('maxrecords','12');url.searchParams.set('sort','HybridRel');if(fallback)url.searchParams.set('timespan','3days');else{url.searchParams.set('startdatetime',gdeltTime(Math.max(end-72*3_600_000,start)));url.searchParams.set('enddatetime',gdeltTime(end));}return url.href;};
const normalizeArticles=(payload)=>(Array.isArray(payload?.articles)?payload.articles:[]).map(article=>({title:String(article?.title||'').trim().slice(0,240),source:String(article?.domain||'').trim().slice(0,100),publishedAt:String(article?.seendate||''),url:safeUrl(article?.url)})).filter(article=>article.title&&article.url).slice(0,8);
async function fetchNews(fetchImpl,asset,start,end){
  for(const fallback of [false,true]){try{const response=await fetchImpl(newsUrl(asset,start,end,{fallback}),{headers:{accept:'application/json','user-agent':'QELLY-Intelligence/decision-intelligence'},signal:AbortSignal.timeout(4_000)});if(!response.ok)continue;const articles=normalizeArticles(await response.json());if(articles.length||fallback)return articles;}catch{}}
  throw new Error('News provider unavailable');
}

export function calibrateDecisionEvidence(graph,multiTimeframe,derivatives,liquidity=null,crossAsset=null){
  const base=graph.qellyView;
  const bull=finite(graph.forecast?.probabilities?.bull)??0;
  const bear=finite(graph.forecast?.probabilities?.bear)??0;
  const scenarioGap=Math.abs(bull-bear);
  const agreement=multiTimeframe?.agreement||{};
  const total=Math.max(0,Number(agreement.total)||0);
  const directional=Math.max(0,Number(agreement.directional)||0);
  const aligned=Math.max(0,Number(agreement.aligned)||0);
  const freshness=graph.truthState==='LIVE'?1:graph.truthState==='DELAYED'?0.78:graph.truthState==='STALE'?0.35:0;
  const sampleDepth=clamp((Number(graph.market?.points)||0)/240);
  const scenarioSeparation=clamp(scenarioGap/.25);
  const timeframeCoverage=clamp(total/4);
  const directionalCoverage=total?clamp(directional/total):0;
  const timeframeAgreement=total?clamp(aligned/total):0;
  const qualityScore=round(.30*freshness+.20*sampleDepth+.25*scenarioSeparation+.25*timeframeAgreement,3);
  const baseConfidence=finite(base?.confidence)??finite(graph.confidence?.score)??0;
  const calibratedConfidence=round(clamp(baseConfidence*(.7+.3*qualityScore),.2,.92),2);
  const baseAction=base?.action||'NO TRADE';
  let action=baseAction;
  const contradictions=[];
  const directionalAction=baseAction==='BUY'||baseAction==='SELL';
  if(directionalAction){
    if(directional<2||agreement.direction==='MIXED'){
      action='NO TRADE';
      contradictions.push('Independent timeframes do not provide enough directional agreement.');
    }else if(agreement.direction!==baseAction){
      action='NO TRADE';
      contradictions.push('The multi-timeframe majority points against the selected directional view.');
    }
    if(scenarioGap<.08){
      action='NO TRADE';
      contradictions.push('Bull and bear scenario probabilities are too close to support a directional view.');
    }
  }
  const atrPct=finite(graph.metrics?.atrPct);
  const volatilityRegime=String(graph?.quant?.volatility?.regime||'UNKNOWN');
  const riskLabel=volatilityRegime!=='UNKNOWN'?volatilityRegime.replaceAll('_',' ') : atrPct===null?'Unknown':atrPct>=3?'High short-term range':atrPct>=1.5?'Elevated short-term range':atrPct>=.75?'Moderate short-term range':'Lower short-term range';
  const derivativesLive=derivatives?.state==='live';
  const liquidityLive=liquidity?.state==='live';
  const crossAssetAvailable=crossAsset?.state==='available';
  const spreadBps=finite(liquidity?.spreadBps);
  const bookImbalance=finite(liquidity?.top5Imbalance);
  if(directionalAction&&liquidityLive&&spreadBps!==null&&spreadBps>15){
    action='NO TRADE';
    contradictions.push('Current verified bid/ask spread is wider than the bounded liquidity threshold.');
  }
  if(directionalAction&&liquidityLive&&bookImbalance!==null){
    const severeAgainstBuy=baseAction==='BUY'&&bookImbalance<=-.6;
    const severeAgainstSell=baseAction==='SELL'&&bookImbalance>=.6;
    if(severeAgainstBuy||severeAgainstSell){
      action='NO TRADE';
      contradictions.push('Current top-five L2 depth is severely imbalanced against the directional setup.');
    }
  }
  const calibrationState=String(graph?.quant?.calibration?.state||'UNCALIBRATED');
  const calibrationEligible=calibrationState==='CALIBRATED'&&graph?.quant?.calibration?.eligible===true;
  if(directionalAction&&!calibrationEligible){
    action='NO TRADE';
    contradictions.push(calibrationState==='WEAK_CALIBRATION'?'Directional setup is withheld because walk-forward calibration quality does not clear the Brier/reliability gate.':'Directional setup is withheld because empirical walk-forward calibration is not yet available.');
  }
  const why=[
    ...(Array.isArray(base?.why)?base.why:[]),
    total?('Multi-timeframe evidence: '+String(agreement.direction||'MIXED')+' with '+aligned+'/'+total+' observed timeframes aligned.'):'Multi-timeframe evidence is unavailable and was not inferred.',
    derivativesLive?'Current funding/open-interest context is available as risk context; it does not force direction.':'Current funding/open-interest context is unavailable and did not increase confidence.',
    liquidityLive?('Current L2 liquidity: '+String(liquidity.spreadState||'UNKNOWN')+' spread · '+String(liquidity.imbalanceState||'UNKNOWN')+' top-five depth. This is point-in-time risk context, not a directional signal.'):'Current L2 liquidity is unavailable and was not inferred.',
    crossAssetAvailable?('Cross-asset context versus '+String(crossAsset.benchmark||'benchmark')+': '+String(crossAsset.correlationState||'UNAVAILABLE')+' correlation · '+String(crossAsset.relativeState||'UNAVAILABLE')+' relative performance. It has no independent eligibility impact.'):'Cross-asset dependence is unavailable and was not inferred.'
  ];
  const downgraded=directionalAction&&action==='NO TRADE';
  const label=downgraded?'Independent evidence does not clear the directional research threshold.':base?.label;
  const changesIf=downgraded?'Reassess when fresh price evidence, scenario separation and independent timeframes align again.':base?.changesIf;
  const qellyView={
    ...base,
    action,
    confidence:calibratedConfidence,
    levels:action===baseAction?base?.levels:null,
    label,
    why,
    changesIf,
    contradictions,
    riskState:{label:riskLabel,atrPct:round(atrPct,2),volatilityRegime,expectedMovePct:round(finite(graph?.quant?.volatility?.expectedMovePct),3),structure:graph?.quant?.structure||null,liquidity:liquidityLive?{spreadState:liquidity.spreadState,spreadBps,imbalanceState:liquidity.imbalanceState,top5Imbalance:bookImbalance}:null},
    scenario:{bull,bear,base:finite(graph.forecast?.probabilities?.base)??0,gap:round(scenarioGap,4),leading:bull>bear?'BULL':bear>bull?'BEAR':'BALANCED'},
    evidenceGate:{
      baseAction,
      directionalEligible:action==='BUY'||action==='SELL',
      qualityScore,
      freshness,
      sampleDepth:round(sampleDepth,3),
      scenarioSeparation:round(scenarioSeparation,3),
      timeframeAgreement:round(timeframeAgreement,3),
      timeframeCoverage:round(timeframeCoverage,3),
      directionalCoverage:round(directionalCoverage,3),
      timeframeDirection:String(agreement.direction||'UNAVAILABLE'),
      timeframeAligned:aligned,
      timeframeTotal:total,
      derivativesCoverage:derivativesLive?'live':'unavailable',
      liquidityCoverage:liquidityLive?'live':'unavailable',
      liquiditySpreadBps:round(spreadBps,3),
      liquidityTop5Imbalance:round(bookImbalance,4),
      crossAssetCoverage:crossAssetAvailable?'available':'unavailable',
      crossAssetBenchmark:crossAssetAvailable?String(crossAsset.benchmark||''):null,
      crossAssetCorrelation:crossAssetAvailable?round(finite(crossAsset.correlation),4):null,
      quantCoverage:graph?.quant?.state==='DERIVED'?'derived':'insufficient',
      calibrationState,
      calibrationEligible
    }
  };
  const nodes=Array.isArray(graph.graph?.nodes)?graph.graph.nodes.map(node=>node.id==='decision'?{...node,label:'QELLY VIEW '+action}:node):graph.graph?.nodes;
  const textAlternative=Array.isArray(graph.graph?.edges)&&Array.isArray(nodes)?graph.graph.edges.map(edge=>{
    const from=nodes.find(node=>node.id===edge.from)?.label||edge.from;
    const to=nodes.find(node=>node.id===edge.to)?.label||edge.to;
    return from+' '+edge.type+' '+to+'.';
  }):graph.graph?.textAlternative;
  return {
    ...graph,
    qellyView,
    confidence:{
      ...graph.confidence,
      score:calibratedConfidence,
      breakdown:qellyView.evidenceGate,
      calibration:'Evidence-quality confidence combines freshness, sample depth, scenario separation and independent timeframe agreement. It is not a success probability.',
      probabilityCalibration:graph?.quant?.calibration||{state:'UNCALIBRATED',sampleSize:0,brierScore:null,reliabilityBins:[]}
    },
    graph:graph.graph?{...graph.graph,nodes,textAlternative}:graph.graph
  };
}

const timeframeSummary=(graph)=>({interval:graph.interval,truthState:graph.truthState,marketState:graph.market.currentState,metrics:{rsi14:graph.metrics.rsi14,atrPct:graph.metrics.atrPct,trendPerBarPct:graph.metrics.trendPerBarPct},probabilities:graph.forecast.probabilities,qellyView:{action:graph.qellyView.action,confidence:graph.qellyView.confidence,label:graph.qellyView.label}});
const summarizeTimeframes=(views)=>{
  const directional=views.filter(item=>item.qellyView.action==='BUY'||item.qellyView.action==='SELL');
  const buys=directional.filter(item=>item.qellyView.action==='BUY').length,sells=directional.length-buys;
  return {state:views.length>=3?'live':views.length?'partial':'unavailable',views,agreement:{direction:buys>sells?'BUY':sells>buys?'SELL':'MIXED',aligned:Math.max(buys,sells),directional:directional.length,total:views.length}};
};
async function fetchTimeframeSupport(fetchImpl,asset,endTime,selectedInterval){
  const intervals=TIMEFRAMES.filter(interval=>interval!==selectedInterval);
  const settled=await Promise.allSettled(intervals.map(async interval=>timeframeSummary(buildDecisionProvenGraph(await fetchCandles(fetchImpl,asset,interval,endTime,240),{asset,interval,horizonBars:16,now:endTime,scenarioPaths:48}))));
  return settled.filter(item=>item.status==='fulfilled').map(item=>item.value);
}
const assembleTimeframes=(selectedGraph,supportViews)=>summarizeTimeframes([timeframeSummary(selectedGraph),...(Array.isArray(supportViews)?supportViews:[]).filter(item=>item.interval!==selectedGraph.interval)]);

export async function buildDecisionIntelligence(env,{asset='BTC',interval='15m',horizon='4h',selection=null,requestedRr='auto',customRr=null,includeNews=true,now=Date.now()}={}){
  const resolvedAsset=String(asset||'BTC').toUpperCase();
  const resolvedInterval=String(interval||'15m');
  const resolvedHorizon=String(horizon||'4h');
  if(!ASSETS.has(resolvedAsset))throw new HttpError(400,'unsupported_asset','Supported assets: BTC, ETH, SOL, HYPE, XRP, DOGE');
  if(!DECISION_INTERVALS[resolvedInterval])throw new HttpError(400,'unsupported_interval','Unsupported candle interval');
  if(!HORIZONS[resolvedHorizon])throw new HttpError(400,'unsupported_horizon','Supported horizons: 1h, 4h, 12h, 1d, 3d, 7d');
  const horizonBars=Math.ceil(HORIZONS[resolvedHorizon]/DECISION_INTERVALS[resolvedInterval]);
  if(horizonBars<2||horizonBars>168)throw new HttpError(400,'incompatible_horizon','Choose a horizon at least two bars long and no more than 168 bars');
  let resolvedSelection=null;
  if(selection){
    const start=Number(selection.start),end=Number(selection.end);
    if(!Number.isFinite(start)||!Number.isFinite(end)||start>=end||end-start>90*86_400_000)throw new HttpError(400,'invalid_selection','Select a valid chart range of 90 days or less');
    resolvedSelection={start,end};
  }
  const endTime=Number(now);
  if(!Number.isFinite(endTime)||endTime<=0)throw new HttpError(400,'invalid_observation_time','Observation time is invalid');
  const fetchImpl=fetcher(env);
  const benchmarkAsset=resolvedAsset==='BTC'?'ETH':'BTC';
  const [payload,timeframeSupport,derivativesCurrent,liquidity,fundingRows,benchmarkPayload]=await Promise.all([
    fetchCandles(fetchImpl,resolvedAsset,resolvedInterval,endTime),
    fetchTimeframeSupport(fetchImpl,resolvedAsset,endTime,resolvedInterval),
    fetchDerivativesContext(fetchImpl,resolvedAsset,endTime),
    fetchLiquidityContext(fetchImpl,resolvedAsset),
    fetchFundingHistory(fetchImpl,resolvedAsset,endTime),
    fetchOptionalCandles(fetchImpl,benchmarkAsset,resolvedInterval,endTime,240)
  ]);
  const fundingHistory=buildFundingHistoryContext(fundingRows,{currentFundingRate:derivativesCurrent?.fundingRate});
  const derivatives=derivativesCurrent?.state==='live'?{
    ...derivativesCurrent,
    currentOnly:true,
    historicalFundingAttached:fundingHistory.state==='available',
    fundingHistory,
    fundingChangeBps:fundingHistory.fundingChangeBps,
    fundingPercentile:fundingHistory.fundingPercentile,
    openInterestChange:null,
    openInterestChangeState:'UNAVAILABLE',
    openInterestChangeReason:'Hyperliquid current asset context does not provide historical open-interest change in this Decision integration.'
  }:derivativesCurrent;
  const crossAsset=benchmarkPayload?buildDecisionCrossAsset(payload,benchmarkPayload,{asset:resolvedAsset,benchmark:benchmarkAsset}):{
    state:'unavailable',asset:resolvedAsset,benchmark:benchmarkAsset,sampleSize:0,correlation:null,beta:null,relativeStrengthPct:null,reason:'Benchmark candles are unavailable.'
  };
  let graph,multiTimeframe;
  try{
    graph=buildDecisionProvenGraph(payload,{asset:resolvedAsset,interval:resolvedInterval,horizonBars,now:endTime,selection:resolvedSelection,scenarioPaths:256});
    multiTimeframe=assembleTimeframes(graph,timeframeSupport);
    graph={...graph,
      quant:{...graph.quant,calibration:buildDecisionWalkForwardCalibration(payload,{interval:resolvedInterval,horizonBars})},
      historicalAnalogs:buildDecisionHistoricalAnalogs(payload,{interval:resolvedInterval,horizonBars,windowBars:100,limit:5})
    };
    graph=calibrateDecisionEvidence(graph,multiTimeframe,derivatives,liquidity,crossAsset);
  }catch(error){
    if(error instanceof HttpError)throw error;
    throw new HttpError(503,'insufficient_provider_data',error.message,{retryable:true});
  }
  const newsStart=resolvedSelection?.start??endTime-24*3_600_000;
  const newsEnd=Math.min(resolvedSelection?.end??endTime,endTime);
  let articles=[],newsState=includeNews?'unavailable':'not-requested';
  if(includeNews){try{articles=await fetchNews(fetchImpl,resolvedAsset,newsStart,newsEnd);newsState=articles.length?'live':'no-matches';}catch{}}
  const macro={
    state:'unavailable',
    level:'UNAVAILABLE',
    provider:null,
    intradayFeedConnected:false,
    reason:'No current intraday DXY, sovereign-yield, policy-rate or liquidity feed is connected to this Decision view.',
    cadenceBoundary:'Slow or delayed macro references used elsewhere in QELLY are intentionally excluded from intraday trade eligibility.'
  };
  const eventRisk={
    state:'unavailable',
    level:'UNAVAILABLE',
    provider:null,
    scheduledFeedConnected:false,
    reason:'No verified scheduled-event calendar is connected to this Decision view. Recent news is evidence only and is not converted into a scheduled event-risk score.'
  };
  graph={...graph,liquidity,eventRisk,derivatives,crossAsset,macro};
  const tradeResearch=buildTradeResearch(graph,{requestedRr,customRr});
  return {...graph,horizon:resolvedHorizon,multiTimeframe,tradeResearch,evidence:{
    news:{state:newsState,provider:includeNews?'GDELT':null,articles},
    derivatives,
    liquidity,
    crossAsset,
    macro,
    eventRisk,
    liquidations:{state:'unavailable',message:'Verified liquidation evidence is not available for this view, so it is not inferred.'},
    options:{state:'unavailable',message:'Verified options-market evidence is not connected to this Decision view, so it is not inferred.'},
    onChain:{state:'unavailable',message:'Authorized on-chain evidence is not connected to this Decision view, so it is not inferred.'}
  }};
}

export async function onRequest({request,env}){
  try{
    if(request.method!=='GET')throw new HttpError(405,'method_not_allowed','Use GET for public Decision Intelligence');
    await enforceRateLimit(env,'decision-proven-graph:'+ip(request),{limit:30,windowMs:60_000});
    const url=new URL(request.url);
    const selectionStart=Number(url.searchParams.get('selectionStart')),selectionEnd=Number(url.searchParams.get('selectionEnd'));
    const selection=url.searchParams.has('selectionStart')||url.searchParams.has('selectionEnd')?{start:selectionStart,end:selectionEnd}:null;
    const result=await buildDecisionIntelligence(env,{
      asset:url.searchParams.get('asset')||'BTC',
      interval:url.searchParams.get('interval')||'15m',
      horizon:url.searchParams.get('horizon')||'4h',
      requestedRr:url.searchParams.get('rr')||'auto',
      customRr:url.searchParams.get('customRr'),
      selection
    });
    return responseJson(request,env,result,200,{cache:'public, max-age=10, stale-while-revalidate=30'});
  }catch(error){return errorResponse(request,env,error);}
}
