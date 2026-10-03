import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {handleAuth} from '../functions/_lib/auth.js';
import {__profileRouteTest} from '../functions/api/v1/profile.js';

const uid='11111111-1111-4111-8111-111111111111',site='https://terminal.qellyintelligence.com',sb='https://project.supabase.co';
const jwt=(sub=uid)=>['eyJhbGciOiJub25lIn0',Buffer.from(JSON.stringify({iss:sb+'/auth/v1',aud:'authenticated',sub,exp:Math.floor(Date.now()/1000)+3600})).toString('base64url'),'mock'].join('.');
const request=(path,{csrf='correct',origin=site,sub=uid}={})=>new Request(site+'/api/v1/'+path,{method:'POST',headers:{
 Cookie:'qelly_sb_access='+jwt(sub)+'; qelly_csrf=correct',
 ...(csrf===null?{}:{'X-Qelly-CSRF':csrf}),
 ...(origin===null?{}:{Origin:origin}),
 'Content-Type':'application/json'
},body:'{}'});
const fixture=(logoutStatus=204)=>{const calls=[];
 const env={QELLY_PUBLIC_SITE_URL:site,QELLY_PUBLIC_SUPABASE_URL:sb,QELLY_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_mock_01234567890',
  __fetch:async(url,opts)=>{
   calls.push({url,method:opts?.method,headers:opts?.headers});
   if(url===sb+'/auth/v1/user')return Response.json({id:uid,email:'u@example.invalid'});
   if(url.startsWith(sb+'/auth/v1/logout'))return logoutStatus===204?new Response(null,{status:204}):Response.json({message:'Upstream temporarily unavailable'},{status:logoutStatus});
   throw new Error('Unexpected auth URL');
  }
 };
 return{env,calls};
};
test('global sign-out uses the documented GoTrue global query scope and clears this browser only after success',async()=>{
 const {env,calls}=fixture(),r=await handleAuth({request:request('auth/logout-all'),env},'auth/logout-all','POST');
 assert.equal(r.status,200);
 const out=await r.json();
 assert.equal(out.scope,'global');assert.equal(out.remoteRevocation,'confirmed');
 assert.equal(out.refreshTokens,'revoked');assert.equal(out.existingAccessTokens,'valid_until_expiry');
 assert.equal(out.otherDeviceInventory,'unavailable');
 const global=calls.filter(c=>c.url===sb+'/auth/v1/logout?scope=global');
 assert.equal(global.length,1);
 assert.equal(global[0].headers.Authorization,'Bearer '+jwt());
 assert.match(r.headers.get('set-cookie')||'',/qelly_sb_access=/);
 assert.equal(calls.filter(c=>c.url.includes('scope=local')).length,0);
});
test('global sign-out requires origin, CSRF and a verified current user',async()=>{
 const {env,calls}=fixture();
 await assert.rejects(handleAuth({request:request('auth/logout-all',{origin:null}),env},'auth/logout-all','POST'),e=>e.status===403);
 await assert.rejects(handleAuth({request:request('auth/logout-all',{csrf:'bad'}),env},'auth/logout-all','POST'),e=>e.status===403);
 await assert.rejects(handleAuth({request:request('auth/logout-all',{sub:'22222222-2222-4222-8222-222222222222'}),env},'auth/logout-all','POST'),e=>e.status===401);
 assert.equal(calls.filter(c=>c.url.includes('/auth/v1/logout')).length,0);
});
test('upstream failure leaves global logout unconfirmed and never returns success cookies',async()=>{
 const {env}=fixture(503);
 await assert.rejects(handleAuth({request:request('auth/logout-all'),env},'auth/logout-all','POST'),e=>e.status===503);
});
test('current-browser logout uses local scope; a provider failure is explicitly unverified',async()=>{
 const {env,calls}=fixture(),ok=await handleAuth({request:request('auth/logout'),env},'auth/logout','POST');
 const result=await ok.json();
 assert.equal(result.loggedOut,true);assert.equal(result.scope,'this_browser');
 assert.equal(result.remoteRevocation,'confirmed');
 assert.equal(calls.filter(c=>c.url===sb+'/auth/v1/logout?scope=local').length,1);
 const upstream=fixture(503);
 const degraded=await handleAuth({request:request('auth/logout'),env:upstream.env},'auth/logout','POST');
 assert.equal(degraded.status,200);
 assert.equal((await degraded.json()).remoteRevocation,'unverified');
 assert.match(degraded.headers.get('set-cookie')||'',/qelly_sb_access=/);
 assert.equal(upstream.calls.filter(c=>c.url.includes('scope=global')).length,0);
});
test('profile capability and UI only advertise a real global action, never a fictitious device inventory',async()=>{
 const c={user:{userId:uid,email:'u@example.invalid',displayName:'Test',emailConfirmedAt:null},profile:{},workspace:{workspaceId:uid,name:'Test'},session:{}};
 assert.equal(__profileRouteTest.profilePayload(c).capabilities.globalSignOut,true);
 const source=await readFile(new URL('../apps/web/public/assets/routes/account-session.mjs',import.meta.url),'utf8');
 for(const marker of ['globalSignOutAvailable','data-logout-all-show','data-logout-all-confirm','data-logout-all-cancel','data-logout-all-confirm-button','/api/v1/auth/logout-all','valid until they expire','onLoggedOut'])assert.ok(source.includes(marker),marker);
 assert.match(source,/remoteRevocation!=='confirmed'/);
 assert.match(source,/other devices|Other devices/);
 const css=await readFile(new URL('../apps/web/public/assets/routes/account-session-v6.css',import.meta.url),'utf8');
 assert.match(css,/q-v6-signout-all-confirm/);
 assert.match(css,/focus-visible/);
 assert.match(css,/max-width:560px/);
});
test('source contract never claims immediate JWT revocation or requires administrative credentials',async()=>{
 const source=await readFile(new URL('../functions/_lib/auth.js',import.meta.url),'utf8');
 assert.match(source,/\/auth\/v1\/logout\?scope=local/);
 assert.match(source,/\/auth\/v1\/logout\?scope=global/);
 assert.match(source,/existingAccessTokens:'valid_until_expiry'/);
 assert.match(source,/requireOrigin\(request,env\)/);
 assert.doesNotMatch(source,/SUPABASE_SERVICE_ROLE_KEY/);
});
