import {HttpError,errorResponse,publicRuntimeConfig,requireOrigin} from '../../../../_lib/runtime.js';
import {emailDeliveryAvailable} from '../../../../_lib/email-capability.js';
import {handleAuth} from '../../../../_lib/auth.js';

export async function onRequest(context){
  const {request,env}=context;
  try{
    requireOrigin(request,env);
    if(publicRuntimeConfig(env,request.url).capabilities.authentication!==true)throw new HttpError(503,'auth_runtime_unavailable','Authentication is disabled in the current runtime configuration.',{retryable:false});
    if(request.method.toUpperCase()==='POST'&&!emailDeliveryAvailable(env,request.url))throw new HttpError(503,'auth_email_delivery_unavailable','Email recovery is temporarily unavailable until transactional email delivery is proven.',{retryable:false});
    return await handleAuth(context,'auth/recovery/request',request.method.toUpperCase());
  }catch(error){
    return errorResponse(request,env,error);
  }
}
