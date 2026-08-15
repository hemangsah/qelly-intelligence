import {enforceRateLimit,errorResponse,requireOrigin,resolveSession,responseJson} from '../../../_lib/runtime.js';

export async function onRequest(context){
  const {request,env}=context;
  try{
    if(request.headers.get('origin'))requireOrigin(request,env);
    const method=request.method.toUpperCase();
    if(!['GET','PATCH','PUT'].includes(method))return context.next();
    const session=await resolveSession(request,env,{required:true});
    await enforceRateLimit(env,`user:${session.user.id}:preferences/layout`);
    if(method==='GET')return responseJson(request,env,{theme:'burgundy-command',density:'comfortable',motion:'full',fontScale:100,radiusPx:14,customAccent:null,route:'market',revision:1},{cookies:session.cookies});
    return responseJson(request,env,{revision:1,persisted:false,storage:'browser-local'},200,{cookies:session.cookies});
  }catch(error){return errorResponse(request,env,error);}
}
