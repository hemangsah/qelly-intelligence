import {HttpError,restRequest} from './runtime.js';

export const snapshotLimit=(value)=>Math.max(1,Math.min(Number(value)||100,200));

export async function marketDataSnapshot(env,session,{limit=100}={}){
  const result=await restRequest(env,session.accessToken,'rpc/qelly_market_data_snapshot',{
    method:'POST',
    body:{p_limit:snapshotLimit(limit)}
  });
  if(!result||typeof result!=='object'||Array.isArray(result))throw new HttpError(503,'market_data_snapshot_invalid','Governed market-data snapshot is unavailable',{retryable:true});
  return {
    generatedAt:result.generatedAt||new Date().toISOString(),
    truthBoundary:result.truthBoundary||'Governed read-only market observations.',
    execution:false,
    dataPlane:result.dataPlane||{},
    providers:Array.isArray(result.providers)?result.providers:[],
    items:Array.isArray(result.items)?result.items:[],
    quality:result.quality&&typeof result.quality==='object'?result.quality:{openCount:0,recent:[]},
    releaseIdentity:result.releaseIdentity||null
  };
}

export const normalizedQuery=(value)=>String(value||'').trim().toUpperCase().slice(0,80);

export function filterSnapshotItems(items,{assetClass,symbol,query}={}){
  const classFilter=String(assetClass||'').trim().toLowerCase();
  const symbolFilter=normalizedQuery(symbol);
  const textFilter=normalizedQuery(query);
  return (Array.isArray(items)?items:[]).filter((item)=>{
    if(classFilter&&String(item.assetClass||'').toLowerCase()!==classFilter)return false;
    if(symbolFilter&&normalizedQuery(item.symbol)!==symbolFilter&&normalizedQuery(item.canonicalKey)!==symbolFilter)return false;
    if(textFilter){
      const haystack=[item.symbol,item.displayName,item.canonicalKey,item.baseAsset,item.quoteAsset,item.venue].map(normalizedQuery).join(' ');
      if(!haystack.includes(textFilter))return false;
    }
    return true;
  });
}

export const __marketDataSnapshotTest=Object.freeze({snapshotLimit,normalizedQuery,filterSnapshotItems});
