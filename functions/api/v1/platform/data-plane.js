import {enforceRateLimit,errorResponse,publicRuntimeConfig,resolveSession,responseJson} from '../../../_lib/runtime.js';
import {marketDataSnapshot,snapshotLimit} from '../../../_lib/market-data-snapshot.js';

const releaseCongruence=(runtime,snapshot)=>{
  const runtimeSha=String(runtime.releaseSha||'').toLowerCase();
  const recordedSha=String(snapshot.releaseIdentity?.sourceRevision||'').toLowerCase();
  if(!recordedSha)return {state:'UNVERIFIED',runtimeSha,recordedSha:null,reason:'No persisted production release identity is available.'};
  if(runtimeSha&&runtimeSha===recordedSha)return {state:'MATCH',runtimeSha,recordedSha,reason:null};
  return {state:'MISMATCH',runtimeSha,recordedSha,reason:'Cloudflare runtime SHA and persisted production release identity do not match.'};
};

export async function onRequest(context){
  const {request,env}=context;
  try{
    if(request.method.toUpperCase()!=='GET')return context.next();
    const session=await resolveSession(request,env,{required:true});
    await enforceRateLimit(env,`user:${session.user.id}:platform/data-plane`,{limit:90});
    const url=new URL(request.url);
    const snapshot=await marketDataSnapshot(env,session,{limit:snapshotLimit(url.searchParams.get('limit'))});
    const runtime=publicRuntimeConfig(env,request.url);
    return responseJson(request,env,{
      ...snapshot,
      canonicalRuntime:'cloudflare-pages-functions',
      releaseSha:runtime.releaseSha,
      environment:runtime.environment,
      canonicalSite:runtime.publicSiteUrl,
      releaseCongruence:releaseCongruence(runtime,snapshot),
      guardrails:{readOnly:true,execution:false,rawProviderCacheExposed:false,browserDirectPrivilegedTableAccess:false}
    },200,{cookies:session.cookies,cache:'private, no-store'});
  }catch(error){
    return errorResponse(request,env,error);
  }
}

export const __dataPlaneRouteTest=Object.freeze({releaseCongruence});
