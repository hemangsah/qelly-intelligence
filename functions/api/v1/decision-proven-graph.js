import {buildDecisionProvenGraph,DECISION_INTERVALS} from '../../_lib/decision-proven-graph.js';
import {HttpError,enforceRateLimit,errorResponse,fetcher,responseJson} from '../../_lib/runtime.js';

const ASSETS=new Set(['BTC','ETH','SOL','HYPE','XRP','DOGE']);
const HORIZONS=Object.freeze({'1h':3_600_000,'4h':14_400_000,'12h':43_200_000,'1d':86_400_000,'3d':259_200_000,'7d':604_800_000});
const TIMEFRAMES=Object.freeze(['15m','1h','4h','1d']);
const NEWS_TERMS=Object.freeze({BTC:'Bitcoin OR BTC',ETH:'Ethereum OR Ether',SOL:'Solana',HYPE:'Hyperliquid',XRP:'XRP OR Ripple',DOGE:'Dogecoin OR DOGE'});
const HYPERLIQUID_INFO_URL='https://api.hyperliquid.xyz/info';
const HYPERLIQUID_PERP_DOCS='https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/info-endpoint/perpetuals';
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

export function calibrateDecisionEvidence(graph,multiTimeframe,derivatives){
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
  const riskLabel=atrPct===null?'Unknown':atrPct>=3?'High short-term range':atrPct>=1.5?'Elevated short-term range':atrPct>=.75?'Moderate short-term range':'Lower short-term range';
  const derivativesLive=derivatives?.state==='live';
  const why=[
    ...(Array.isArray(base?.why)?base.why:[]),
    total?('Multi-timeframe evidence: '+String(agreement.direction||'MIXED')+' with '+aligned+'/'+total+' observed timeframes aligned.'):'Multi-timeframe evidence is unavailable and was not inferred.',
    derivativesLive?'Current funding/open-interest context is available as risk context; it does not force direction.':'Current funding/open-interest context is unavailable and did not increase confidence.'
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
    riskState:{label:riskLabel,atrPct:round(atrPct,2)},
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
      derivativesCoverage:derivativesLive?'live':'unavailable'
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
      calibration:'Evidence-quality confidence combines freshness, sample depth, scenario separation and independent timeframe agreement. It is not a success probability.'
    },
    graph:graph.graph?{...graph.graph,nodes,textAlternative}:graph.graph
  };
}

const timeframeSummary=(graph)=>({interval:graph.interval,truthState:graph.truthState,marketState:graph.market.currentState,metrics:{rsi14:graph.metrics.rsi14,atrPct:graph.metrics.atrPct,trendPerBarPct:graph.metrics.trendPerBarPct},probabilities:graph.forecast.probabilities,qellyView:{action:graph.qellyView.action,confidence:graph.qellyView.confidence,label:graph.qellyView.label}});
async function fetchTimeframes(fetchImpl,asset,endTime,selectedInterval){
  const intervals=[...new Set([selectedInterval,...TIMEFRAMES])];
  const settled=await Promise.allSettled(intervals.map(async interval=>timeframeSummary(buildDecisionProvenGraph(await fetchCandles(fetchImpl,asset,interval,endTime,240),{asset,interval,horizonBars:16,now:endTime}))));
  const views=settled.filter(item=>item.status==='fulfilled').map(item=>item.value);const directional=views.filter(item=>item.qellyView.action==='BUY'||item.qellyView.action==='SELL');const buys=directional.filter(item=>item.qellyView.action==='BUY').length,sells=directional.length-buys;
  return {state:views.length>=3?'live':views.length?'partial':'unavailable',views,agreement:{direction:buys>sells?'BUY':sells>buys?'SELL':'MIXED',aligned:Math.max(buys,sells),directional:directional.length,total:views.length}};
}

export async function onRequest({request,env}){
  try{
    if(request.method!=='GET')throw new HttpError(405,'method_not_allowed','Use GET for public Decision Intelligence');
    await enforceRateLimit(env,'decision-proven-graph:'+ip(request),{limit:30,windowMs:60_000});
    const url=new URL(request.url);const asset=String(url.searchParams.get('asset')||'BTC').toUpperCase();const interval=url.searchParams.get('interval')||'15m';const horizon=url.searchParams.get('horizon')||'4h';
    if(!ASSETS.has(asset))throw new HttpError(400,'unsupported_asset','Supported assets: BTC, ETH, SOL, HYPE, XRP, DOGE');
    if(!DECISION_INTERVALS[interval])throw new HttpError(400,'unsupported_interval','Unsupported candle interval');
    if(!HORIZONS[horizon])throw new HttpError(400,'unsupported_horizon','Supported horizons: 1h, 4h, 12h, 1d, 3d, 7d');
    const horizonBars=Math.ceil(HORIZONS[horizon]/DECISION_INTERVALS[interval]);if(horizonBars<2||horizonBars>168)throw new HttpError(400,'incompatible_horizon','Choose a horizon at least two bars long and no more than 168 bars');
    const endTime=Date.now();const selectionStart=Number(url.searchParams.get('selectionStart'));const selectionEnd=Number(url.searchParams.get('selectionEnd'));let selection=null;
    if(url.searchParams.has('selectionStart')||url.searchParams.has('selectionEnd')){if(!Number.isFinite(selectionStart)||!Number.isFinite(selectionEnd)||selectionStart>=selectionEnd||selectionEnd-selectionStart>90*86_400_000)throw new HttpError(400,'invalid_selection','Select a valid chart range of 90 days or less');selection={start:selectionStart,end:selectionEnd};}
    const fetchImpl=fetcher(env);const [payload,multiTimeframe,derivatives]=await Promise.all([fetchCandles(fetchImpl,asset,interval,endTime),fetchTimeframes(fetchImpl,asset,endTime,interval),fetchDerivativesContext(fetchImpl,asset,endTime)]);
    let graph;try{graph=buildDecisionProvenGraph(payload,{asset,interval,horizonBars,now:endTime,selection});graph=calibrateDecisionEvidence(graph,multiTimeframe,derivatives);}catch(error){throw new HttpError(503,'insufficient_provider_data',error.message,{retryable:true});}
    const newsStart=selection?.start??endTime-24*3_600_000;const newsEnd=Math.min(selection?.end??endTime,endTime);let articles=[];let newsState='unavailable';
    try{articles=await fetchNews(fetchImpl,asset,newsStart,newsEnd);newsState=articles.length?'live':'no-matches';}catch{}
    return responseJson(request,env,{...graph,horizon,multiTimeframe,evidence:{news:{state:newsState,provider:'GDELT',articles},derivatives,liquidations:{state:'unavailable',message:'Verified liquidation evidence is not available for this view, so it is not inferred.'}}},200,{cache:'public, max-age=10, stale-while-revalidate=30'});
  }catch(error){return errorResponse(request,env,error);}
}
