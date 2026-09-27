import {buildDecisionNewsClusters,decisionNewsArticleMetadata} from './decision-news.js';

const compactTime=(value)=>{
  const raw=String(value??'').trim();
  const numeric=Number(raw);
  if(Number.isFinite(numeric)&&raw!=='')return Math.abs(numeric)<100_000_000_000?numeric*1000:numeric;
  const match=raw.match(/^(\d{4})(\d{2})(\d{2})T?(\d{2})(\d{2})(\d{2})Z?$/);
  const normalized=match?`${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:${match[6]}Z`:raw;
  const parsed=Date.parse(normalized);
  return Number.isFinite(parsed)?parsed:null;
};
const iso=(value)=>{const time=compactTime(value);return time===null?null:new Date(time).toISOString();};
const finite=(value)=>{const number=Number(value);return Number.isFinite(number)?number:null;};
const clamp=(value,min=0,max=1)=>Math.min(max,Math.max(min,value));
const uniqueKey=(article)=>String(article?.url||'').trim()||[article?.title,article?.source,article?.publishedAt].map(value=>String(value||'').trim()).join('|');
const bucketName=(value)=>String(value||'').toUpperCase();

const associationConfidence=({bucket,direct,sourceCount,topics})=>{
  let score=.15;
  if(direct)score+=.3;
  if(bucket==='DURING')score+=.2;
  else score+=.08;
  if(Number(sourceCount)>=2)score+=.12;
  if(Array.isArray(topics)&&topics.length)score+=.05;
  score=clamp(score,0,.85);
  return {score:Number(score.toFixed(2)),label:score>=.7?'HIGH':score>=.5?'MODERATE':score>=.3?'LOW':'CONTEXT_ONLY',meaning:'Confidence that the sourced item is relevant in time/context to this selected range; not confidence that it caused the price move.'};
};
const evidenceStrength=({direct,sourceCount,topics})=>direct&&Number(sourceCount)>=2?'STRONG':direct?'MODERATE':Array.isArray(topics)&&topics.length?'WEAK':'CONTEXT_ONLY';
const relationshipLanguage=(bucket)=>bucket==='BEFORE'?'occurred before':bucket==='DURING'?'coincided with':'occurred after';

const normalizeWindow=(value)=>({
  start:compactTime(value?.start),
  end:compactTime(value?.end),
  state:String(value?.state||'UNAVAILABLE').toUpperCase(),
  coverageState:String(value?.coverageState||'UNKNOWN').toUpperCase()
});

export function buildDecisionHistoricalNewsTimeline({asset='BTC',rangeEvidence=null,newsBuckets={}}={}){
  const request=rangeEvidence?.request||{};
  const rangeStart=compactTime(request.rangeStart),rangeEnd=compactTime(request.rangeEnd);
  if(rangeStart===null||rangeEnd===null||!(rangeStart<rangeEnd))return {
    schemaVersion:'qelly.decision-historical-news-timeline/1.0.0',state:'UNAVAILABLE',buckets:{BEFORE:[],DURING:[],AFTER:[]},items:[],coverage:[],filteredOutOfWindow:0,
    boundary:'A valid selected historical range is required before a news/event timeline can be assembled.'
  };
  const sourceRows=[];
  for(const name of ['before','during','after']){
    const result=newsBuckets?.[name]||{};
    const window=normalizeWindow(result.window);
    for(const article of Array.isArray(result.articles)?result.articles:[])sourceRows.push({article,declaredBucket:name.toUpperCase(),window,result});
  }
  const deduped=[],seen=new Set();
  for(const row of sourceRows){
    const key=uniqueKey(row.article);if(!key||seen.has(key))continue;seen.add(key);deduped.push(row);
  }
  const combinedArticles=deduped.map(row=>row.article);
  const clustering=buildDecisionNewsClusters(combinedArticles,{asset});
  const clusterByIndex=new Map();
  for(const cluster of clustering.clusters||[])for(const index of cluster.articleIndexes||[])clusterByIndex.set(index,cluster);

  const buckets={BEFORE:[],DURING:[],AFTER:[]};
  let filteredOutOfWindow=0,missingTimestamp=0;
  deduped.forEach((row,index)=>{
    const timestamp=compactTime(row.article?.publishedAt);
    if(timestamp===null){missingTimestamp++;return;}
    const window=row.window;
    if(window.start===null||window.end===null||timestamp<window.start||timestamp>window.end){filteredOutOfWindow++;return;}
    let bucket=null;
    if(timestamp<rangeStart)bucket='BEFORE';
    else if(timestamp<=rangeEnd)bucket='DURING';
    else bucket='AFTER';
    if(bucketName(row.declaredBucket)!==bucket){
      // Provider output is accepted only by timestamp truth, never by the requested bucket label.
    }
    const metadata=decisionNewsArticleMetadata(row.article,{asset}),cluster=clusterByIndex.get(index)||null;
    const direct=metadata.directAssetMention===true,sourceCount=Number(cluster?.sourceCount)||1;
    const confidence=associationConfidence({bucket,direct,sourceCount,topics:metadata.topics});
    const relationship=relationshipLanguage(bucket);
    const item={
      id:cluster?.clusterId?cluster.clusterId+'-'+index:'timeline-'+index,
      bucket,timestamp:new Date(timestamp).toISOString(),source:String(row.article?.source||'External reporting'),
      event:String(row.article?.title||'Untitled sourced event'),headline:String(row.article?.title||'Untitled sourced event'),
      url:row.article?.url||null,
      relevance:direct?'DIRECT_ASSET_MENTION':'INDIRECT_QUERY_CONTEXT',
      directness:direct?'DIRECT':'INDIRECT',
      evidenceStrength:evidenceStrength({direct,sourceCount,topics:metadata.topics}),
      directionalRelevance:metadata.directionalRelevance,
      directionalBoundary:metadata.boundary,
      topicHints:metadata.topics,
      sourceCount,clusterId:cluster?.clusterId||null,
      associationConfidence:confidence,
      relationship,
      associationStatement:relationship+' the selected move; '+(direct?'the asset is named directly in the headline.':'the item was returned by the bounded asset query but does not directly name the asset.')+' Timing alone does not establish causation.'
    };
    buckets[bucket].push(item);
  });
  for(const value of Object.values(buckets))value.sort((a,b)=>Date.parse(a.timestamp)-Date.parse(b.timestamp));
  const items=[...buckets.BEFORE,...buckets.DURING,...buckets.AFTER];
  const coverage=['before','during','after'].map(name=>{
    const result=newsBuckets?.[name]||{},window=result.window||{};
    return {
      bucket:name.toUpperCase(),state:String(result.state||'unavailable').toUpperCase(),coverageState:String(result.coverageState||'UNKNOWN').toUpperCase(),
      requestedStart:iso(window.start),requestedEnd:iso(window.end),returnedCount:Array.isArray(result.articles)?result.articles.length:0,
      acceptedCount:buckets[name.toUpperCase()].length,fallbackReason:result.fallbackReason||null,
      exactWindow:result.exactWindow===true
    };
  });
  const state=items.length?'AVAILABLE':coverage.some(item=>['LIVE','CACHED','NO-MATCHES'].includes(item.state))?'NO_MATCHES':'UNAVAILABLE';
  return {
    schemaVersion:'qelly.decision-historical-news-timeline/1.0.0',state,asset:String(asset||'').toUpperCase(),
    rangeStart:new Date(rangeStart).toISOString(),rangeEnd:new Date(rangeEnd).toISOString(),
    buckets,items,coverage,filteredOutOfWindow,missingTimestamp,clustering,
    summary:{eventCount:items.length,before:buckets.BEFORE.length,during:buckets.DURING.length,after:buckets.AFTER.length,direct:items.filter(item=>item.directness==='DIRECT').length},
    causalityState:'ASSOCIATION_ONLY',
    boundary:'Timeline items are source-backed and time-bounded. BEFORE/DURING/AFTER describe chronology, relevance and association only; timing does not prove causation, headline direction is lexical context only, and no item independently changes QELLY VIEW or setup eligibility.'
  };
}

export const __decisionRangeTimelineTest=Object.freeze({compactTime,associationConfidence,evidenceStrength,relationshipLanguage,normalizeWindow});
