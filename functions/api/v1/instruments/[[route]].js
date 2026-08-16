import {HttpError,enforceRateLimit,errorResponse,jsonBody,requireCsrf,resolveSession,responseJson} from '../../../_lib/runtime.js';
import {filterSnapshotItems,marketDataSnapshot,normalizedQuery,snapshotLimit} from '../../../_lib/market-data-snapshot.js';

const compatibilityInstrument=(item)=>({
  canonicalId:item.canonicalKey,
  canonicalKey:item.canonicalKey,
  instrumentId:item.instrumentId,
  primarySymbol:item.symbol,
  symbol:item.symbol,
  name:item.displayName||item.symbol,
  displayName:item.displayName||item.symbol,
  assetClass:item.assetClass,
  status:'active',
  currency:item.currency||item.quoteAsset||null,
  jurisdiction:item.venue==='ECB'?'EU reference':null,
  sector:item.assetClass==='fx'?'Foreign exchange':null,
  precision:6,
  symbols:[item.symbol],
  relationships:[],
  venue:item.venue||null,
  baseAsset:item.baseAsset||null,
  quoteAsset:item.quoteAsset||null,
  seriesKey:item.seriesKey||null,
  metric:item.metric||null,
  interval:item.interval||null,
  unit:item.unit||null,
  value:item.value??null,
  truthState:String(item.truthState||'UNAVAILABLE').toUpperCase(),
  observedAt:item.observedAt||null,
  ingestedAt:item.ingestedAt||null,
  evidence:item.evidence||{}
});

const summaryFor=(snapshot)=>{
  const items=Array.isArray(snapshot.items)?snapshot.items:[];
  const byAssetClass=[...new Set(items.map((item)=>item.assetClass).filter(Boolean))].sort().map((assetClass)=>({assetClass,count:items.filter((item)=>item.assetClass===assetClass).length}));
  const venues=new Set(items.map((item)=>item.venue).filter(Boolean));
  const revisions=items.map((item)=>item.sourceRevision).filter(Boolean).sort();
  return {
    systemOfRecord:'Supabase governed instrument data plane',
    revision:revisions.at(-1)||snapshot.generatedAt,
    productionReferenceData:true,
    instruments:Number(snapshot.dataPlane?.instrumentCount)||items.length,
    byAssetClass,
    venues:venues.size,
    calendars:0,
    truthBoundary:snapshot.truthBoundary,
    latestObservedAt:snapshot.dataPlane?.latestObservedAt||null,
    latestIngestedAt:snapshot.dataPlane?.latestIngestedAt||null,
    execution:false
  };
};

const resolveCandidates=(items,{symbol,canonicalId,assetClass}={})=>{
  const requested=normalizedQuery(symbol||canonicalId);
  if(!requested)return [];
  return (Array.isArray(items)?items:[]).map((item)=>{
    const symbolMatch=normalizedQuery(item.symbol)===requested;
    const canonicalMatch=normalizedQuery(item.canonicalKey)===requested;
    const classMatch=!assetClass||String(item.assetClass||'').toLowerCase()===String(assetClass).toLowerCase();
    if((!symbolMatch&&!canonicalMatch)||!classMatch)return null;
    const confidence=canonicalMatch?1:symbolMatch?.99:0;
    return {
      canonicalId:item.canonicalKey,
      instrumentId:item.instrumentId,
      primarySymbol:item.symbol,
      name:item.displayName||item.symbol,
      assetClass:item.assetClass,
      confidence,
      reasons:[canonicalMatch?'exact canonical key':'exact governed symbol',assetClass?'asset class matched':'governed active instrument'],
      truthState:String(item.truthState||'UNAVAILABLE').toUpperCase(),
      observedAt:item.observedAt||null
    };
  }).filter(Boolean).sort((a,b)=>b.confidence-a.confidence);
};

export async function onRequest(context){
  const {request,env}=context;
  try{
    const method=request.method.toUpperCase();
    if(!['GET','POST'].includes(method))throw new HttpError(405,'method_not_allowed','Instrument endpoints are read-only');
    const session=await resolveSession(request,env,{required:true});
    const url=new URL(request.url);
    const routeName=Array.isArray(context.params?.route)?context.params.route.join('/'):String(context.params?.route||'');
    await enforceRateLimit(env,`user:${session.user.id}:instruments:${routeName||'list'}`,{limit:120});
    const snapshot=await marketDataSnapshot(env,session,{limit:snapshotLimit(url.searchParams.get('limit')||200)});

    if(routeName==='summary'&&method==='GET')return responseJson(request,env,summaryFor(snapshot),200,{cookies:session.cookies,cache:'private, no-store'});

    if(routeName==='search'&&method==='GET'){
      const items=filterSnapshotItems(snapshot.items,{assetClass:url.searchParams.get('assetClass'),symbol:url.searchParams.get('symbol'),query:url.searchParams.get('q')}).map(compatibilityInstrument);
      return responseJson(request,env,{items,total:items.length,generatedAt:snapshot.generatedAt,dataPlane:snapshot.dataPlane,truthBoundary:snapshot.truthBoundary,productionReferenceData:true,execution:false},200,{cookies:session.cookies,cache:'private, no-store'});
    }

    if(routeName==='resolve'&&method==='POST'){
      await requireCsrf(request);
      const body=await jsonBody(request);
      const candidates=resolveCandidates(snapshot.items,body);
      return responseJson(request,env,{
        resolved:candidates.length===1&&candidates[0].confidence>=.99,
        candidates,
        truthState:candidates.length?'GOVERNED':'UNAVAILABLE',
        reason:candidates.length?null:'No governed production instrument matches the requested identity.',
        generatedAt:snapshot.generatedAt,
        execution:false
      },200,{cookies:session.cookies,cache:'private, no-store'});
    }

    if(routeName.endsWith('/relationships')&&method==='GET'){
      const identity=decodeURIComponent(routeName.slice(0,-'/relationships'.length));
      const item=filterSnapshotItems(snapshot.items,{symbol:identity})[0]||snapshot.items.find((candidate)=>normalizedQuery(candidate.canonicalKey)===normalizedQuery(identity))||null;
      return responseJson(request,env,{
        canonicalId:item?.canonicalKey||identity,
        instrument:item?compatibilityInstrument(item):null,
        outgoing:[],
        incoming:[],
        total:0,
        truthState:'UNAVAILABLE',
        reason:'Typed cross-instrument relationship graph is not populated in the governed production data plane.',
        generatedAt:snapshot.generatedAt,
        execution:false
      },200,{cookies:session.cookies,cache:'private, no-store'});
    }

    if(routeName&&method==='GET'){
      const requested=decodeURIComponent(routeName);
      const item=filterSnapshotItems(snapshot.items,{symbol:requested})[0]||snapshot.items.find((candidate)=>normalizedQuery(candidate.canonicalKey)===normalizedQuery(requested))||null;
      if(!item)throw new HttpError(404,'instrument_not_found','Instrument was not found in the governed production data plane');
      return responseJson(request,env,{item:compatibilityInstrument(item),generatedAt:snapshot.generatedAt,truthBoundary:snapshot.truthBoundary,providerState:snapshot.providers,execution:false},200,{cookies:session.cookies,cache:'private, no-store'});
    }

    if(method!=='GET')throw new HttpError(405,'method_not_allowed','Instrument endpoint is read-only');
    const items=filterSnapshotItems(snapshot.items,{assetClass:url.searchParams.get('assetClass'),symbol:url.searchParams.get('symbol'),query:url.searchParams.get('q')}).map(compatibilityInstrument);
    return responseJson(request,env,{items,total:items.length,generatedAt:snapshot.generatedAt,dataPlane:snapshot.dataPlane,truthBoundary:snapshot.truthBoundary,execution:false},200,{cookies:session.cookies,cache:'private, no-store'});
  }catch(error){
    return errorResponse(request,env,error);
  }
}

export const __instrumentRouteTest=Object.freeze({compatibilityInstrument,summaryFor,resolveCandidates});
