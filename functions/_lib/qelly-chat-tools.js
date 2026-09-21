import {calculateFormula,getFormulaDefinition} from '../../apps/web/public/assets/calculation/formula-engine-extended.mjs';
import {buildAssetRankings} from './market-network.js';
import {buildPublicAssetIntelligence} from './public-asset-intelligence.js';
import {buildUniversalSearch} from './public-search.js';

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

const receipt=(id,label,{truthState='unavailable',observedAt=null,source='QELLY',data=null,limitations=[]}={})=>Object.freeze({
  id,label,truthState:state(truthState),observedAt:observedAt??null,source:bounded(source,160),data,
  limitations:Object.freeze((Array.isArray(limitations)?limitations:[]).map(item=>bounded(item,300)).slice(0,8))
});

export function buildSearchToolReceipt(message,sources={}){
  const result=buildUniversalSearch({q:bounded(message,160),limit:8,assetRankings:buildAssetRankings(sources)});
  return receipt('qelly-search','QELLY public search',{
    truthState:'catalog',
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
    return receipt('calculator','QELLY deterministic calculator',{truthState:'input_required',source:'QELLY formula engine',data:{definition:definitionSummary(definition)},limitations:['Structured calculator inputs are required. QELLY will not invent missing numeric assumptions.']});
  }
  let result;
  try{result=calculateFormula(formulaId,inputs);}catch(error){
    return receipt('calculator','QELLY deterministic calculator',{truthState:'invalid_input',source:'QELLY formula engine',data:{definition:definitionSummary(definition),validationError:bounded(error?.message,300)},limitations:['The deterministic engine rejected the supplied inputs; no substitute result was generated.']});
  }
  if(result?.status!=='success'){
    return receipt('calculator','QELLY deterministic calculator',{truthState:'invalid_input',source:'QELLY formula engine',data:{definition:definitionSummary(definition),validationErrors:result?.validationErrors??[]},limitations:['The deterministic engine rejected the supplied inputs; no substitute result was generated.']});
  }
  const outputs=Object.fromEntries(Object.entries(result.outputs||{}).filter(([,value])=>scalar(value)).slice(0,16));
  return receipt('calculator','QELLY deterministic calculator',{
    truthState:'deterministic',
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
