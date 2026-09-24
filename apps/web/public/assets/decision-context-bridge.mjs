export const DECISION_CONTEXT_KEY='qelly.decision.chat-context.v1';
export const DECISION_CONTEXT_MAX_AGE_MS=15*60_000;
export const RESEARCH_CONTEXT_KEY='qelly.research.flow-context.v1';
export const RESEARCH_CONTEXT_MAX_AGE_MS=30*60_000;
export const DECISION_ASSETS=new Set(['BTC','ETH','SOL','HYPE','XRP','DOGE']);
export const DECISION_TIMEFRAMES=new Set(['1m','5m','15m','30m','1h','4h','1d']);

const normalizeAsset=(value)=>{
  const raw=String(value||'').trim().toUpperCase();
  const candidate=raw.startsWith('QI-CRYPTO-')?raw.slice('QI-CRYPTO-'.length):raw;
  return DECISION_ASSETS.has(candidate)?candidate:null;
};
const normalizeTimeframe=(value)=>DECISION_TIMEFRAMES.has(String(value||''))?String(value):null;
const normalizeFormulaId=(value)=>{
  const candidate=String(value||'').trim().toLowerCase();
  return /^[a-z0-9][a-z0-9-]{0,79}$/.test(candidate)?candidate:null;
};
const normalizeSource=(value)=>String(value||'unknown').trim().replace(/[^a-zA-Z0-9_.:-]+/g,'-').slice(0,80)||'unknown';

const parseFreshContext=(storage,key,maxAgeMs)=>{
  try{
    const raw=storage?.getItem(key);
    if(!raw)return null;
    const parsed=JSON.parse(raw);
    const createdAt=Date.parse(parsed?.createdAt||'');
    if(!Number.isFinite(createdAt)||Date.now()-createdAt>maxAgeMs)return null;
    return parsed;
  }catch{return null;}
};

export function storeResearchContext({asset,timeframe='15m',source='unknown',formulaId=null}={}){
  try{
    const normalizedAsset=normalizeAsset(asset);
    const normalizedTimeframe=normalizeTimeframe(timeframe)||'15m';
    if(!normalizedAsset)return false;
    const payload={
      createdAt:new Date().toISOString(),
      asset:normalizedAsset,
      timeframe:normalizedTimeframe,
      source:normalizeSource(source),
      formulaId:normalizeFormulaId(formulaId)
    };
    globalThis.sessionStorage?.setItem(RESEARCH_CONTEXT_KEY,JSON.stringify(payload));
    return true;
  }catch{return false;}
}

export function peekResearchContext({defaultAsset=null,defaultTimeframe='15m'}={}){
  const fallback={
    asset:normalizeAsset(defaultAsset),
    timeframe:normalizeTimeframe(defaultTimeframe)||'15m',
    source:'fallback',
    formulaId:null
  };
  try{
    const parsed=parseFreshContext(globalThis.sessionStorage,RESEARCH_CONTEXT_KEY,RESEARCH_CONTEXT_MAX_AGE_MS);
    if(!parsed)return fallback;
    return {
      asset:normalizeAsset(parsed.asset)||fallback.asset,
      timeframe:normalizeTimeframe(parsed.timeframe)||fallback.timeframe,
      source:normalizeSource(parsed.source),
      formulaId:normalizeFormulaId(parsed.formulaId)
    };
  }catch{return fallback;}
}

export function clearResearchContext(){
  try{globalThis.sessionStorage?.removeItem(RESEARCH_CONTEXT_KEY);}catch{}
}

export function storeDecisionContext({asset,timeframe='15m',source='unknown'}={}){
  try{
    const normalizedAsset=normalizeAsset(asset);
    const normalizedTimeframe=normalizeTimeframe(timeframe)||'15m';
    if(!normalizedAsset)return false;
    globalThis.sessionStorage?.setItem(DECISION_CONTEXT_KEY,JSON.stringify({
      createdAt:new Date().toISOString(),
      asset:normalizedAsset,
      timeframe:normalizedTimeframe,
      source:normalizeSource(source)
    }));
    storeResearchContext({asset:normalizedAsset,timeframe:normalizedTimeframe,source});
    return true;
  }catch{return false;}
}

export function consumeDecisionContext({defaultAsset='BTC',defaultTimeframe='15m'}={}){
  const fallback={
    asset:normalizeAsset(defaultAsset)||'BTC',
    interval:normalizeTimeframe(defaultTimeframe)||'15m'
  };
  try{
    const storage=globalThis.sessionStorage;
    if(!storage)return fallback;
    const parsed=parseFreshContext(storage,DECISION_CONTEXT_KEY,DECISION_CONTEXT_MAX_AGE_MS);
    storage.removeItem(DECISION_CONTEXT_KEY);
    if(!parsed)return fallback;
    return {
      asset:normalizeAsset(parsed?.asset)||fallback.asset,
      interval:normalizeTimeframe(parsed?.timeframe)||fallback.interval
    };
  }catch{return fallback;}
}

export const __decisionContextBridgeTest=Object.freeze({
  normalizeAsset,normalizeTimeframe,normalizeFormulaId,normalizeSource,parseFreshContext
});
