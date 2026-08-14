import {errorResponse} from '../../../../_lib/runtime.js';
import {handleAuth} from '../../../../_lib/auth.js';

export async function onRequest(context){
  try{
    return await handleAuth(context,'auth/recovery/request',context.request.method.toUpperCase());
  }catch(error){
    return errorResponse(context.request,context.env,error);
  }
}
