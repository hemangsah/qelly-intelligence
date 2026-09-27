import {decisionAssetCapabilities} from '../../_lib/decision-asset-capabilities.js';
import {responseJson} from '../../_lib/runtime.js';

export async function onRequest(context){
  const {request,env}=context;
  if(request.method.toUpperCase()!=='GET')return context.next();
  return responseJson(request,env,{...decisionAssetCapabilities(),generatedAt:new Date().toISOString()},200,{cache:'public, max-age=60, stale-while-revalidate=300'});
}

export const __decisionAssetsTest=Object.freeze({decisionAssetCapabilities});
