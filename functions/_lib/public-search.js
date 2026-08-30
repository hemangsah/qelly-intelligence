import {routeDefinitions} from '../../apps/web/public/assets/route-registry.mjs';
import {listFormulaDefinitions} from '../../apps/web/public/assets/calculation/formula-engine-extended.mjs';
import {listIndicatorDefinitions} from '../../apps/web/public/assets/calculation/indicator-engine-extended.mjs';

const normalize=(value)=>String(value??'').trim().toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const compact=(value)=>String(value??'').trim();
const tokens=(value)=>normalize(value).split(/\s+/).filter(Boolean);

function searchDocument(item){
  return normalize([item.title,item.subtitle,item.id,item.keywords,item.purpose,item.useCase].join(' '));
}

function relevance(query,item){
  if(!query)return Number(item.featuredOrder??0)>0?70-Number(item.featuredOrder):10;
  const needle=normalize(query);
  const title=normalize(item.title);
  const id=normalize(item.id);
  const document=searchDocument(item);
  if(id===needle)return 100;
  if(title===needle)return 98;
  if(title.startsWith(needle)||id.startsWith(needle))return 90;
  const terms=tokens(needle);
  const documentTerms=new Set(tokens(document));
  const hasTerm=(term)=>term.length<=3?documentTerms.has(term):[...documentTerms].some((candidate)=>candidate===term||candidate.startsWith(term));
  if(terms.length&&terms.every(hasTerm))return 78+Math.min(8,terms.length*2);
  if(needle.length>3&&document.includes(needle))return 72;
  const matched=terms.filter(hasTerm).length;
  if(terms.length>1)return 0;
  return matched?55:0;
}

function matchReason(query,item,score){
  if(!query)return item.featuredOrder?'Purpose-led starting point':'Catalog entry';
  const needle=normalize(query);
  if(normalize(item.id)===needle)return 'Exact identifier match';
  if(normalize(item.title)===needle)return 'Exact name match';
  if(normalize(item.title).startsWith(needle)||normalize(item.id).startsWith(needle))return 'Name or identifier prefix';
  if(score>=78)return 'Every query term appears in indexed metadata';
  return 'Related purpose, use case, name or identifier';
}

const featureItems=routeDefinitions.filter((item)=>!item.hidden&&!item.anonymousOnly).map((item,index)=>({
  id:item.route,
  type:'feature',
  title:item.label,
  subtitle:`${item.section} · ${item.kind.replaceAll('-',' ')}`,
  purpose:item.purpose,
  useCase:item.useCase,
  keywords:`${item.section} ${item.domain} ${item.kind} ${item.meta}`,
  route:item.route,
  access:item.public===true?'public':'workspace',
  truthState:'catalog',
  source:'Qelly product route registry',
  evidence:{section:item.section,domain:item.domain,kind:item.kind,contract:item.meta},
  featuredOrder:['feature-universe','about-qelly','market','discovery-hub','asset-rankings','news-research','decision-provenance','qelly-verify'].indexOf(item.route)+1||index+100
}));

const formulaItems=listFormulaDefinitions().map((item,index)=>({
  id:item.formulaId,
  type:'formula',
  title:item.name,
  subtitle:`${compact(item.domain).replaceAll('-',' ')} · deterministic formula`,
  purpose:item.description||`Run the ${item.name} calculation with declared inputs.`,
  useCase:`Use when your task needs a reproducible ${item.name.toLowerCase()} calculation.`,
  keywords:`${item.formulaId} ${item.domain} ${Object.keys(item.inputSchema?.properties||{}).join(' ')}`,
  route:`formula-detail/${encodeURIComponent(item.formulaId)}`,
  access:'public',
  truthState:'deterministic',
  source:'Qelly formula engine',
  evidence:{version:item.version,engineVersion:item.engineVersion,status:item.status,externalProviderRequired:item.externalProviderRequired===true},
  featuredOrder:index<3?20+index:0
}));

const indicatorItems=listIndicatorDefinitions().map((item,index)=>({
  id:item.indicatorId,
  type:'indicator',
  title:item.name,
  subtitle:`${compact(item.category).replaceAll('-',' ')} · governed indicator`,
  purpose:`Inspect and run the documented ${item.name} method.`,
  useCase:`Use when technical analysis requires ${item.name} with declared input and warm-up rules.`,
  keywords:`${item.indicatorId} ${item.category} ${(item.requiredFields||[]).join(' ')} ${item.reference||''}`,
  route:`indicator-detail/${encodeURIComponent(item.indicatorId)}`,
  access:'public',
  truthState:'deterministic',
  source:'Qelly indicator engine',
  evidence:{version:item.version,status:item.status,warmup:item.warmup,browserImplemented:item.browserImplemented===true},
  featuredOrder:index<2?30+index:0
}));

function assetItems(ranking={}){
  return (Array.isArray(ranking.candidates)?ranking.candidates:[]).map((item,index)=>({
    id:item.id,
    type:'asset',
    title:`${item.symbol} · ${item.name}`,
    subtitle:`Governed crypto observation · rank ${item.rank??index+1}`,
    purpose:'Open the attributed asset dossier for this instrument.',
    useCase:'Use after discovery or ranking when one asset needs closer evidence review.',
    keywords:`${item.symbol} ${item.name} crypto ${item.provider||''}`,
    route:`asset/${encodeURIComponent(item.id)}`,
    access:'public',
    truthState:item.truthState||'unavailable',
    source:item.provider||'Governed market source',
    evidence:{observedAt:item.observedAt??null,priceUsd:item.priceUsd??null,change24hPct:item.change24hPct??null,rankingScore:item.scores?.balanced??null,rankingVersion:ranking.version??null},
    featuredOrder:40+index
  }));
}

const catalog=Object.freeze([...featureItems,...formulaItems,...indicatorItems]);

export function buildUniversalSearch({q='',types='',access='all',limit=30,assetRankings={}}={}){
  const query=compact(q).slice(0,160);
  const selectedTypes=new Set((Array.isArray(types)?types:String(types).split(',')).map(normalize).filter(Boolean));
  const selectedAccess=['public','workspace'].includes(normalize(access))?normalize(access):'all';
  const boundedLimit=Math.max(1,Math.min(50,Number(limit)||30));
  const complete=[...catalog,...assetItems(assetRankings)];
  const scored=complete.map((item)=>({...item,score:relevance(query,item)})).filter((item)=>{
    if(query&&item.score<=0)return false;
    if(selectedTypes.size&&!selectedTypes.has(item.type))return false;
    if(selectedAccess!=='all'&&item.access!==selectedAccess)return false;
    return true;
  }).sort((left,right)=>right.score-left.score||left.type.localeCompare(right.type)||left.title.localeCompare(right.title));
  const facet=(key)=>Object.entries(scored.reduce((counts,item)=>({...counts,[item[key]]:(counts[item[key]]||0)+1}),{})).map(([value,count])=>({value,count})).sort((left,right)=>right.count-left.count||left.value.localeCompare(right.value));
  const items=scored.slice(0,boundedLimit).map((item)=>({...item,whyMatched:matchReason(query,item,item.score)}));
  return {
    version:'qelly-universal-search-v2',
    mode:'governed-public-catalog-search',
    query,
    items,
    total:scored.length,
    limit:boundedLimit,
    facets:{types:facet('type'),access:facet('access')},
    corpus:{features:featureItems.length,formulas:formulaItems.length,indicators:indicatorItems.length,assets:assetItems(assetRankings).length,total:complete.length},
    sources:['Qelly product route registry','Qelly deterministic formula engine','Qelly deterministic indicator engine',...(assetItems(assetRankings).length?['Current governed asset-ranking sample']:[])],
    boundaries:{privateWorkspaceContent:false,externalLicensedIndex:false,generativeSynthesis:false,userProfiling:false,execution:false,fabricatedObservations:false},
    generatedAt:new Date().toISOString()
  };
}

export const __test=Object.freeze({normalize,relevance,matchReason,featureItems,formulaItems,indicatorItems});
