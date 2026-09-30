export const QELLY_CHAT_CONTEXT_EVENT='qelly:chat-context';

const CHAT_MODES=new Set(['ask','research','compare','explain','calculate','decision','asset','india']);
const ROUTE_DEFAULTS=Object.freeze({
  'decision-provenance':{contextType:'decision',kicker:'DECISION INTELLIGENCE',label:'Explain this Decision',meta:'Current setup, evidence and calibration',mode:'decision'},
  market:{contextType:'market-pulse',kicker:'MARKET PULSE',label:'Summarize this Market Pulse',meta:'Moves, drivers, events and freshness',mode:'research'},
  asset:{contextType:'asset-dossier',kicker:'ASSET DOSSIER',label:'Analyze this asset',meta:'Evidence, risks and source state',mode:'asset'},
  'calculator-center':{contextType:'calculator',kicker:'QELLY TOOLS',label:'Help me use this calculator',meta:'Inputs, outputs and assumptions',mode:'calculate'},
  'calculator-detail':{contextType:'calculator',kicker:'QELLY TOOLS',label:'Explain this calculation',meta:'Inputs, outputs and assumptions',mode:'calculate'},
  'formula-detail':{contextType:'formula',kicker:'QELLY FORMULA',label:'Explain this formula',meta:'Inputs, outputs and assumptions',mode:'calculate'},
  'formula-library':{contextType:'formula-library',kicker:'QELLY FORMULAS',label:'Find a formula with QELLY',meta:'Deterministic finance tools',mode:'calculate'},
  'news-research':{contextType:'qelly-chat',kicker:'QELLY CHAT',label:'Ask QELLY',meta:'Grounded market intelligence',mode:'ask'},
  'live-markets':{contextType:'live-markets',kicker:'LIVE MARKETS',label:'Explain this market view',meta:'Coverage, freshness and source state',mode:'research'},
  search:{contextType:'search',kicker:'QELLY SEARCH',label:'Explain these results',meta:'Assets, features and evidence',mode:'research'}
});
const FALLBACK=Object.freeze({contextType:'page',kicker:'QELLY',label:'Explain this page',meta:'Grounded in this QELLY workspace',mode:'ask'});
const bounded=(value,max)=>typeof value==='string'?value.trim().slice(0,max):'';

export const routeFromHash=(hash=globalThis.location?.hash||'')=>String(hash).replace(/^#\/?/,'').split(/[/?#]/)[0]||'';

export function defaultQellyChatContext(route=routeFromHash()){
  const safeRoute=bounded(route,80);
  return {route:safeRoute,...(ROUTE_DEFAULTS[safeRoute]||FALLBACK),quickPrompts:[]};
}

export function normalizeQellyChatPageContext(value,{route=routeFromHash()}={}){
  const requestedRoute=bounded(value?.route,80)||bounded(route,80);
  const base=defaultQellyChatContext(requestedRoute);
  if(!value||typeof value!=='object'||Array.isArray(value))return base;
  const quickPrompts=Array.isArray(value.quickPrompts)
    ?value.quickPrompts.map(item=>bounded(item,420)).filter(Boolean).slice(0,4)
    :[];
  return {
    route:requestedRoute,
    contextType:bounded(value.contextType,64)||base.contextType,
    kicker:bounded(value.kicker,80)||base.kicker,
    label:bounded(value.label,120)||base.label,
    meta:bounded(value.meta,160)||base.meta,
    mode:CHAT_MODES.has(String(value.mode||''))?String(value.mode):base.mode,
    asset:bounded(value.asset,24)||undefined,
    timeframe:bounded(value.timeframe,16)||undefined,
    calculatorId:bounded(value.calculatorId,80)||undefined,
    decisionContext:value.decisionContext&&typeof value.decisionContext==='object'&&!Array.isArray(value.decisionContext)?value.decisionContext:undefined,
    quickPrompts
  };
}

export function publishQellyChatContext(detail={}){
  if(typeof document==='undefined')return;
  document.dispatchEvent(new CustomEvent(QELLY_CHAT_CONTEXT_EVENT,{detail:normalizeQellyChatPageContext(detail)}));
}

export const __qellyChatContextTest=Object.freeze({ROUTE_DEFAULTS,FALLBACK,CHAT_MODES});
