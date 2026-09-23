export const DECISION_CONTEXT_KEY='qelly.decision.chat-context.v1';
export const DECISION_CONTEXT_MAX_AGE_MS=15*60_000;
export const DECISION_ASSETS=new Set(['BTC','ETH','SOL','HYPE','XRP','DOGE']);
export const DECISION_TIMEFRAMES=new Set(['1m','5m','15m','30m','1h','4h','1d']);

const normalizeAsset=(value)=>{
  const raw=String(value||'').trim().toUpperCase();
  const candidate=raw.startsWith('QI-CRYPTO-')?raw.slice('QI-CRYPTO-'.length):raw;
  return DECISION_ASSETS.has(candidate)?candidate:null;
};
const normalizeTimeframe=(value)=>DECISION_TIMEFRAMES.has(String(value||''))?String(value):null;

export function storeDecisionContext({asset,timeframe='15m',source='unknown'}={}){
  try{
    const normalizedAsset=normalizeAsset(asset);
    const normalizedTimeframe=normalizeTimeframe(timeframe)||'15m';
    if(!normalizedAsset)return false;
    globalThis.sessionStorage?.setItem(DECISION_CONTEXT_KEY,JSON.stringify({
      createdAt:new Date().toISOString(),
      asset:normalizedAsset,
      timeframe:normalizedTimeframe,
      source:String(source||'unknown').slice(0,80)
    }));
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
    const raw=storage.getItem(DECISION_CONTEXT_KEY);
    if(!raw)return fallback;
    storage.removeItem(DECISION_CONTEXT_KEY);
    const parsed=JSON.parse(raw);
    const createdAt=Date.parse(parsed?.createdAt||'');
    if(!Number.isFinite(createdAt)||Date.now()-createdAt>DECISION_CONTEXT_MAX_AGE_MS)return fallback;
    return {
      asset:normalizeAsset(parsed?.asset)||fallback.asset,
      interval:normalizeTimeframe(parsed?.timeframe)||fallback.interval
    };
  }catch{return fallback;}
}

export const __decisionContextBridgeTest=Object.freeze({normalizeAsset,normalizeTimeframe});
