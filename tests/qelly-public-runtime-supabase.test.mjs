import test from 'node:test';
import assert from 'node:assert/strict';
import {MemorySessionStore,SupabaseRuntimeAdapter} from '../src/public-runtime/supabase-adapter.mjs';

function mockFetch(routes){return async(url,options={})=>{const key=`${options.method||'GET'} ${new URL(url).pathname}${new URL(url).search}`;const value=routes[key]||routes[`${options.method||'GET'} ${new URL(url).pathname}`];if(!value)return new Response(JSON.stringify({error:'not_mocked'}),{status:500,headers:{'content-type':'application/json'}});return new Response(JSON.stringify(typeof value==='function'?value(options):value.body),{status:value.status||200,headers:{'content-type':'application/json'}});};}
const anonKey='a'.repeat(40);

test('adapter refuses unsafe endpoints and short keys',()=>{
  assert.throws(()=>new SupabaseRuntimeAdapter({url:'http://example.test',anonKey}));
  assert.throws(()=>new SupabaseRuntimeAdapter({url:'https://example.test',anonKey:'short'}));
});

test('sign-up uses an allowlisted redirect and never persists passwords',async()=>{
  let requestBody;
  const adapter=new SupabaseRuntimeAdapter({url:'https://project.supabase.co',anonKey,sessionStore:new MemorySessionStore(),redirectAllowlist:['https://qelly.example/auth/callback'],fetchImpl:mockFetch({'POST /auth/v1/signup':{body:{user:{id:'u1',email:'user@example.com'},session:null}}})});
  adapter.fetchImpl=async(url,options)=>{requestBody=JSON.parse(options.body);return new Response(JSON.stringify({user:{id:'u1',email:'user@example.com'},session:null}),{status:200,headers:{'content-type':'application/json'}});};
  const result=await adapter.signUp({email:'User@Example.com',password:'not-persisted',redirectTo:'https://qelly.example/auth/callback'});
  assert.equal(result.verificationRequired,true);
  assert.equal(requestBody.email,'user@example.com');
  assert.equal(adapter.session(),null);
  await assert.rejects(adapter.signUp({email:'user@example.com',password:'x',redirectTo:'https://evil.example/callback'}),/redirect_not_allowlisted/);
});

test('sign-in persists only the provider session and authenticated RLS requests use bearer token',async()=>{
  const store=new MemorySessionStore();let savedRequest;
  const fetchImpl=async(url,options)=>{
    const path=new URL(url).pathname;
    if(path==='/auth/v1/token')return new Response(JSON.stringify({access_token:'access',refresh_token:'refresh',expires_in:3600,user:{id:'u1',email:'user@example.com'}}),{status:200,headers:{'content-type':'application/json'}});
    savedRequest={url,options};return new Response(JSON.stringify([{id:'calc-1'}]),{status:200,headers:{'content-type':'application/json'}});
  };
  const adapter=new SupabaseRuntimeAdapter({url:'https://project.supabase.co',anonKey,sessionStore:store,redirectAllowlist:['https://qelly.example'],fetchImpl});
  await adapter.signIn({email:'user@example.com',password:'never-stored'});
  assert.equal(adapter.session().access_token,'access');
  assert.equal(store.value.includes('never-stored'),false);
  const rows=await adapter.listSavedCalculations({workspaceId:'w1'});
  assert.equal(rows[0].id,'calc-1');
  assert.equal(savedRequest.options.headers.Authorization,'Bearer access');
  assert.match(savedRequest.url,/workspace_id=eq\.w1/);
});

test('account export aggregates only records visible through the authenticated RLS session',async()=>{
  const store=new MemorySessionStore();store.setItem('',JSON.stringify({access_token:'access',refresh_token:'refresh',expires_at:Math.floor(Date.now()/1000)+3600,user:{id:'u1',email:'user@example.com'}}));
  const adapter=new SupabaseRuntimeAdapter({url:'https://project.supabase.co',anonKey,sessionStore:store,fetchImpl:async()=>new Response('[]',{status:200,headers:{'content-type':'application/json'}})});
  const exported=await adapter.exportUserData();
  assert.equal(exported.schemaVersion,1);
  assert.deepEqual(exported.profile,[]);
  assert.deepEqual(exported.pending,[]);
});

test('expired session cannot be used for cloud reads',()=>{
  const store=new MemorySessionStore();store.setItem('',JSON.stringify({access_token:'a',refresh_token:'r',expires_at:1,user:{id:'u1'}}));
  const adapter=new SupabaseRuntimeAdapter({url:'https://project.supabase.co',anonKey,sessionStore:store,fetchImpl:async()=>new Response('{}',{status:200})});
  assert.throws(()=>adapter.token(),/session_expired/);
});
