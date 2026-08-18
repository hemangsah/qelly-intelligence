import {HttpError,errorResponse,publicRuntimeConfig,requireOrigin} from '../../../_lib/runtime.js';
import {emailDeliveryAvailable} from '../../../_lib/email-capability.js';
import {safeBaseCurrency,safeTimezone} from '../../../_lib/profile-preferences.js';
import {handleAuth} from '../../../_lib/auth.js';

export async function onRequest(context){
  const {request,env}=context;
  try{
    requireOrigin(request,env);
    const method=request.method.toUpperCase();
    if(publicRuntimeConfig(env,request.url).capabilities.authentication!==true)throw new HttpError(503,'auth_runtime_unavailable','Authentication is disabled in the current runtime configuration.',{retryable:false});
    if(method==='POST'){
      if(!emailDeliveryAvailable(env,request.url))throw new HttpError(503,'auth_email_delivery_unavailable','Account creation is temporarily unavailable until transactional email delivery is proven.',{retryable:false});
      const body=await request.clone().json().catch(()=>{throw new HttpError(400,'invalid_json','Request body must be valid JSON');});
      if(!body?.baseCurrency||!body?.timezone)throw new HttpError(400,'profile_preferences_required','Base currency and timezone are required');
      safeBaseCurrency(body.baseCurrency);
      safeTimezone(body.timezone);
    }
    return await handleAuth(context,'auth/register',method);
  }catch(error){
    return errorResponse(request,env,error);
  }
}
