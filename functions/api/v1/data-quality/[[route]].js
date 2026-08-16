import {HttpError,enforceRateLimit,errorResponse,resolveSession,responseJson} from '../../../_lib/runtime.js';
import {marketDataSnapshot} from '../../../_lib/market-data-snapshot.js';

export async function onRequest(context){
  const {request,env}=context;
  try{
    if(request.method.toUpperCase()!=='GET')throw new HttpError(405,'method_not_allowed','Data-quality endpoints are read-only');
    const session=await resolveSession(request,env,{required:true});
    const routeName=Array.isArray(context.params?.route)?context.params.route.join('/'):String(context.params?.route||'');
    if(routeName&&!['status','events','providers'].includes(routeName))throw new HttpError(404,'data_quality_route_not_found','Data-quality endpoint was not found');
    await enforceRateLimit(env,`user:${session.user.id}:data-quality:${routeName||'status'}`,{limit:90});
    const snapshot=await marketDataSnapshot(env,session,{limit:1});

    const common={
      generatedAt:snapshot.generatedAt,
      truthBoundary:snapshot.truthBoundary,
      dataPlane:snapshot.dataPlane,
      execution:false
    };
    if(routeName==='events')return responseJson(request,env,{...common,quality:snapshot.quality},200,{cookies:session.cookies,cache:'private, no-store'});
    if(routeName==='providers')return responseJson(request,env,{...common,providers:snapshot.providers},200,{cookies:session.cookies,cache:'private, no-store'});
    return responseJson(request,env,{...common,quality:snapshot.quality,providers:snapshot.providers,releaseIdentity:snapshot.releaseIdentity},200,{cookies:session.cookies,cache:'private, no-store'});
  }catch(error){
    return errorResponse(request,env,error);
  }
}
