import {HttpError,bootstrapContext,cleanText,enforceRateLimit,errorResponse,jsonBody,requireCsrf,resolveSession,responseJson,restRequest} from '../../_lib/runtime.js';
import {canonicalTimezone,recognizedTimezone} from '../../_lib/timezone.js';

const BASE_CURRENCIES=Object.freeze(['USD','INR','EUR','GBP','SGD','AED','JPY']);

const safeTimezone=(value)=>{
  const timezone=canonicalTimezone(value);
  if(!recognizedTimezone(timezone))throw new HttpError(400,'profile_timezone_invalid','Timezone is not recognized');
  return timezone;
};

const safeCurrency=(value)=>{
  const currency=String(value||'').trim().toUpperCase();
  if(!BASE_CURRENCIES.includes(currency))throw new HttpError(400,'profile_currency_invalid','Base currency is not supported');
  return currency;
};

const profilePayload=(context)=>({
  user:{
    userId:context.user.userId,
    email:context.user.email,
    emailConfirmedAt:context.user.emailConfirmedAt,
    displayName:context.profile?.display_name||context.user.displayName||null
  },
  profile:{
    displayName:context.profile?.display_name||null,
    baseCurrency:context.profile?.base_currency||'USD',
    timezone:canonicalTimezone(context.profile?.timezone||'UTC'),
    cloudSyncOptIn:Boolean(context.profile?.cloud_sync_opt_in),
    privacyVersion:context.profile?.privacy_version||null,
    termsVersion:context.profile?.terms_version||null,
    createdAt:context.profile?.created_at||null,
    updatedAt:context.profile?.updated_at||null
  },
  workspace:{
    workspaceId:context.workspace.workspaceId,
    name:context.workspace.name
  },
  session:{...context.session},
  capabilities:{profilePersistence:'cloud-rls',workspacePersistence:'cloud-rls',execution:false}
});

export async function onRequest(context){
  const {request,env}=context;
  try{
    const method=request.method.toUpperCase();
    if(!['GET','PATCH'].includes(method))throw new HttpError(405,'method_not_allowed','Profile endpoint supports GET and PATCH only');
    const session=await resolveSession(request,env,{required:true});
    await enforceRateLimit(env,`user:${session.user.id}:profile`,{limit:90});

    if(method==='GET'){
      const qelly=await bootstrapContext(env,session);
      return responseJson(request,env,profilePayload(qelly),200,{cookies:session.cookies,cache:'private, no-store'});
    }

    await requireCsrf(request);
    const body=await jsonBody(request);
    const patch={updated_at:new Date().toISOString()};
    if(Object.hasOwn(body,'displayName')){
      const displayName=cleanText(body.displayName,80);
      if(!displayName)throw new HttpError(400,'profile_display_name_invalid','Display name is required');
      patch.display_name=displayName;
    }
    if(Object.hasOwn(body,'baseCurrency'))patch.base_currency=safeCurrency(body.baseCurrency);
    if(Object.hasOwn(body,'timezone'))patch.timezone=safeTimezone(body.timezone);
    if(Object.hasOwn(body,'cloudSyncOptIn'))patch.cloud_sync_opt_in=Boolean(body.cloudSyncOptIn);
    if(Object.keys(patch).length===1)throw new HttpError(400,'profile_patch_empty','No supported profile fields were supplied');

    const rows=await restRequest(env,session.accessToken,`qelly_profiles?user_id=eq.${session.user.id}`,{
      method:'PATCH',body:patch,prefer:'return=representation'
    });
    if(!rows?.length)throw new HttpError(404,'profile_not_found','Profile was not found');
    const qelly=await bootstrapContext(env,session);
    return responseJson(request,env,{updated:true,...profilePayload(qelly)},200,{cookies:session.cookies,cache:'private, no-store'});
  }catch(error){return errorResponse(request,env,error);}
}

export const __profileRouteTest=Object.freeze({BASE_CURRENCIES,safeTimezone,safeCurrency,profilePayload});
