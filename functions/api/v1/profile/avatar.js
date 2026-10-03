/* Private profile image proxy. No service-role access or public avatar URLs.
 * Storage RLS owns the sole permitted path: auth.uid()/avatar.png. */
import {HttpError,SECURITY_HEADERS,UUID,enforceRateLimit,errorResponse,fetcher,jsonBody,publicRuntimeConfig,requireCsrf,requireOrigin,resolveSession,responseJson} from '../../../_lib/runtime.js';

const BUCKET='qelly-private-avatars';
const MAX_BYTES=2*1024*1024;
const MAX_DIMENSION=512;
const PNG_MAGIC=[137,80,78,71,13,10,26,10];
const PNG_MIME='image/png';
const hasPngSignature=bytes=>bytes.length>=33&&PNG_MAGIC.every((value,index)=>bytes[index]===value);
const uint32=(bytes,offset)=>((bytes[offset]*16777216)+(bytes[offset+1]<<16)+(bytes[offset+2]<<8)+bytes[offset+3])>>>0;
export function parsePrivateAvatarPng(value){
 if(typeof value!=='string'||value.length>2_800_000||!/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(value))throw new HttpError(415,'avatar_format_invalid','A cropped PNG image is required');
 let decoded;
 try{decoded=atob(value.slice('data:image/png;base64,'.length));}catch{throw new HttpError(400,'avatar_encoding_invalid','The PNG data could not be decoded');}
 if(decoded.length<45||decoded.length>MAX_BYTES)throw new HttpError(413,'avatar_size_invalid','PNG must be smaller than 2 MiB');
 const bytes=Uint8Array.from(decoded,character=>character.charCodeAt(0));
 if(!hasPngSignature(bytes)||uint32(bytes,8)!==13||
    String.fromCharCode(...bytes.slice(12,16))!=='IHDR')throw new HttpError(415,'avatar_signature_invalid','The file is not a valid PNG image');
 const width=uint32(bytes,16),height=uint32(bytes,20);
 if(width<1||height<1||width>MAX_DIMENSION||height>MAX_DIMENSION||width!==height||bytes[24]!==8||![2,6].includes(bytes[25]))
   throw new HttpError(422,'avatar_dimensions_invalid','Upload a square 8-bit PNG image no larger than 512 pixels');
 // Reject truncated streams and require an actual PNG terminator rather than
 // accepting an attacker-controlled file with a forged eight-byte signature.
 const n=bytes.length;
 if(![73,69,78,68].every((v,i)=>bytes[n-8+i]===v)||uint32(bytes,n-12)!==0)
   throw new HttpError(415,'avatar_png_incomplete','PNG image is incomplete');
 return bytes;
}
const storageEndpoint=(config,uid,read=false)=>config.supabaseUrl+'/storage/v1/object/'+(read?'authenticated/':'')+BUCKET+'/'+uid+'/avatar.png';
const storageHeaders=(config,session,extra={})=>({apikey:config.supabasePublishableKey,Authorization:'Bearer '+session.accessToken,...extra});
const remote=async(env,url,options)=>{
 const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),12000);
 try{return await fetcher(env)(url,{...options,signal:controller.signal});}
 catch(error){if(error?.name==='AbortError')throw new HttpError(503,'avatar_storage_timeout','Private avatar storage is not responding',{retryable:true});throw error;}
 finally{clearTimeout(timeout);}
};
const storageFailure=response=>{
 if(response.status===401||response.status===403)return new HttpError(403,'avatar_storage_denied','Avatar access was denied by private storage');
 if(response.status===413)return new HttpError(413,'avatar_storage_rejected','The avatar exceeds storage limits');
 if(response.status===429)return new HttpError(429,'avatar_storage_busy','Avatar storage is rate limited',{retryable:true});
 return new HttpError(503,'avatar_storage_unavailable','Private avatar storage is unavailable',{retryable:true});
};
export async function onRequest({request,env}){
 try{
  const method=request.method.toUpperCase();
  if(!['GET','POST','DELETE'].includes(method))throw new HttpError(405,'method_not_allowed','Avatar supports GET, POST and DELETE');
  if(method!=='GET'){requireOrigin(request,env);await requireCsrf(request);}
  const session=await resolveSession(request,env,{required:true}),uid=session.user?.id;
  if(!UUID.test(String(uid||'')))throw new HttpError(401,'avatar_identity_invalid','A verified account is required');
  const config=publicRuntimeConfig(env,request.url);
  await enforceRateLimit(env,'user:'+uid+':avatar',{limit:method==='GET'?60:10});
  if(method==='GET'){
   const result=await remote(env,storageEndpoint(config,uid,true),{method:'GET',headers:storageHeaders(config,session)});
   if(result.status===404)return new Response(null,{status:204,headers:{...SECURITY_HEADERS,'Cache-Control':'private, no-store'}});
   if(!result.ok)throw storageFailure(result);
   const length=Number(result.headers.get('content-length'));
   if(Number.isFinite(length)&&length>MAX_BYTES)throw new HttpError(503,'avatar_storage_integrity','Stored avatar violates the size policy');
   const payload=new Uint8Array(await result.arrayBuffer());
   if(payload.byteLength>MAX_BYTES||!hasPngSignature(payload))throw new HttpError(503,'avatar_storage_integrity','Stored avatar failed integrity validation');
   return new Response(payload,{status:200,headers:{...SECURITY_HEADERS,'Content-Type':PNG_MIME,
    'Content-Disposition':'inline; filename="avatar.png"','Cache-Control':'private, no-store'}});
  }
  if(method==='POST'){
   const body=await jsonBody(request,3_000_000);
   const png=parsePrivateAvatarPng(body.pngDataUrl);
   const result=await remote(env,storageEndpoint(config,uid),{
    method:'POST',
    headers:storageHeaders(config,session,{'Content-Type':PNG_MIME,'x-upsert':'true','Cache-Control':'no-store'}),
    body:png
   });
   if(!result.ok)throw storageFailure(result);
   return responseJson(request,env,{saved:true,private:true,format:'png',bytes:png.byteLength},200,{cookies:session.cookies,cache:'private, no-store'});
  }
  const result=await remote(env,config.supabaseUrl+'/storage/v1/object/'+BUCKET,{
   method:'DELETE',headers:storageHeaders(config,session,{'Content-Type':'application/json'}),
   body:JSON.stringify({prefixes:[uid+'/avatar.png']})
  });
  if(!result.ok&&result.status!==404)throw storageFailure(result);
  return responseJson(request,env,{removed:true,private:true},200,{cookies:session.cookies,cache:'private, no-store'});
 }catch(error){return errorResponse(request,env,error);}
}
export const __privateAvatarTest=Object.freeze({BUCKET,MAX_BYTES,MAX_DIMENSION,parsePrivateAvatarPng,storageEndpoint});
