import {HttpError,enforceRateLimit,errorResponse,resolveSession,responseJson} from '../../../_lib/runtime.js';
import {filterSnapshotItems,marketDataSnapshot,snapshotLimit} from '../../../_lib/market-data-snapshot.js';

export async function onRequest(context){
  const {request,env}=context;
  try{
    if(request.method.toUpperCase()!=='GET')throw new HttpError(405,'method_not_allowed','Instrument endpoints are read-only');
    const session=await resolveSession(request,env,{required:true});
    const url=new URL(request.url);
    const routeName=Array.isArray(context.params?.route)?context.params.route.join('/'):String(context.params?.route||'');
    await enforceRateLimit(env,`user:${session.user.id}:instruments:${routeName||'list'}`,{limit:120});

    const snapshot=await marketDataSnapshot(env,session,{limit:snapshotLimit(url.searchParams.get('limit')||200)});
    const requestedSymbol=routeName?decodeURIComponent(routeName):url.searchParams.get('symbol');
    const items=filterSnapshotItems(snapshot.items,{
      assetClass:url.searchParams.get('assetClass'),
      symbol:requestedSymbol,
      query:url.searchParams.get('q')
    });

    if(routeName){
      const item=items[0]||null;
      if(!item)throw new HttpError(404,'instrument_not_found','Instrument was not found in the governed production data plane');
      return responseJson(request,env,{
        item,
        generatedAt:snapshot.generatedAt,
        truthBoundary:snapshot.truthBoundary,
        providerState:snapshot.providers,
        execution:false
      },200,{cookies:session.cookies,cache:'private, no-store'});
    }

    return responseJson(request,env,{
      items,
      total:items.length,
      generatedAt:snapshot.generatedAt,
      dataPlane:snapshot.dataPlane,
      truthBoundary:snapshot.truthBoundary,
      execution:false
    },200,{cookies:session.cookies,cache:'private, no-store'});
  }catch(error){
    return errorResponse(request,env,error);
  }
}
