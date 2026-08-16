import {HttpError,enforceRateLimit,errorResponse,resolveSession,responseJson} from '../../../_lib/runtime.js';
import {marketDataSnapshot} from '../../../_lib/market-data-snapshot.js';

const incidentItems=(quality={})=>(Array.isArray(quality.recent)?quality.recent:[]).map((item,index)=>({
  id:`quality-${index}-${String(item.detectedAt||'unknown')}`,
  eventType:item.eventType||'unknown',
  type:item.eventType||'unknown',
  severity:item.severity||'warning',
  truthState:String(item.truthState||'UNAVAILABLE').toUpperCase(),
  status:item.resolvedAt?'resolved':'open',
  detectedAt:item.detectedAt||null,
  resolvedAt:item.resolvedAt||null
}));

export async function onRequest(context){
  const {request,env}=context;
  try{
    if(request.method.toUpperCase()!=='GET')throw new HttpError(405,'method_not_allowed','Data-quality endpoints are read-only');
    const session=await resolveSession(request,env,{required:true});
    const routeName=Array.isArray(context.params?.route)?context.params.route.join('/'):String(context.params?.route||'');
    if(routeName&&!['status','events','incidents','providers'].includes(routeName))throw new HttpError(404,'data_quality_route_not_found','Data-quality endpoint was not found');
    await enforceRateLimit(env,`user:${session.user.id}:data-quality:${routeName||'status'}`,{limit:90});
    const snapshot=await marketDataSnapshot(env,session,{limit:1});

    const common={
      generatedAt:snapshot.generatedAt,
      truthBoundary:snapshot.truthBoundary,
      dataPlane:snapshot.dataPlane,
      execution:false
    };
    if(routeName==='events'||routeName==='incidents'){
      const items=incidentItems(snapshot.quality);
      return responseJson(request,env,{...common,items,total:items.length,openCount:Number(snapshot.quality?.openCount)||0,quality:snapshot.quality},200,{cookies:session.cookies,cache:'private, no-store'});
    }
    if(routeName==='providers')return responseJson(request,env,{...common,providers:snapshot.providers},200,{cookies:session.cookies,cache:'private, no-store'});
    return responseJson(request,env,{...common,quality:snapshot.quality,items:incidentItems(snapshot.quality),providers:snapshot.providers,releaseIdentity:snapshot.releaseIdentity},200,{cookies:session.cookies,cache:'private, no-store'});
  }catch(error){
    return errorResponse(request,env,error);
  }
}

export const __dataQualityRouteTest=Object.freeze({incidentItems});
