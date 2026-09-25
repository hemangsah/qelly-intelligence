import {buildDecisionProvenGraph,buildDecisionWalkForwardCalibration,DECISION_INTERVALS} from '../../_lib/decision-proven-graph.js';
import {buildTradeResearch} from '../../_lib/decision-trade-research.js';
import {buildDecisionHistoricalAnalogs} from '../../_lib/decision-historical-analogs.js';
import {normalizeDecisionLiquidity} from '../../_lib/decision-liquidity.js';
import {buildFundingHistoryContext,buildDerivativesPositioningState} from '../../_lib/decision-derivatives.js';
import {buildDecisionCrossAsset} from '../../_lib/decision-cross-asset.js';
import {buildDecisionNewsClusters} from '../../_lib/decision-news.js';
import {buildDecisionMacroContext,buildUnavailableDecisionEventRisk} from '../../_lib/decision-macro-events.js';
import {providerResult} from '../../_lib/providers.js';
import {buildDecisionContextBundle} from '../../_lib/decision-context.js';
import {HttpError,enforceRateLimit,errorResponse,fetcher,responseJson} from '../../_lib/runtime.js';
import {createDecisionLatencyTrace,estimateSerializedPayload} from '../../_lib/decision-latency.js';
import {resilientJsonRequest,providerFailureHealth,providerResiliencePublicSummary} from '../../_lib/decision-provider-resilience.js';

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
const finite=(value)=>{if(value==null||value==='')return null;const number=Number(value);return Number.isFinite(number)?number:null;};
const round=(value,digits=6)=>Number.isFinite(value)?Number(value.toFixed(digits)):null;
const clamp=(value,min=0,max=1)=>Math.min(max,Math.max(min,value));

async function fetchCandles(fetchImpl,asset,interval,endTime,points=500){
  const {data}=await resilientJsonRequest(fetchImpl,HYPERLIQUID_INFO_URL,{
    policyKey:'hyperliquidCandles',
    init:{method:'POST',headers:{'content-type':'application/json','user-agent':'QELLY-Intelligence/decision-intelligence'},body:JSON.stringify({type:'candleSnapshot',req:{coin:asset,interval,startTime:endTime-DECISION_INTERVALS[interval]*points,endTime}})}
  });
  return data;
}

async function fetchOptionalCandles(fetchImpl,asset,interval,endTime,points=240){
  try{return await fetchCandles(fetchImpl,asset,interval,endTime,points);}catch{return null;}
}

async function fetchFundingHistory(fetchImpl,asset,endTime){
  try{
    const {data}=await resilientJsonRequest(fetchImpl,HYPERLIQUID_INFO_URL,{
      policyKey:'hyperliquidFunding',
      init:{
        method:'POST',
        headers:{'content-type':'application/json','user-agent':'QELLY-Intelligence/decision-intelligence'},
        body:JSON.stringify({type:'fundingHistory',coin:asset,startTime:endTime-72*3_600_000,endTime})
      }
    });
    return Array.isArray(data)?data:[];
  }catch{return [];}
}

async function fetchLiquidityContext(fetchImpl,asset){
  const unavailable=(reason='Current L2 liquidity context is unavailable, so spread and book imbalance are not inferred.',resilience=null)=>({
    state:'unavailable',
    provider:'Hyperliquid',
    documentation:HYPERLIQUID_L2_DOCS,
    asset,
    currentOnly:true,
    reason,
    spreadState:'UNAVAILABLE',
    imbalanceState:'UNAVAILABLE',
    depthConsensus:'UNAVAILABLE',
    spreadBps:null,
    microprice:null,
    micropriceBiasBps:null,
    top1BidDepthUsd:null,
    top1AskDepthUsd:null,
    top1Imbalance:null,
    top5BidDepthUsd:null,
    top5AskDepthUsd:null,
    top5Imbalance:null,
    top10BidDepthUsd:null,
    top10AskDepthUsd:null,
    top10Imbalance:null,
    resilience
  });
  try{
    const {data,health}=await resilientJsonRequest(fetchImpl,HYPERLIQUID_INFO_URL,{
      policyKey:'hyperliquidLiquidity',
      init:{
        method:'POST',
        headers:{'content-type':'application/json','user-agent':'QELLY-Intelligence/decision-intelligence'},
        body:JSON.stringify({type:'l2Book',coin:asset})
      }
    });
    const normalized=normalizeDecisionLiquidity(data,{asset,provider:'Hyperliquid'});
    return {...normalized,documentation:HYPERLIQUID_L2_DOCS,resilience:health};
  }catch(error){
    return unavailable(undefined,providerFailureHealth(error,'hyperliquidLiquidity'));
  }
}

async function fetchDerivativesContext(fetchImpl,asset,observedAt){
  const unavailable=(message='Current funding and open-interest context is unavailable, so it is not inferred.',resilience=null)=>({state:'unavailable',provider:'Hyperliquid',documentation:HYPERLIQUID_PERP_DOCS,currentOnly:true,message,resilience});
  try{
    const {data:payload,health}=await resilientJsonRequest(fetchImpl,HYPERLIQUID_INFO_URL,{
      policyKey:'hyperliquidDerivatives',
      init:{
        method:'POST',
        headers:{'content-type':'application/json','user-agent':'QELLY-Intelligence/decision-intelligence'},
        body:JSON.stringify({type:'metaAndAssetCtxs'})
      }
    });
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
    const prevDayPrice=finite(context.prevDayPx);
    if([fundingRate,openInterest,markPrice,oraclePrice,dayNotionalVolumeUsd,premium,prevDayPrice].every(value=>value===null))return unavailable();
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
      prevDayPrice:round(prevDayPrice,6),
      priceChange24hPct:markPrice===null||prevDayPrice===null||prevDayPrice===0?null:round((markPrice/prevDayPrice-1)*100,4),
      oraclePrice:round(oraclePrice,6),
      markOracleBasisPct:markPrice===null||oraclePrice===null||oraclePrice===0?null:round((markPrice/oraclePrice-1)*100,6),
      markOracleBasisBps:markPrice===null||oraclePrice===null||oraclePrice===0?null:round((markPrice/oraclePrice-1)*10_000,4),
      dayNotionalVolumeUsd:round(dayNotionalVolumeUsd,2),
      premiumRate:round(premium,10),
      premiumPct:premium===null?null:round(premium*100,6),
      premiumBps:premium===null?null:round(premium*10_000,4),
      resilience:health,
      message:'Current Hyperliquid perpetual context. It is not backfilled into a selected historical move or treated as causal evidence.'
    };
  }catch(error){
    return unavailable(undefined,providerFailureHealth(error,'hyperliquidDerivatives'));
  }
}

const newsUrl=(asset,start,end,{fallback=false}={})=>{const url=new URL('https://api.gdeltproject.org/api/v2/doc/doc');url.searchParams.set('query','('+NEWS_TERMS[asset]+') sourcelang:english');url.searchParams.set('mode','artlist');url.searchParams.set('format','json');url.searchParams.set('maxrecords','12');url.searchParams.set('sort','HybridRel');if(fallback)url.searchParams.set('timespan','3days');else{url.searchParams.set('startdatetime',gdeltTime(Math.max(end-72*3_600_000,start)));url.searchParams.set('enddatetime',gdeltTime(end));}return url.href;};
const normalizeArticles=(payload)=>(Array.isArray(payload?.articles)?payload.articles:[]).map(article=>({title:String(article?.title||'').trim().slice(0,240),source:String(article?.domain||'').trim().slice(0,100),publishedAt:String(article?.seendate||''),url:safeUrl(article?.url)})).filter(article=>article.title&&article.url).slice(0,8);
const NEWS_TIMEOUT_MS=2_500;
const NEWS_CACHE_FRESH_MS=5*60_000;
const NEWS_CACHE_STALE_MS=30*60_000;
const NEWS_CACHE_BUCKET_MS=5*60_000;
const NEWS_INFLIGHT=new Map();

const normalizedNewsWindow=(start,end,bucketMs=NEWS_CACHE_BUCKET_MS)=>{
  const rawStart=Number(start),rawEnd=Number(end),bucket=Number(bucketMs);
  if(!Number.isFinite(rawStart)||!Number.isFinite(rawEnd)||rawStart>=rawEnd)return {start:rawStart,end:rawEnd,bucketMs:0};
  if(!(bucket>0))return {start:rawStart,end:rawEnd,bucketMs:0};
  const normalizedStart=Math.floor(rawStart/bucket)*bucket;
  const normalizedEnd=Math.floor(rawEnd/bucket)*bucket;
  return {start:normalizedStart,end:Math.max(normalizedStart+1,normalizedEnd),bucketMs:bucket};
};
const newsCacheRequest=(asset,start,end,bucketMs=NEWS_CACHE_BUCKET_MS)=>{
  const window=normalizedNewsWindow(start,end,bucketMs);
  const url=new URL('https://qelly-news-cache.invalid/context');
  url.searchParams.set('asset',String(asset||'').toUpperCase());
  url.searchParams.set('start',String(window.start));
  url.searchParams.set('end',String(window.end));
  return {request:new Request(url.href),window};
};
const readNewsCache=async(cache,key,now)=>{
  if(!cache)return {fresh:null,stale:null};
  try{
    const response=await cache.match(key);
    if(!response)return {fresh:null,stale:null};
    const value=await response.json();
    const fetchedAt=Date.parse(value?.fetchedAt||'');
    if(!Number.isFinite(fetchedAt)||!Array.isArray(value?.articles))return {fresh:null,stale:null};
    const ageMs=Math.max(0,Number(now)-fetchedAt);
    const normalized={articles:value.articles.slice(0,8),state:value.state==='no-matches'?'no-matches':'live',fetchedAt:new Date(fetchedAt).toISOString(),ageMs};
    if(ageMs<=NEWS_CACHE_FRESH_MS)return {fresh:normalized,stale:null};
    if(ageMs<=NEWS_CACHE_STALE_MS)return {fresh:null,stale:normalized};
  }catch{}
  return {fresh:null,stale:null};
};
const writeNewsCache=async(cache,key,value)=>{
  if(!cache)return;
  try{
    await cache.put(key,new Response(JSON.stringify(value),{headers:{'content-type':'application/json','cache-control':'public, max-age=1800'}}));
  }catch{}
};

async function fetchNewsAttempt(fetchImpl,asset,start,end,{fallback=false}={}){
  const response=await fetchImpl(newsUrl(asset,start,end,{fallback}),{
    headers:{accept:'application/json','user-agent':'QELLY-Intelligence/decision-intelligence'},
    signal:AbortSignal.timeout(NEWS_TIMEOUT_MS)
  });
  if(!response.ok)throw new Error('News provider unavailable');
  return normalizeArticles(await response.json());
}
async function fetchNews(fetchImpl,asset,start,end){
  const primary=await fetchNewsAttempt(fetchImpl,asset,start,end);
  if(primary.length)return primary;
  return fetchNewsAttempt(fetchImpl,asset,start,end,{fallback:true});
}

export async function fetchNewsContext(fetchImpl,asset,start,end,{cache=globalThis.caches?.default,now=Date.now(),bucketMs=NEWS_CACHE_BUCKET_MS,cacheOnly=false}={}){
  const {request:key,window}=newsCacheRequest(asset,start,end,bucketMs);
  const cached=await readNewsCache(cache,key,now);
  if(cached.fresh)return {
    articles:cached.fresh.articles,
    state:'cached',
    fetchedAt:cached.fresh.fetchedAt,
    cache:{hit:true,stale:false,coalesced:false,ageMs:cached.fresh.ageMs,bucketMs:window.bucketMs,sourceState:cached.fresh.state}
  };
  if(cacheOnly)return {
    articles:[],
    state:'pending',
    fetchedAt:null,
    cache:{hit:false,stale:false,coalesced:false,ageMs:null,bucketMs:window.bucketMs,staleAvailable:Boolean(cached.stale)},
    fallbackReason:null
  };

  const inflightKey=key.url;
  const existing=NEWS_INFLIGHT.get(inflightKey);
  if(existing){
    const result=await existing;
    return {...result,cache:{...result.cache,coalesced:true}};
  }

  const task=(async()=>{
    try{
      const articles=await fetchNews(fetchImpl,asset,window.start,window.end);
      const fetchedAt=new Date(Number(now)).toISOString();
      const state=articles.length?'live':'no-matches';
      await writeNewsCache(cache,key,{articles,state,fetchedAt});
      return {articles,state,fetchedAt,cache:{hit:false,stale:false,coalesced:false,ageMs:0,bucketMs:window.bucketMs}};
    }catch(error){
      if(cached.stale)return {
        articles:cached.stale.articles,
        state:'stale',
        fetchedAt:cached.stale.fetchedAt,
        cache:{hit:true,stale:true,coalesced:false,ageMs:cached.stale.ageMs,bucketMs:window.bucketMs},
        fallbackReason:'news_provider_unavailable_using_stale_cache'
      };
      throw error;
    }
  })();

  NEWS_INFLIGHT.set(inflightKey,task);
  try{return await task;}
  finally{if(NEWS_INFLIGHT.get(inflightKey)===task)NEWS_INFLIGHT.delete(inflightKey);}
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
  const timeframeEvidence=round(timeframeAgreement*timeframeCoverage,3);
  const confidenceWeights=Object.freeze({freshness:.30,sampleDepth:.20,scenarioSeparation:.25,timeframeEvidence:.25});
  const contributions={
    freshness:round(confidenceWeights.freshness*freshness,4),
    sampleDepth:round(confidenceWeights.sampleDepth*sampleDepth,4),
    scenarioSeparation:round(confidenceWeights.scenarioSeparation*scenarioSeparation,4),
    timeframeEvidence:round(confidenceWeights.timeframeEvidence*timeframeEvidence,4)
  };
  const qualityScore=round(contributions.freshness+contributions.sampleDepth+contributions.scenarioSeparation+contributions.timeframeEvidence,3);
  const preliminaryModelConfidence=finite(base?.confidence)??finite(graph.confidence?.score)??0;
  const evidenceConfidence=round(clamp(qualityScore,0,1),2);
  const confidenceDecomposition={
    schemaVersion:'qelly.decision-evidence-confidence/1.0.0',
    score:evidenceConfidence,
    qualityScore,
    weights:confidenceWeights,
    components:{
      freshness:{score:round(freshness,3),weight:confidenceWeights.freshness,contribution:contributions.freshness},
      sampleDepth:{score:round(sampleDepth,3),weight:confidenceWeights.sampleDepth,contribution:contributions.sampleDepth},
      scenarioSeparation:{score:round(scenarioSeparation,3),weight:confidenceWeights.scenarioSeparation,contribution:contributions.scenarioSeparation},
      timeframeEvidence:{
        score:timeframeEvidence,weight:confidenceWeights.timeframeEvidence,contribution:contributions.timeframeEvidence,
        agreement:round(timeframeAgreement,3),coverage:round(timeframeCoverage,3)
      }
    },
    preliminaryModelConfidence:round(preliminaryModelConfidence,3),
    preliminaryModelConfidenceReused:false,
    primitiveReuse:false,
    boundary:'Evidence confidence is a weighted evidence-quality score, not a success probability. Freshness, sample depth, scenario separation and coverage-adjusted multi-timeframe agreement each enter the final score exactly once.'
  };
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
  const structure=graph?.quant?.structure||null;
  const structuralBias=String(structure?.bias||'MIXED');
  const structuralStrength=String(structure?.strengthState||'UNAVAILABLE');
  const strongStructureAgainstBuy=baseAction==='BUY'&&structuralStrength==='STRONG'&&structuralBias==='DOWNSIDE';
  const strongStructureAgainstSell=baseAction==='SELL'&&structuralStrength==='STRONG'&&structuralBias==='UPSIDE';
  if(directionalAction&&(strongStructureAgainstBuy||strongStructureAgainstSell)){
    action='NO TRADE';
    contradictions.push('Strong observed market structure conflicts with the directional setup.');
  }
  const spreadBps=finite(liquidity?.spreadBps);
  const bookImbalance=finite(liquidity?.top5Imbalance);
  const bookImbalance10=finite(liquidity?.top10Imbalance);
  const micropriceBiasBps=finite(liquidity?.micropriceBiasBps);
  const liquidityConsensus=String(liquidity?.depthConsensus||'UNAVAILABLE');
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
    liquidityLive?('Current L2 liquidity: '+String(liquidity.spreadState||'UNKNOWN')+' spread · '+String(liquidityConsensus).replaceAll('_',' ')+' multi-depth state · microprice bias '+(micropriceBiasBps===null?'unavailable':round(micropriceBiasBps,2)+' bps')+'. This is point-in-time risk context, not a directional signal.'):'Current L2 liquidity is unavailable and was not inferred.',
    crossAssetAvailable?('Cross-asset context versus '+String(crossAsset.benchmark||'benchmark')+': '+String(crossAsset.correlationState||'UNAVAILABLE')+' correlation · '+String(crossAsset.relativeState||'UNAVAILABLE')+' relative performance. It has no independent eligibility impact.'):'Cross-asset dependence is unavailable and was not inferred.'
  ];
  const downgraded=directionalAction&&action==='NO TRADE';
  const label=downgraded?'Independent evidence does not clear the directional research threshold.':base?.label;
  const changesIf=downgraded?'Reassess when fresh price evidence, scenario separation and independent timeframes align again.':base?.changesIf;
  const qellyView={
    ...base,
    action,
    confidence:evidenceConfidence,
    levels:action===baseAction?base?.levels:null,
    label,
    why,
    changesIf,
    contradictions,
    riskState:{label:riskLabel,atrPct:round(atrPct,2),volatilityRegime,expectedMovePct:round(finite(graph?.quant?.volatility?.expectedMovePct),3),structure,liquidity:liquidityLive?{spreadState:liquidity.spreadState,spreadBps,imbalanceState:liquidity.imbalanceState,top5Imbalance:bookImbalance,top10Imbalance:bookImbalance10,depthConsensus:liquidityConsensus,micropriceBiasBps}:null},
    scenario:{bull,bear,base:finite(graph.forecast?.probabilities?.base)??0,gap:round(scenarioGap,4),leading:bull>bear?'BULL':bear>bull?'BEAR':'BALANCED'},
    evidenceGate:{
      baseAction,
      directionalEligible:action==='BUY'||action==='SELL',
      qualityScore,
      confidenceSchemaVersion:confidenceDecomposition.schemaVersion,
      confidencePrimitiveReuse:false,
      preliminaryModelConfidence:round(preliminaryModelConfidence,3),
      preliminaryModelConfidenceReused:false,
      confidenceWeights,
      freshness,
      sampleDepth:round(sampleDepth,3),
      scenarioSeparation:round(scenarioSeparation,3),
      timeframeAgreement:round(timeframeAgreement,3),
      timeframeEvidence,
      timeframeCoverage:round(timeframeCoverage,3),
      directionalCoverage:round(directionalCoverage,3),
      timeframeDirection:String(agreement.direction||'UNAVAILABLE'),
      timeframeAligned:aligned,
      timeframeTotal:total,
      derivativesCoverage:derivativesLive?'live':'unavailable',
      liquidityCoverage:liquidityLive?'live':'unavailable',
      liquiditySpreadBps:round(spreadBps,3),
      liquidityTop5Imbalance:round(bookImbalance,4),
      liquidityTop10Imbalance:round(bookImbalance10,4),
      liquidityDepthConsensus:liquidityConsensus,
      liquidityMicropriceBiasBps:round(micropriceBiasBps,3),
      structureBias:structuralBias,
      structureStrength:structuralStrength,
      structureRetest:String(structure?.retestState||'NONE'),
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
      score:evidenceConfidence,
      breakdown:qellyView.evidenceGate,
      decomposition:confidenceDecomposition,
      calibration:'Evidence confidence is one weighted evidence-quality decomposition: freshness 30%, sample depth 20%, scenario separation 25% and coverage-adjusted multi-timeframe agreement 25%. Each primitive enters once. It is not a success probability.',
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
  const latency=createDecisionLatencyTrace();
  const benchmarkAsset=resolvedAsset==='BTC'?'ETH':'BTC';
  const newsStart=resolvedSelection?.start??endTime-24*3_600_000;
  const newsEnd=Math.min(resolvedSelection?.end??endTime,endTime);
  const newsPromise=includeNews
    ? latency.time('news',()=>fetchNewsContext(fetchImpl,resolvedAsset,newsStart,newsEnd,{bucketMs:resolvedSelection?0:NEWS_CACHE_BUCKET_MS,cacheOnly:true})
        .catch(()=>({articles:[],state:'unavailable',fetchedAt:null,cache:{hit:false,stale:false,coalesced:false,ageMs:null,bucketMs:resolvedSelection?0:NEWS_CACHE_BUCKET_MS}})))
    : Promise.resolve({articles:[],state:'not-requested',fetchedAt:null,cache:{hit:false,stale:false,coalesced:false,ageMs:null,bucketMs:0}});
  const macroPromise=latency.time('macro',()=>providerResult({env},'ecb','fx-reference-rates','EUR')
    .then(buildDecisionMacroContext)
    .catch(error=>buildDecisionMacroContext({truthState:'unavailable',fallbackReason:error?.code||'ecb_reference_unavailable'})));
  // Resolve the mandatory selected-asset history first so optional Hyperliquid
  // evidence calls cannot consume the provider burst budget ahead of the core input.
  // News uses a separate provider and runs concurrently with the core Decision path.
  const candleFetchSpan=latency.span('candleFetch');
  const payload=await fetchCandles(fetchImpl,resolvedAsset,resolvedInterval,endTime);
  candleFetchSpan();
  const [timeframeSupport,derivativesCurrent,liquidity,fundingRows,benchmarkPayload]=await Promise.all([
    latency.time('multiTimeframe',()=>fetchTimeframeSupport(fetchImpl,resolvedAsset,endTime,resolvedInterval)),
    latency.time('derivatives',()=>fetchDerivativesContext(fetchImpl,resolvedAsset,endTime)),
    latency.time('liquidity',()=>fetchLiquidityContext(fetchImpl,resolvedAsset)),
    latency.time('fundingHistory',()=>fetchFundingHistory(fetchImpl,resolvedAsset,endTime)),
    latency.time('crossAssetBenchmark',()=>fetchOptionalCandles(fetchImpl,benchmarkAsset,resolvedInterval,endTime,240))
  ]);
  const fundingHistory=latency.measure('derivativesCompute',()=>buildFundingHistoryContext(fundingRows,{currentFundingRate:derivativesCurrent?.fundingRate,currentPremium:derivativesCurrent?.premiumRate}));
  const oiNotional=finite(derivativesCurrent?.openInterestNotionalUsd);
  const dayVolume=finite(derivativesCurrent?.dayNotionalVolumeUsd);
  const markOracleBasisBps=finite(derivativesCurrent?.markOracleBasisBps);
  const positioning=buildDerivativesPositioningState({
    priceChangePct:derivativesCurrent?.priceChange24hPct,
    openInterestChangePct:null,
    fundingState:fundingHistory.fundingState,
    basisState:markOracleBasisBps===null?'UNAVAILABLE':markOracleBasisBps>.5?'MARK_PREMIUM':markOracleBasisBps<-.5?'MARK_DISCOUNT':'NEAR_ORACLE'
  });
  const derivatives=derivativesCurrent?.state==='live'?{
    ...derivativesCurrent,
    currentOnly:true,
    historicalFundingAttached:fundingHistory.state==='available',
    historicalPremiumAttached:fundingHistory.state==='available'&&Number(fundingHistory.premiumSampleSize)>0,
    fundingHistory,
    fundingChangeBps:fundingHistory.fundingChangeBps,
    fundingPercentile:fundingHistory.fundingPercentile,
    fundingState:fundingHistory.fundingState,
    fundingShiftState:fundingHistory.fundingShiftState,
    premiumChangeBps:fundingHistory.premiumChangeBps,
    premiumPercentile:fundingHistory.premiumPercentile,
    premiumState:fundingHistory.premiumState,
    premiumShiftState:fundingHistory.premiumShiftState,
    openInterestTurnover24h:oiNotional!==null&&oiNotional>0&&dayVolume!==null?round(dayVolume/oiNotional,4):null,
    markOracleBasisState:markOracleBasisBps===null?'UNAVAILABLE':markOracleBasisBps>.5?'MARK_PREMIUM':markOracleBasisBps<-.5?'MARK_DISCOUNT':'NEAR_ORACLE',
    markOracleBasisChange:null,
    markOracleBasisChangeState:'UNAVAILABLE',
    markOracleBasisChangeReason:'Historical mark/oracle observations are not connected; premium history is not substituted for basis history.',
    openInterestChange:null,
    openInterestChangePct:null,
    openInterestChangeState:'UNAVAILABLE',
    openInterestChangeReason:'Hyperliquid current asset context does not provide historical open-interest change in this Decision integration.',
    positioning,
    positioningState:positioning.state,
    positioningAvailable:positioning.available,
    priceOpenInterestQuadrant:'UNAVAILABLE',
    priceOpenInterestQuadrantReason:'Price/OI quadrant interpretation requires a verified open-interest change series, which is unavailable. The governed positioning classifier remains '+positioning.state+'.',
    liquidationsState:'UNAVAILABLE',
    liquidationsReason:'A verified liquidation-flow source is not connected to this Decision integration.'
  }:derivativesCurrent;
  const crossAsset=latency.measure('crossAssetCompute',()=>benchmarkPayload?buildDecisionCrossAsset(payload,benchmarkPayload,{asset:resolvedAsset,benchmark:benchmarkAsset}):{
    state:'unavailable',asset:resolvedAsset,benchmark:benchmarkAsset,sampleSize:0,correlation:null,beta:null,relativeStrengthPct:null,reason:'Benchmark candles are unavailable.'
  });
  const selectedAssetRows=resolvedSelection?(Array.isArray(payload)?payload:[]).filter(item=>{
    const time=finite(item?.t??item?.time);
    return time!==null&&time>=resolvedSelection.start&&time<=resolvedSelection.end;
  }):[];
  const selectedBenchmarkRows=resolvedSelection?(Array.isArray(benchmarkPayload)?benchmarkPayload:[]).filter(item=>{
    const time=finite(item?.t??item?.time);
    return time!==null&&time>=resolvedSelection.start&&time<=resolvedSelection.end;
  }):[];
  const selectedCrossAsset=resolvedSelection&&selectedAssetRows.length&&selectedBenchmarkRows.length
    ?buildDecisionCrossAsset(selectedAssetRows,selectedBenchmarkRows,{asset:resolvedAsset,benchmark:benchmarkAsset})
    :{state:'unavailable',asset:resolvedAsset,benchmark:benchmarkAsset,reason:resolvedSelection?'Not enough aligned benchmark observations inside the selected move.':'No chart range selected.'};
  const selectedFundingRows=resolvedSelection?(Array.isArray(fundingRows)?fundingRows:[]).filter(item=>{
    const time=finite(item?.time);
    return time!==null&&time>=resolvedSelection.start&&time<=resolvedSelection.end;
  }):[];
  const selectedFundingHistory=resolvedSelection?buildFundingHistoryContext(selectedFundingRows,{}):null;
  const historicalDerivatives=resolvedSelection
    ?selectedFundingHistory?.state==='available'
      ?{
          state:'available',
          provider:'Hyperliquid settled funding history',
          fundingHistory:selectedFundingHistory,
          historicalOpenInterestState:'UNAVAILABLE',
          basisHistoryState:'UNAVAILABLE',
          liquidationsState:'UNAVAILABLE',
          boundary:'Only settled funding/premium observations inside the selected range are attached. Historical open interest, mark/oracle basis and liquidations are not inferred.'
        }
      :{
          state:'unavailable',
          provider:'Hyperliquid settled funding history',
          fundingHistory:selectedFundingHistory,
          historicalOpenInterestState:'UNAVAILABLE',
          basisHistoryState:'UNAVAILABLE',
          liquidationsState:'UNAVAILABLE',
          boundary:'No settled funding observations overlap the selected range; historical derivatives are not backfilled or inferred.'
        }
    :{state:'not_selected',provider:null,boundary:'Select a chart range before historical derivatives are evaluated.'};
  let graph,multiTimeframe;
  const quantCalibrationAnalogsSpan=latency.span('quantCalibrationAnalogs');
  try{
    graph=buildDecisionProvenGraph(payload,{asset:resolvedAsset,interval:resolvedInterval,horizonBars,now:endTime,selection:resolvedSelection,scenarioPaths:256});
    multiTimeframe=assembleTimeframes(graph,timeframeSupport);
    graph={...graph,
      quant:{...graph.quant,calibration:buildDecisionWalkForwardCalibration(payload,{interval:resolvedInterval,horizonBars})},
      historicalAnalogs:buildDecisionHistoricalAnalogs(payload,{interval:resolvedInterval,horizonBars,windowBars:100,limit:5})
    };
    graph=calibrateDecisionEvidence(graph,multiTimeframe,derivatives,liquidity,crossAsset);
    quantCalibrationAnalogsSpan();
  }catch(error){
    quantCalibrationAnalogsSpan('error');
    if(error instanceof HttpError)throw error;
    throw new HttpError(503,'insufficient_provider_data',error.message,{retryable:true});
  }
  const {articles,state:newsState}=await newsPromise;
  const {fetchedAt:newsObservedAt,cache:newsCache,fallbackReason:newsFallbackReason}=await newsPromise;
  const newsClusters=buildDecisionNewsClusters(articles,{asset:resolvedAsset});
  const macroReference=await macroPromise;
  const macro={
    ...macroReference,
    intradayFeedConnected:false,
    legacyCadenceBoundary:'Slow or delayed macro references used elsewhere in QELLY are intentionally excluded from intraday trade eligibility.'
  };
  const eventRisk={
    ...buildUnavailableDecisionEventRisk(),
    scheduledFeedConnected:false,
    legacyNewsBoundary:'Recent news is evidence only and is not converted into a scheduled event-risk score.'
  };
  graph={...graph,liquidity,eventRisk,derivatives,crossAsset,macro};
  const tradeResearch=latency.measure('riskRewardResearch',()=>buildTradeResearch(graph,{requestedRr,customRr}));
  const evidence={
    news:{state:newsState,provider:includeNews?'GDELT':null,articles},
    derivatives,
    liquidity,
    crossAsset,
    selectedCrossAsset,
    macro,
    eventRisk,
    historicalDerivatives,
    liquidations:{state:'unavailable',message:'Verified liquidation evidence is not available for this view, so it is not inferred.'},
    options:{state:'unavailable',message:'Verified options-market evidence is not connected to this Decision view, so it is not inferred.'},
    onChain:{state:'unavailable',message:'Authorized on-chain evidence is not connected to this Decision view, so it is not inferred.'}
  };
  const newsEnrichmentUrl=newsState==='pending'
    ?'/api/v1/decision-news-context?'+new URLSearchParams({asset:resolvedAsset,start:String(newsStart),end:String(newsEnd),...(resolvedSelection?{exact:'1'}:{})}).toString()
    :null;
  evidence.news={...evidence.news,clusters:newsClusters.clusters,clustering:newsClusters,observedAt:newsObservedAt??null,cache:newsCache??null,fallbackReason:newsFallbackReason??null,
    enrichment:newsEnrichmentUrl?{state:'pending',url:newsEnrichmentUrl,eligibilityImpact:'none'}:null,
    boundary:newsState==='pending'
      ?'Full news context is pending a separate bounded enrichment request. The QELLY VIEW is already final for this snapshot because news is contextual and has no eligibility impact.'
      :'News is contextual evidence only. A bounded fresh cache may be reused; stale news is used only after provider failure and is labeled stale. Headline clusters are deterministic lexical audit metadata and have no eligibility impact.'
  };
  const providerResilience=providerResiliencePublicSummary({liquidity,derivatives,news:evidence.news,macro});
  const context=latency.measure('contextAndEvidenceGraph',()=>buildDecisionContextBundle(graph,{multiTimeframe,tradeResearch,evidence,horizon:resolvedHorizon}));
  const performance=latency.snapshot({database:{used:false,ms:null},network:'Measure end-to-end separately at the client or external probe; server-side component timings exclude internet transit.'});
  return {...graph,horizon:resolvedHorizon,multiTimeframe,tradeResearch,evidence,providerResilience,...context,performance};
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
    const serialization=estimateSerializedPayload(result);
    result.performance={...result.performance,serializationEstimateMs:serialization.serializationMs,responseBytesEstimate:serialization.responseBytes};
    return responseJson(request,env,result,200,{cache:'public, max-age=10, stale-while-revalidate=30'});
  }catch(error){return errorResponse(request,env,error);}
}

export const __decisionNewsLatencyTest=Object.freeze({
  NEWS_TIMEOUT_MS,NEWS_CACHE_FRESH_MS,NEWS_CACHE_STALE_MS,NEWS_CACHE_BUCKET_MS,
  fetchNewsAttempt,fetchNews,fetchNewsContext,newsUrl,normalizeArticles,normalizedNewsWindow,newsCacheRequest,readNewsCache
});
