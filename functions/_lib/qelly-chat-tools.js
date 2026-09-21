import {calculateFormula,getFormulaDefinition} from '../../apps/web/public/assets/calculation/formula-engine-extended.mjs';
import {buildAssetRankings} from './market-network.js';
import {buildPublicAssetIntelligence} from './public-asset-intelligence.js';
import {buildUniversalSearch} from './public-search.js';
import {buildPublicEventCalendar} from './public-event-calendar.js';
import {runFormulaScreen} from '../api/v1/formula-screener.js';

export const CHAT_ASSETS=Object.freeze(['BTC','ETH','SOL','HYPE','XRP','DOGE']);
export const CHAT_TIMEFRAMES=Object.freeze(['1m','5m','15m','30m','1h','4h','1d']);
export const CHAT_MODES=Object.freeze(['ask','research','compare','explain','calculate','decision','asset','india']);
export const FEATURED_CALCULATORS=Object.freeze([
  'cagr','position-size','risk-reward','black-scholes','kelly-criterion','maximum-drawdown','sip-future-value','loan-emi'
]);
const ASSET_IDS=Object.freeze({BTC:'QI-CRYPTO-BTC',ETH:'QI-CRYPTO-ETH',SOL:'QI-CRYPTO-SOL',HYPE:'QI-CRYPTO-HYPE',XRP:'QI-CRYPTO-XRP',DOGE:'QI-CRYPTO-DOGE'});
const scalar=(value)=>value==null||['string','number','boolean'].includes(typeof value);
const bounded=(value,max=240)=>String(value??'').trim().slice(0,max);
const state=(value)=>String(value||'unavailable').toLowerCase();

export const normalizeChatAsset=(value)=>CHAT_ASSETS.includes(String(value||'').toUpperCase())?String(value).toUpperCase():'BTC';
export const normalizeChatTimeframe=(value)=>CHAT_TIMEFRAMES.includes(String(value||''))?String(value):'15m';
export const normalizeChatMode=(value)=>CHAT_MODES.includes(String(value||''))?String(value):'ask';

const receipt=(id,label,{truthState='unavailable',freshness=null,observedAt=null,source='QELLY',data=null,limitations=[]}={})=>Object.freeze({
  id,label,truthState:state(truthState),freshness:bounded(freshness??truthState,80),observedAt:observedAt??null,generatedAt:new Date().toISOString(),
  source:bounded(source,160),data,
  limitations:Object.freeze((Array.isArray(limitations)?limitations:[]).map(item=>bounded(item,300)).slice(0,8))
});

export function buildMarketToolReceipt(sources={},asset='BTC'){
  const symbol=normalizeChatAsset(asset);
  const source=sources.hyperliquid||{};
  const rows=Array.isArray(source.data)?source.data:[];
  const row=rows.find(item=>String(item?.symbol||'').toUpperCase()===symbol)||null;
  const truthState=row?state(source.truthState||'live'):'unavailable';
  return receipt('public-market-data','QELLY public market data',{
    truthState,
    freshness:truthState,
    observedAt:source.observedAt??null,
    source:'Hyperliquid public market source',
    data:row?{symbol,mid:Number.isFinite(Number(row.mid))?Number(row.mid):null,provider:'Hyperliquid'}:{symbol,mid:null,provider:'Hyperliquid'},
    limitations:[
      'This is governed public crypto market context only; it is not an order, execution receipt or personalized recommendation.',
      'A perpetual-market mid is context, not a guaranteed executable spot price.'
    ]
  });
}

const screenerFormulaFor=(message)=>{
  const value=bounded(message,600).toLowerCase();
  if(/\brsi\b/.test(value))return 'rsi_impulse';
  if(/trend|efficien/.test(value))return 'trend_efficiency';
  return 'momentum_quality';
};
const mentionedAssets=(message,fallback)=>{
  const upper=bounded(message,600).toUpperCase();
  const hits=CHAT_ASSETS.filter(asset=>new RegExp('\\b'+asset+'\\b').test(upper));
  return hits.length?hits:[normalizeChatAsset(fallback)];
};

export async function buildFormulaScreenerToolReceipt(env,{message='',asset='BTC'}={}){
  const formula=screenerFormulaFor(message),assets=mentionedAssets(message,asset);
  try{
    const result=await runFormulaScreen(env,{formula,assets});
    const observed=(result.rows||[]).map(row=>row?.source?.observedAt).filter(Boolean).sort().at(-1)??result.generatedAt??null;
    const freshnessStates=[...new Set((result.rows||[]).map(row=>row?.freshness?.state).filter(Boolean))];
    return receipt('formula-screener','QELLY Formula Screener',{
      truthState:result.state||'unavailable',
      freshness:freshnessStates.join(', ')||result.state||'unavailable',
      observedAt:observed,
      source:'Hyperliquid public candle data · QELLY Formula Screener',
      data:{formula:result.formula,interval:result.source?.interval,rows:(result.rows||[]).slice(0,6).map(row=>({asset:row.asset,value:row.value,metrics:row.metrics,state:row.state,freshness:row.freshness,observedAt:row.source?.observedAt??null}))},
      limitations:[
        'Only registered Formula Screener metrics are supported; custom expressions, arbitrary code and arbitrary SQL are disabled.',
        'Unavailable provider rows remain unavailable and are not backfilled with synthetic values.'
      ]
    });
  }catch(error){
    return receipt('formula-screener','QELLY Formula Screener',{
      truthState:'unavailable',freshness:'unavailable',source:'Hyperliquid public candle data · QELLY Formula Screener',
      data:{formula,assets,reason:bounded(error?.message,240)},
      limitations:['Live Formula Screener data could not be verified, so no substitute ranking was generated.']
    });
  }
}

export function buildEventCalendarToolReceipt(message,asset='BTC'){
  const symbol=normalizeChatAsset(asset);
  if(symbol!=='BTC'){
    return receipt('event-calendar','QELLY Event Calendar',{
      truthState:'unavailable',freshness:'planning-only',source:'QELLY user-declared event planner',
      data:{asset:symbol,connectedEvents:0,liveFeed:false},
      limitations:[
        'The public Event Calendar has no connected live event feed and does not invent dates.',
        'Its current crypto planning catalog supports BTC; unsupported assets are not silently mapped to another instrument.'
      ]
    });
  }
  const plan=buildPublicEventCalendar(symbol,{});
  return receipt('event-calendar','QELLY Event Calendar',{
    truthState:'planning-only',freshness:'planning-only',source:'QELLY user-declared event planner',
    data:{asset:plan.selected?.symbol,eventTypes:plan.eventTypes?.map(item=>({id:item.id,label:item.label}))??[],coverage:plan.coverage,approvedSourceDomains:plan.approvedSourceDomains},
    limitations:[
      'No approved production event feed is connected; this tool plans user-declared events only.',
      'Dates, outcomes and source verification remain empty until the user supplies them.'
    ]
  });
}

export function buildPublicResearchToolReceipt(financeContext={}){
  const citations=Array.isArray(financeContext.citations)?financeContext.citations:[];
  const available=citations.filter(item=>item?.truthState&&item.truthState!=='unavailable');
  return receipt('public-research','QELLY public research evidence',{
    truthState:available.length?'mixed':'unavailable',freshness:'mixed-source',
    observedAt:available.map(item=>item.observedAt).filter(Boolean).sort().at(-1)??financeContext.generatedAt??null,
    source:'QELLY connected public-source ledger',
    data:{sources:citations.map(item=>({id:item.id,title:item.title,truthState:item.truthState,observedAt:item.observedAt,url:item.url}))},
    limitations:['This is a bounded source ledger, not unrestricted web search or private-workspace retrieval.','Each source keeps its own truth state and timestamp; mixed evidence is not collapsed into a false single freshness claim.']
  });
}

export function buildVerifyToolReceipt(){
  return receipt('qelly-verify','QELLY Verify',{
    truthState:'input_required',freshness:'not-applicable',source:'QELLY Verify deterministic local engine',
    data:{route:'qelly-verify',requiredInput:'strategy trade CSV',minimumValidTrades:5},
    limitations:['QELLY Verify requires user-supplied strategy/trade evidence; Chat does not invent or remotely verify a missing file.','Verification analysis is deterministic local research support, not proof of future performance.']
  });
}

export function buildSearchToolReceipt(message,sources={}){
  const result=buildUniversalSearch({q:bounded(message,160),limit:8,assetRankings:buildAssetRankings(sources)});
  return receipt('qelly-search','QELLY public search',{
    truthState:'catalog',
    freshness:'catalog',
    observedAt:result.generatedAt,
    source:result.sources.join(' · '),
    data:{query:result.query,total:result.total,items:result.items.map(item=>({id:item.id,type:item.type,title:item.title,route:item.route,access:item.access,truthState:item.truthState,source:item.source,whyMatched:item.whyMatched})).slice(0,8)},
    limitations:['Search covers the governed QELLY public catalog and current governed asset-ranking sample only.','It is not a web search and does not index private workspace content or licensed external datasets.']
  });
}

export function buildAssetToolReceipt(sources={},asset='BTC'){
  const symbol=normalizeChatAsset(asset);
  const result=buildPublicAssetIntelligence(sources,ASSET_IDS[symbol]||symbol);
  const selected=result.selected;
  return receipt('asset-dossier','QELLY Asset Dossier',{
    truthState:selected?.observation?.truthState||'unavailable',
    freshness:selected?.observation?.truthState||'unavailable',
    observedAt:selected?.observation?.observedAt??null,
    source:selected?.observation?.provider||'QELLY governed asset intelligence',
    data:{
      id:selected?.id,symbol:selected?.symbol,name:selected?.name,assetClass:selected?.assetClass,network:selected?.network,role:selected?.role,
      observation:selected?.observation??null,independentContext:selected?.independentContext??null,
      evidenceTracks:result.evidenceTracks.map(item=>({id:item.id,label:item.label,state:item.state,detail:item.detail})),
      sourceLedger:result.sourceLedger.slice(0,6)
    },
    limitations:['Missing economic-model or catalyst evidence remains unavailable.','Independent context is contextual evidence, not confirmation.','No personalized recommendation, forecast, persistence or execution is produced.']
  });
}

export function buildIndiaToolReceipt(financeContext={}){
  const observations=financeContext.observations||{};
  const macro=Array.isArray(observations.worldBank?.observations)?observations.worldBank.observations.filter(item=>String(item.countryId||item.country||'').toUpperCase().includes('IND')||String(item.country||'').toLowerCase()==='india').slice(0,8):[];
  const ecb=observations.ecb||{};
  const citations=Array.isArray(financeContext.citations)?financeContext.citations:[];
  const worldBankSource=citations.find(item=>item.id==='world-bank');
  const ecbSource=citations.find(item=>item.id==='ecb-reference');
  const truthState=macro.length?'delayed':(ecb.rates?'delayed':'unavailable');
  return receipt('india-finance','QELLY India Finance evidence',{
    truthState,
    freshness:'delayed-reference',
    observedAt:worldBankSource?.observedAt??ecbSource?.observedAt??null,
    source:[worldBankSource?.title,ecbSource?.title].filter(Boolean).join(' · ')||'QELLY India Finance',
    data:{
      worldBank:macro,
      ecbReference:{base:ecb.base??'EUR',inr:ecb.rates?.INR??null,observedAt:ecb.observedAt??null},
      displayOnlyCoverage:['Nifty 50','Sensex','Bank Nifty','USD/INR','Gold']
    },
    limitations:['India benchmark widgets are official TradingView display surfaces; QELLY Chat does not ingest their displayed values as evidence.','No verified live India VIX, FII/DII, breadth, yield or corporate-action feed is connected here.','World Bank and ECB observations are delayed reference data, not live exchange prices.']
  });
}

function definitionSummary(definition){
  return {
    formulaId:definition.formulaId,name:definition.name,version:definition.version,domain:definition.domain,
    description:definition.description??null,inputSchema:definition.inputSchema,example:definition.referenceVector?.inputs??{}
  };
}

export function buildCalculatorToolReceipt(request={}){
  const formulaId=bounded(request?.formulaId,100);
  let definition;
  try{definition=getFormulaDefinition(formulaId);}catch{
    return receipt('calculator','QELLY deterministic calculator',{truthState:'unavailable',source:'QELLY formula engine',data:{formulaId,reason:'unknown_formula'},limitations:['Choose a registered QELLY formula ID. No mental-arithmetic fallback is substituted.']});
  }
  const inputs=request?.inputs;
  if(!inputs||typeof inputs!=='object'||Array.isArray(inputs)){
    return receipt('calculator','QELLY deterministic calculator',{truthState:'input_required',freshness:'not-applicable',source:'QELLY formula engine',data:{definition:definitionSummary(definition)},limitations:['Structured calculator inputs are required. QELLY will not invent missing numeric assumptions.']});
  }
  let result;
  try{result=calculateFormula(formulaId,inputs);}catch(error){
    return receipt('calculator','QELLY deterministic calculator',{truthState:'invalid_input',freshness:'not-applicable',source:'QELLY formula engine',data:{definition:definitionSummary(definition),validationError:bounded(error?.message,300)},limitations:['The deterministic engine rejected the supplied inputs; no substitute result was generated.']});
  }
  if(result?.status!=='success'){
    return receipt('calculator','QELLY deterministic calculator',{truthState:'invalid_input',freshness:'not-applicable',source:'QELLY formula engine',data:{definition:definitionSummary(definition),validationErrors:result?.validationErrors??[]},limitations:['The deterministic engine rejected the supplied inputs; no substitute result was generated.']});
  }
  const outputs=Object.fromEntries(Object.entries(result.outputs||{}).filter(([,value])=>scalar(value)).slice(0,16));
  return receipt('calculator','QELLY deterministic calculator',{
    truthState:'deterministic',
    freshness:'deterministic',
    observedAt:result.calculatedAt??new Date().toISOString(),
    source:`QELLY formula engine · ${result.formulaId} · ${result.formulaVersion}`,
    data:{formulaId:result.formulaId,formulaVersion:result.formulaVersion,inputs,outputs,assumptions:result.assumptions??[]},
    limitations:['This is a deterministic calculation from declared inputs, not a forecast or recommendation.','Only registered formula logic is used; no hidden market assumptions are added.']
  });
}

export function compactDecisionToolReceipt(result){
  if(!result)return receipt('decision-intelligence','QELLY Decision Intelligence',{limitations:['Decision Intelligence did not return a result.']});
  const view=result.qellyView||{},gate=view.evidenceGate||{},news=result.evidence?.news||{},derivatives=result.evidence?.derivatives||{};
  return receipt('decision-intelligence','QELLY Decision Intelligence',{
    truthState:result.truthState||'unavailable',
    freshness:result.freshness?.state||result.truthState||'unavailable',
    observedAt:result.observedAt??null,
    source:result.provenance?.provider||'QELLY Decision Intelligence',
    data:{
      asset:result.asset,interval:result.interval,horizon:result.horizon,lastPrice:result.market?.lastPrice,
      marketState:result.market?.currentState??null,action:view.action??'NO TRADE',confidence:view.confidence??null,
      confidenceMeaning:result.confidence?.calibration??null,riskState:view.riskState??null,scenario:view.scenario??result.forecast?.probabilities??null,
      evidenceGate:gate,contradictions:view.contradictions??[],changesIf:view.changesIf??null,
      multiTimeframe:result.multiTimeframe?.agreement??null,
      derivatives:{state:derivatives.state??'unavailable',fundingPct:derivatives.fundingPct??null,openInterestNotionalUsd:derivatives.openInterestNotionalUsd??null},
      news:{state:news.state??'unavailable',provider:news.provider??null,articles:(news.articles||[]).slice(0,4).map(item=>({title:item.title,source:item.source,publishedAt:item.publishedAt,url:item.url}))}
    },
    limitations:[
      ...(result.provenance?.model?.limitations||[]).slice(0,5),
      'QELLY VIEW is research support only; it does not execute a trade or represent a success probability.'
    ]
  });
}

export const __qellyChatToolsTest=Object.freeze({ASSET_IDS,scalar,bounded,state,definitionSummary});
