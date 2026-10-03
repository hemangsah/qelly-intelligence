import test from 'node:test';
import assert from 'node:assert/strict';
import {deflateSync} from 'node:zlib';
import {onRequest,__privateAvatarTest} from '../functions/api/v1/profile/avatar.js';

const UID='11111111-1111-4111-8111-111111111111';
const SITE='https://terminal.qellyintelligence.com';
const SB='https://project.supabase.co';
const KEY='sb_publishable_ci_public_0123456789';
const crc=(source)=>{let x=0xffffffff;for(const value of source){x^=value;for(let i=0;i<8;i++)x=x&1?0xedb88320^(x>>>1):x>>>1;}return(x^0xffffffff)>>>0;};
function chunk(name,body){const nameBytes=Buffer.from(name,'ascii'),length=Buffer.alloc(4),tail=Buffer.alloc(4);length.writeUInt32BE(body.length);tail.writeUInt32BE(crc(Buffer.concat([nameBytes,body])));return Buffer.concat([length,nameBytes,body,tail]);}
function png(width=1,height=1){
 const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(width,0);ihdr.writeUInt32BE(height,4);ihdr[8]=8;ihdr[9]=6;
 const row=Buffer.alloc(height*(1+width*4),0);
 return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ihdr),chunk('IDAT',deflateSync(row)),chunk('IEND',Buffer.alloc(0))]);
}
const DATA='data:image/png;base64,'+png().toString('base64');
const token=(uid=UID)=>['eyJhbGciOiJub25lIn0',Buffer.from(JSON.stringify({iss:SB+'/auth/v1',aud:'authenticated',exp:Math.floor(Date.now()/1000)+3600,sub:uid})).toString('base64url'),'unused'].join('.');
const req=(method,body,uid=UID,csrf=true)=>new Request(SITE+'/api/v1/profile/avatar',{method,headers:{
 Cookie:'qelly_sb_access='+token(uid)+'; qelly_csrf=token',
 ...(method==='GET'?{}:{Origin:SITE,'X-Qelly-CSRF':csrf?'token':'invalid','Content-Type':'application/json'})
},...(body?{body:JSON.stringify(body)}:{})});
const harness=()=>{const calls=[],user=UID;
 const env={QELLY_PUBLIC_SITE_URL:SITE,QELLY_PUBLIC_SUPABASE_URL:SB,QELLY_PUBLIC_SUPABASE_PUBLISHABLE_KEY:KEY,
  __fetch:async(url,opts)=>{calls.push({url,method:opts?.method,headers:opts?.headers,body:opts?.body});
   if(url===SB+'/auth/v1/user')return Response.json({id:user,email:'example@example.invalid',identities:[]});
   if(url.includes('/storage/v1/object/authenticated/'))return new Response(png(),{status:200,headers:{'Content-Type':'image/png'}});
   if(url.includes('/storage/v1/object/'))return Response.json({success:true},{status:200});
   throw new Error('Unexpected upstream '+url);
  }
 };
 return{env,calls};
};
test('PNG parser validates signature, CRC, dimensions and exact IEND',()=>{
 const output=__privateAvatarTest.parsePrivateAvatarPng(DATA);
 assert.equal(output[0],137);
 assert.equal(__privateAvatarTest.validatePrivateAvatarBytes(output),output);
 for(const data of [undefined,'data:image/svg+xml;base64,PHN2Zz4=','https://host.invalid/avatar.png',
  'data:image/png;base64,'+'A'.repeat(2800001)])assert.throws(()=>__privateAvatarTest.parsePrivateAvatarPng(data));
 const altered=Buffer.from(png());altered[20]=2;
 assert.throws(()=>__privateAvatarTest.parsePrivateAvatarPng('data:image/png;base64,'+altered.toString('base64')),/checksum/);
 const big=png(1024,1024);
 assert.throws(()=>__privateAvatarTest.parsePrivateAvatarPng('data:image/png;base64,'+big.toString('base64')),/no larger than 512 pixels/);
 const truncated=png().subarray(0,-1);
 assert.throws(()=>__privateAvatarTest.parsePrivateAvatarPng('data:image/png;base64,'+truncated.toString('base64')));
});
test('authenticated avatar upload uses only JWT-scoped Storage with bounded canonical key',async()=>{
 const {env,calls}=harness();
 const request=req('POST',{pngDataUrl:DATA});
 const auth=request.headers.get('cookie').match(/qelly_sb_access=([^;]+)/)[1];
 const response=await onRequest({request,env});
 const body=await response.json();
 assert.equal(response.status,200,JSON.stringify(body));
 assert.deepEqual({saved:body.saved,private:body.private,format:body.format},{saved:true,private:true,format:'png'});
 const storage=calls.find(x=>x.url.includes('/storage/v1/object/'));
 assert.equal(storage.url,SB+'/storage/v1/object/qelly-private-avatars/'+UID+'/avatar.png');
 assert.equal(storage.headers.Authorization,'Bearer '+auth);
 assert.equal(storage.headers['x-upsert'],'true');
 assert.equal(storage.headers['Content-Type'],'image/png');
 assert.ok(storage.body instanceof Uint8Array);
 assert.doesNotMatch(JSON.stringify(calls.map(x=>x.url)),/service_role/);
});
test('private GET serves PNG with no-store, nosniff and exact user-only storage path',async()=>{
 const {env,calls}=harness();
 const response=await onRequest({request:req('GET'),env});
 assert.equal(response.status,200);assert.equal(response.headers.get('content-type'),'image/png');
 assert.match(response.headers.get('cache-control'),/private, no-store/);
 assert.equal(response.headers.get('x-content-type-options'),'nosniff');
 assert.match(response.headers.get('content-disposition'),/avatar.png/);
 assert.deepEqual(Buffer.from(await response.arrayBuffer()),png());
 assert.ok(calls.some(x=>x.url===SB+'/storage/v1/object/authenticated/qelly-private-avatars/'+UID+'/avatar.png'));
});
test('DELETE is CSRF protected and deletes only its exact current-user avatar path',async()=>{
 const {env,calls}=harness();
 const response=await onRequest({request:req('DELETE'),env});
 assert.equal(response.status,200);
 const storage=calls.find(x=>x.method==='DELETE');
 assert.equal(storage.url,SB+'/storage/v1/object/qelly-private-avatars');
 assert.deepEqual(JSON.parse(storage.body),{prefixes:[UID+'/avatar.png']});
 const broken=await onRequest({request:req('DELETE',null,UID,false),env});
 assert.equal(broken.status,403);
 assert.equal(calls.filter(x=>x.method==='DELETE').length,1);
});
test('unverified JWT subject is rejected before any Storage access',async()=>{
 const {env,calls}=harness();
 const other='22222222-2222-4222-8222-222222222222';
 const response=await onRequest({request:req('GET',null,other),env});
 assert.equal(response.status,401);
 assert.equal(calls.filter(x=>x.url.includes('/storage/v1/')).length,0);
});
test('missing file is a normal empty state, but missing bucket is explicitly unavailable',async()=>{
 const {env}=harness();
 env.__fetch=async(url)=>url.includes('/auth/v1/user')?Response.json({id:UID}):Response.json({message:'Object not found'},{status:404});
 const none=await onRequest({request:req('GET'),env});
 assert.equal(none.status,204);
 env.__fetch=async(url)=>url.includes('/auth/v1/user')?Response.json({id:UID}):Response.json({message:'Bucket not found'},{status:404});
 const missing=await onRequest({request:req('GET'),env});
 assert.equal(missing.status,503);
});
