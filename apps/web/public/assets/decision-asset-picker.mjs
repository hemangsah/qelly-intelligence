export const DECISION_ASSET_FAVORITES_KEY='qelly.decision.asset-favorites.v1';
export const DECISION_ASSET_RECENT_KEY='qelly.decision.asset-recent.v1';
const MAX_RECENT=6;
const normalize=(value)=>[...new Set((Array.isArray(value)?value:[]).map((item)=>String(item||'').trim().toUpperCase()).filter((item)=>/^[A-Z0-9-]{2,20}$/.test(item)))];

const read=(storage,key)=>{
  try{return normalize(JSON.parse(storage?.getItem?.(key)||'[]'));}catch{return [];}
};
const write=(storage,key,value)=>{
  try{storage?.setItem?.(key,JSON.stringify(normalize(value)));}catch{}
};

export const readDecisionAssetPreferences=(storage=globalThis.localStorage)=>({
  favorites:read(storage,DECISION_ASSET_FAVORITES_KEY),
  recent:read(storage,DECISION_ASSET_RECENT_KEY).slice(0,MAX_RECENT)
});

export const saveDecisionAssetPreferences=({favorites=[],recent=[]}={},storage=globalThis.localStorage)=>{
  const next={favorites:normalize(favorites),recent:normalize(recent).slice(0,MAX_RECENT)};
  write(storage,DECISION_ASSET_FAVORITES_KEY,next.favorites);
  write(storage,DECISION_ASSET_RECENT_KEY,next.recent);
  return next;
};

export const toggleDecisionAssetFavorite=(favorites,symbol)=>{
  const resolved=String(symbol||'').trim().toUpperCase(),items=normalize(favorites);
  return items.includes(resolved)?items.filter((item)=>item!==resolved):[...items,resolved];
};

export const recordDecisionAssetRecent=(recent,symbol)=>{
  const resolved=String(symbol||'').trim().toUpperCase();
  return normalize([resolved,...normalize(recent).filter((item)=>item!==resolved)]).slice(0,MAX_RECENT);
};

export const decisionAssetSearchText=(group,asset=null)=>[
  group?.id,group?.label,group?.assetClass,group?.state,group?.reason,
  asset?.symbol,asset?.name,asset?.assetClass,asset?.category,asset?.region,asset?.venue,asset?.providerStatus
].filter(Boolean).join(' ').toLowerCase();
