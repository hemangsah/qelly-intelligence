import {errorResponse,responseJson} from '../../../_lib/runtime.js';
import {AUTH_EMAIL_CANARY,effectivePublicRuntimeConfig} from '../../../_lib/email-capability.js';

export async function onRequest(context){
  const {request,env}=context;
  try{
    if(request.method.toUpperCase()!=='GET')return context.next();
    const runtime=effectivePublicRuntimeConfig(env,request.url);
    const emailDelivery=runtime.capabilities.authentication===true&&runtime.capabilities.emailDelivery===true;
    return responseJson(request,env,{
      emailDeliveryAvailable:emailDelivery,
      registrationAvailable:emailDelivery,
      recoveryAvailable:emailDelivery,
      evidence:emailDelivery?AUTH_EMAIL_CANARY:null
    });
  }catch(error){return errorResponse(request,env,error);}
}
