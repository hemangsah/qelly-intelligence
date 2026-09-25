const STOPWORDS=new Set([
  'a','an','and','are','as','at','be','by','for','from','has','have','in','into','is','it','its','of','on','or','that','the','their','this','to','was','were','will','with',
  'after','amid','before','over','under','up','down','new','says','say','report','reports','news','update','latest'
]);

const ASSET_ALIASES=Object.freeze({
  BTC:['bitcoin','btc'],
  ETH:['ethereum','ether','eth'],
  SOL:['solana','sol'],
  HYPE:['hyperliquid','hype'],
  XRP:['xrp','ripple'],
  DOGE:['dogecoin','doge']
});

const TOPIC_RULES=Object.freeze([
  ['REGULATION_POLICY',['sec','regulator','regulation','regulatory','law','lawsuit','court','approval','approve','ban','license','compliance','policy']],
  ['ETF_INSTITUTIONAL',['etf','blackrock','fidelity','institutional','institution','asset manager','fund inflow','fund outflow','treasury','custody']],
  ['MACRO_RATES',['fed','federal reserve','interest rate','rates','inflation','cpi','payroll','jobs report','dollar','yield','recession','central bank']],
  ['DERIVATIVES_MARKET_STRUCTURE',['exchange','derivatives','future','futures','option','options','liquidation','funding','open interest','order book','volume']],
  ['NETWORK_PROTOCOL',['upgrade','fork','validator','network','protocol','mainnet','testnet','staking','transaction','blockchain']],
  ['SECURITY_INCIDENT',['hack','hacked','exploit','breach','stolen','vulnerability','attack']],
  ['ADOPTION_CORPORATE',['adoption','payment','payments','partnership','integration','launch','reserve','corporate','company']],
  ['PRICE_MARKET',['price','rally','surge','drop','fall','gain','loss','record high','all-time high','market cap']]
]);

const round=(value,digits=4)=>Number.isFinite(Number(value))?Number(Number(value).toFixed(digits)):null;
const normalizeText=(value)=>String(value||'')
  .toLowerCase()
  .replace(/https?:\/\/\S+/g,' ')
  .replace(/[^a-z0-9]+/g,' ')
  .replace(/\s+/g,' ')
  .trim();

export const tokenizeNewsTitle=(title)=>normalizeText(title)
  .split(' ')
  .filter(token=>token&&token.length>1&&!STOPWORDS.has(token));

export const titleTokenJaccard=(left,right)=>{
  const a=new Set(Array.isArray(left)?left:tokenizeNewsTitle(left));
  const b=new Set(Array.isArray(right)?right:tokenizeNewsTitle(right));
  if(!a.size&&!b.size)return 1;
  const intersection=[...a].filter(token=>b.has(token)).length;
  const union=new Set([...a,...b]).size;
  return union?intersection/union:0;
};

const topicHintsFor=(title)=>{
  const normalized=' '+normalizeText(title)+' ';
  const hints=[];
  for(const [topic,terms] of TOPIC_RULES){
    if(terms.some(term=>normalized.includes(' '+normalizeText(term)+' ')))hints.push(topic);
  }
  return hints;
};

const assetMentionFor=(title,asset)=>{
  const normalized=' '+normalizeText(title)+' ';
  const aliases=ASSET_ALIASES[String(asset||'').toUpperCase()]||[];
  return aliases.some(alias=>normalized.includes(' '+normalizeText(alias)+' '));
};

const stableHash=(value)=>{
  let hash=2166136261;
  for(const ch of String(value||'')){
    hash^=ch.charCodeAt(0);
    hash=Math.imul(hash,16777619);
  }
  return (hash>>>0).toString(16).padStart(8,'0');
};

const canonicalClusterSeed=(article)=>normalizeText(article?.title)||String(article?.url||article?.source||'news');

export function buildDecisionNewsClusters(articles,{asset='BTC',similarityThreshold=.72}={}){
  const items=(Array.isArray(articles)?articles:[])
    .map((article,index)=>({
      index,
      article,
      tokens:tokenizeNewsTitle(article?.title),
      topics:topicHintsFor(article?.title),
      directAssetMention:assetMentionFor(article?.title,asset)
    }))
    .filter(item=>String(item.article?.title||'').trim());

  const threshold=Math.max(.5,Math.min(.95,Number(similarityThreshold)||.72));
  if(!items.length)return {
    schemaVersion:'qelly.decision-news-clusters/1.0.0',
    state:'NO_ARTICLES',
    articleCount:0,
    clusterCount:0,
    duplicateCount:0,
    similarityThreshold:threshold,
    clusters:[],
    method:'Deterministic title-token Jaccard clustering after provider normalization. Raw provider articles remain unchanged.',
    boundary:'No articles were available. No topic, sentiment, market impact, causality or directional trade inference is manufactured.'
  };

  const clusters=[];
  for(const item of items){
    let best=null;
    for(const cluster of clusters){
      const similarity=titleTokenJaccard(item.tokens,cluster.representativeTokens);
      if(similarity>=threshold&&(!best||similarity>best.similarity))best={cluster,similarity};
    }
    if(!best){
      clusters.push({
        representative:item.article,
        representativeTokens:item.tokens,
        members:[{...item,similarity:1}]
      });
      continue;
    }
    best.cluster.members.push({...item,similarity:best.similarity});
  }

  const output=clusters.map((cluster,index)=>{
    const members=cluster.members;
    const sources=[...new Set(members.map(item=>String(item.article?.source||'').trim()).filter(Boolean))];
    const topics=[...new Set(members.flatMap(item=>item.topics))];
    const directCount=members.filter(item=>item.directAssetMention).length;
    const meanSimilarity=members.reduce((sum,item)=>sum+item.similarity,0)/members.length;
    return {
      clusterId:'news-'+stableHash(canonicalClusterSeed(cluster.representative)),
      rank:index+1,
      representative:{
        title:String(cluster.representative?.title||''),
        source:String(cluster.representative?.source||''),
        publishedAt:String(cluster.representative?.publishedAt||''),
        url:cluster.representative?.url||null
      },
      articleCount:members.length,
      duplicateCount:Math.max(0,members.length-1),
      articleIndexes:members.map(item=>item.index),
      sourceCount:sources.length,
      sources:sources.slice(0,8),
      topicHints:topics.slice(0,8),
      directAssetMentionCount:directCount,
      relevanceState:directCount>0?'DIRECT_ASSET_MENTION':'QUERY_CONTEXT_ONLY',
      meanTitleSimilarity:round(meanSimilarity,3)
    };
  });

  return {
    schemaVersion:'qelly.decision-news-clusters/1.0.0',
    state:'AVAILABLE',
    asset:String(asset||'').toUpperCase(),
    articleCount:items.length,
    clusterCount:output.length,
    duplicateCount:items.length-output.length,
    similarityThreshold:threshold,
    clusters:output,
    method:'Deterministic title-token Jaccard clustering after provider normalization. Similarity is lexical, not semantic. Raw provider articles remain unchanged and source diversity is preserved.',
    boundary:'Headline clustering and topic hints are contextual audit metadata only. They do not establish factual equivalence, sentiment, causality, market impact, institutional intent, event surprise, or BUY/SELL eligibility.'
  };
}

export const __decisionNewsTest=Object.freeze({STOPWORDS,ASSET_ALIASES,TOPIC_RULES,normalizeText,topicHintsFor,assetMentionFor,stableHash});
