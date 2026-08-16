import {HttpError,UUID,cleanText,jsonBody,requireCsrf,responseJson,restRequest} from './runtime.js';

const INSTRUMENTS=Object.freeze({
  'QI-CRYPTO-BTC':Object.freeze({symbol:'BTC',name:'Bitcoin',assetClass:'crypto'}),
  'QI-CRYPTO-ETH':Object.freeze({symbol:'ETH',name:'Ethereum',assetClass:'crypto'}),
  'QI-EQUITY-AAPL':Object.freeze({symbol:'AAPL',name:'Apple',assetClass:'equity'}),
  'QI-EQUITY-NVDA':Object.freeze({symbol:'NVDA',name:'NVIDIA',assetClass:'equity'}),
  'QI-FUND-QQQ':Object.freeze({symbol:'QQQ',name:'Invesco QQQ',assetClass:'fund'}),
  'QI-COMMODITY-GOLD':Object.freeze({symbol:'GOLD',name:'Gold',assetClass:'commodity'}),
  'QI-INDEX-SPX':Object.freeze({symbol:'SPX',name:'S&P 500',assetClass:'index'}),
  'QI-FX-USDINR':Object.freeze({symbol:'USDINR',name:'USD / INR',assetClass:'fx'})
});

const ensureUuid=(value,label='Identifier')=>{
  const id=String(value||'');
  if(!UUID.test(id))throw new HttpError(400,'watchlist_id_invalid',`${label} is invalid`);
  return id;
};
const safeInstrumentRef=(value)=>{
  const ref=cleanText(value,240).toUpperCase();
  if(!/^QI-[A-Z0-9]+(?:-[A-Z0-9]+)+$/.test(ref))throw new HttpError(400,'watchlist_instrument_invalid','Canonical instrument reference is invalid');
  return ref;
};
const instrumentDescriptor=(ref)=>{
  const known=INSTRUMENTS[ref];
  if(known)return known;
  const parts=ref.split('-');
  return {symbol:parts.at(-1)||ref,name:ref,assetClass:String(parts[1]||'unknown').toLowerCase()};
};
const quoteUnavailable=()=>Object.freeze({
  price:null,
  change24h:null,
  high24h:null,
  low24h:null,
  volume24h:null,
  freshnessClass:'unavailable',
  truthState:'UNAVAILABLE',
  observedAt:null,
  provider:null,
  attribution:'No rights-approved quote observation is attached to this watchlist item.'
});

export const watchlistItemToUi=(row)=>{
  const descriptor=instrumentDescriptor(row.instrument_ref);
  return {
    itemId:row.id,
    canonicalId:row.instrument_ref,
    symbol:descriptor.symbol,
    name:descriptor.name,
    assetClass:descriptor.assetClass,
    group:row.metadata?.group||'Research queue',
    note:row.notes||'',
    tags:Array.isArray(row.tags)?row.tags:[],
    rationale:row.rationale||{},
    createdAt:row.created_at,
    updatedAt:row.updated_at,
    quote:quoteUnavailable(),
    freshnessClass:'unavailable',
    truthState:'CLOUD RLS'
  };
};

export const watchlistToUi=(row,items=[])=>({
  watchlistId:row.id,
  name:row.name,
  description:row.description||'',
  settings:row.settings||{},
  createdAt:row.created_at,
  updatedAt:row.updated_at,
  revision:null,
  persistence:'CLOUD RLS',
  cloudSync:true,
  sharing:'workspace-membership',
  quoteTruthState:'UNAVAILABLE',
  items:items.map(watchlistItemToUi)
});

async function watchlistRows(env,session,workspaceId,{watchlistId=null,limit=100}={}){
  const params=new URLSearchParams({select:'*',workspace_id:`eq.${workspaceId}`,deleted_at:'is.null',order:'updated_at.desc',limit:String(limit)});
  if(watchlistId)params.set('id',`eq.${watchlistId}`);
  return restRequest(env,session.accessToken,`qelly_watchlists?${params.toString()}`);
}
async function itemRows(env,session,workspaceId,watchlistId){
  const params=new URLSearchParams({select:'*',workspace_id:`eq.${workspaceId}`,watchlist_id:`eq.${watchlistId}`,order:'created_at.asc',limit:'500'});
  return restRequest(env,session.accessToken,`qelly_watchlist_items?${params.toString()}`);
}
async function requireWatchlist(env,session,qelly,watchlistId){
  const rows=await watchlistRows(env,session,qelly.workspace.workspaceId,{watchlistId,limit:1});
  if(!rows?.length)throw new HttpError(404,'watchlist_not_found','Watchlist was not found');
  return rows[0];
}

export async function handleWatchlistRoot(context,method,session,qelly){
  const {request,env}=context;
  const workspaceId=qelly.workspace.workspaceId;
  if(method==='GET'){
    const rows=await watchlistRows(env,session,workspaceId,{limit:100});
    return responseJson(request,env,{items:(rows||[]).map((row)=>watchlistToUi(row)),persistence:'CLOUD RLS',cloudSync:true,quoteTruthState:'UNAVAILABLE',updatedAt:new Date().toISOString()});
  }
  if(method==='POST'){
    await requireCsrf(request);
    const body=await jsonBody(request);
    const name=cleanText(body.name,160);
    if(!name)throw new HttpError(400,'watchlist_name_required','Watchlist name is required');
    const rows=await restRequest(env,session.accessToken,'qelly_watchlists',{method:'POST',body:{workspace_id:workspaceId,owner_id:qelly.user.userId,name,description:cleanText(body.description,1200)||null,settings:body.settings&&typeof body.settings==='object'&&!Array.isArray(body.settings)?body.settings:{}},prefer:'return=representation'});
    if(!rows?.[0])throw new HttpError(409,'watchlist_create_failed','Watchlist could not be created');
    return responseJson(request,env,{item:watchlistToUi(rows[0])},201);
  }
  return null;
}

export async function handleWatchlistNested(context,relative,method,session,qelly){
  const {request,env}=context;
  const segments=String(relative||'').split('/').filter(Boolean);
  const watchlistId=ensureUuid(segments[0],'Watchlist identifier');
  const suffix=segments.slice(1).join('/');
  const workspaceId=qelly.workspace.workspaceId;

  if(!suffix&&method==='GET'){
    const watchlist=await requireWatchlist(env,session,qelly,watchlistId);
    const items=await itemRows(env,session,workspaceId,watchlistId);
    return responseJson(request,env,watchlistToUi(watchlist,items||[]));
  }
  if(!suffix&&method==='DELETE'){
    await requireCsrf(request);
    await requireWatchlist(env,session,qelly,watchlistId);
    await restRequest(env,session.accessToken,`qelly_watchlists?id=eq.${watchlistId}&workspace_id=eq.${workspaceId}`,{method:'PATCH',body:{deleted_at:new Date().toISOString()},prefer:'return=minimal'});
    return responseJson(request,env,{deleted:true,watchlistId});
  }
  if(suffix==='items'&&method==='POST'){
    await requireCsrf(request);
    await requireWatchlist(env,session,qelly,watchlistId);
    const body=await jsonBody(request);
    const canonicalId=safeInstrumentRef(body.canonicalId||body.instrumentRef);
    const descriptor=instrumentDescriptor(canonicalId);
    let rows;
    try{
      rows=await restRequest(env,session.accessToken,'qelly_watchlist_items',{method:'POST',body:{watchlist_id:watchlistId,workspace_id:workspaceId,owner_id:qelly.user.userId,instrument_ref:canonicalId,instrument_type:descriptor.assetClass,notes:cleanText(body.note,400)||null,tags:Array.isArray(body.tags)?body.tags.slice(0,20).map((value)=>cleanText(value,40)).filter(Boolean):[],rationale:body.rationale&&typeof body.rationale==='object'&&!Array.isArray(body.rationale)?body.rationale:{},metadata:{group:cleanText(body.group,60)||'Research queue'}},prefer:'return=representation'});
    }catch(error){
      if(String(error?.message||'').toLowerCase().includes('duplicate')||String(error?.code||'').includes('23505'))throw new HttpError(409,'watchlist_item_exists','Instrument already exists in this watchlist');
      throw error;
    }
    if(!rows?.[0])throw new HttpError(409,'watchlist_item_create_failed','Watchlist item could not be created');
    return responseJson(request,env,{item:watchlistItemToUi(rows[0])},201);
  }
  if(segments[1]==='items'&&segments[2]&&segments.length===3&&method==='DELETE'){
    await requireCsrf(request);
    await requireWatchlist(env,session,qelly,watchlistId);
    const canonicalId=safeInstrumentRef(decodeURIComponent(segments[2]));
    const params=new URLSearchParams({watchlist_id:`eq.${watchlistId}`,workspace_id:`eq.${workspaceId}`,instrument_ref:`eq.${canonicalId}`});
    await restRequest(env,session.accessToken,`qelly_watchlist_items?${params.toString()}`,{method:'DELETE',prefer:'return=minimal'});
    return responseJson(request,env,{deleted:true,watchlistId,canonicalId});
  }
  return null;
}

export const __watchlistTest=Object.freeze({ensureUuid,safeInstrumentRef,instrumentDescriptor,quoteUnavailable});
