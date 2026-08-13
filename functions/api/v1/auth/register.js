import {errorResponse} from '../../../_lib/runtime.js';
import {handleAuth} from '../../../_lib/auth.js';

export async function onRequest(context){
  try{
    return await handleAuth(context,'auth/register',context.request.method.toUpperCase());
  }catch(error){
    return errorResponse(context.request,context.env,error);
  }
}
