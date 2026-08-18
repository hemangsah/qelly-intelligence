import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {onRequest as bootstrapRequest} from '../functions/api/v1/bootstrap.js';
import {buildPublicConfigPayload} from '../functions/_lib/config-payload.js';
import {createAuthenticatedBootstrapFetch} from '../apps/web/public/assets/authenticated-bootstrap.mjs';

const userId='933c72c3-852e-4c30-97ea-9b3e21bd9e87';
const workspaceId='1f7db188-a89b-4f81-a4b7-fbe2e30d3cc2';
const base64Url=(value)=>Buffer.from(JSON.stringify(value)).toString('base64url');
const accessToken=()=>`${base64Url({alg:'none',typ:'JWT'})}.${base64Url({iss:'https://project.supabase.co/auth/v1',aud:'authenticated',exp:Math.floor(Date.now()/1000)+3600,sub:userId})}.signature`;
const environment=(fetchImpl)=>({
  QELLY_PUBLIC_SITE_URL:'https://qelly.test',
  QELLY_PUBLIC_SUPABASE_URL:'https://project.supabase.co',
  QELLY_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'publishable-test-key-0000000000000000',
  QELLY_ENABLE_AUTH_EMAIL_DELIVERY:'false',
  __fetch:fetchImpl
});

test('consolidated backend bootstrap resolves identity, workspace and UI preferences with one auth verification',async()=>{
  const calls=[];
  const env=environment(async(input)=>{
    const url=new URL(String(input));
    calls.push(`${url.pathname}${url.search}`);
    if(url.pathname==='/auth/v1/user')return new Response(JSON.stringify({id:userId,email:'user@example.com',user_metadata:{},email_confirmed_at:'2026-08-18T00:00:00Z'}),{status:200,headers:{'content-type':'application/json'}});
    if(url.pathname==='/rest/v1/qelly_profiles')return new Response(JSON.stringify([{user_id:userId,display_name:'Qelly User'}]),{status:200,headers:{'content-type':'application/json'}});
    if(url.pathname==='/rest/v1/qelly_workspaces')return new Response(JSON.stringify([{id:workspaceId,owner_id:userId,name:'Institutional Workspace'}]),{status:200,headers:{'content-type':'application/json'}});
    if(url.pathname==='/rest/v1/qelly_ui_preferences')return new Response(JSON.stringify([{preferences:{theme:'graphite-terminal',density:'compact'},schema_version:3,revision:7,updated_at:'2026-08-18T12:00:00Z'}]),{status:200,headers:{'content-type':'application/json'}});
    throw new Error(`Unexpected upstream request: ${url}`);
  });
  const request=new Request('https://qelly.test/api/v1/bootstrap',{headers:{cookie:`qelly_sb_access=${accessToken()}`}});
  const response=await bootstrapRequest({request,env,next:()=>new Response(null,{status:404})});
  assert.equal(response.status,200);
  const payload=await response.json();
  assert.equal(payload.config.auth.authenticated,true);
  assert.equal(payload.context.user.userId,userId);
  assert.equal(payload.context.workspace.workspaceId,workspaceId);
  assert.equal(payload.preferences.theme,'graphite-terminal');
  assert.equal(payload.preferences.revision,7);
  assert.equal(calls.filter((value)=>value==='/auth/v1/user').length,1);
  assert.equal(calls.filter((value)=>value.startsWith('/rest/v1/qelly_profiles?')).length,1);
  assert.equal(calls.filter((value)=>value.startsWith('/rest/v1/qelly_workspaces?')).length,1);
  assert.equal(calls.filter((value)=>value.startsWith('/rest/v1/qelly_ui_preferences?')).length,1);
});

test('shared config payload remains the authority for standalone config and consolidated bootstrap projections',()=>{
  const env=environment(async()=>{throw new Error('network not expected');});
  const payload=buildPublicConfigPayload(env,'https://qelly.test/api/v1/config',null,'unused');
  assert.equal(payload.auth.authenticated,false);
  assert.equal(payload.auth.registrationAvailable,false);
  assert.equal(payload.runtime.capabilities.emailDelivery,false);
  assert.equal(payload.providerRights.binance,'blocked_pending_redistribution_rights');
  assert.equal(payload.providerRights.coinbase,'blocked_pending_written_end_user_display_permission');
  assert.equal(payload.liveTrading,false);
});

test('browser bootstrap owner collapses concurrent config, session and preference reads and invalidates after writes',async()=>{
  let bootstrapCalls=0;
  let passthroughCalls=0;
  let nowValue=1_000;
  const fetchImpl=async(input,init={})=>{
    const url=new URL(input instanceof Request?input.url:String(input),'https://qelly.test');
    if(url.pathname==='/api/v1/bootstrap'){
      bootstrapCalls+=1;
      return new Response(JSON.stringify({
        config:{auth:{authenticated:true},csrf:{token:'csrf'}},
        context:{workspace:{workspaceId}},
        preferences:{theme:'burgundy-command',revision:1}
      }),{status:200,headers:{'content-type':'application/json'}});
    }
    passthroughCalls+=1;
    return new Response(JSON.stringify({ok:true,method:String(init.method||'GET').toUpperCase()}),{status:200,headers:{'content-type':'application/json'}});
  };
  const wrapped=createAuthenticatedBootstrapFetch({fetchImpl,baseUrl:'https://qelly.test',ttlMs:5000,now:()=>nowValue});
  const [configResponse,contextResponse,preferencesResponse]=await Promise.all([
    wrapped('/api/v1/config'),
    wrapped('/api/v1/session/context'),
    wrapped('/api/v1/preferences/layout')
  ]);
  assert.equal(bootstrapCalls,1);
  assert.equal((await configResponse.json()).auth.authenticated,true);
  assert.equal((await contextResponse.json()).workspace.workspaceId,workspaceId);
  assert.equal((await preferencesResponse.json()).revision,1);

  await wrapped('/api/v1/market/overview');
  assert.equal(passthroughCalls,1);
  await wrapped('/api/v1/preferences/layout',{method:'PATCH',body:'{}'});
  assert.equal(passthroughCalls,2);
  await wrapped('/api/v1/config');
  assert.equal(bootstrapCalls,2);

  nowValue+=6000;
  await wrapped('/api/v1/session/context');
  assert.equal(bootstrapCalls,3);
});

test('browser bootstrap owner falls back to existing endpoints during deployment or preview skew',async()=>{
  let bootstrapCalls=0;
  const endpointCalls=[];
  const fetchImpl=async(input)=>{
    const url=new URL(input instanceof Request?input.url:String(input),'https://qelly.test');
    if(url.pathname==='/api/v1/bootstrap'){
      bootstrapCalls+=1;
      return new Response(JSON.stringify({auth:{authenticated:false},defaultRoute:'market'}),{status:200,headers:{'content-type':'application/json'}});
    }
    endpointCalls.push(url.pathname);
    if(url.pathname==='/api/v1/config')return new Response(JSON.stringify({auth:{authenticated:false},defaultRoute:'market'}),{status:200,headers:{'content-type':'application/json'}});
    if(url.pathname==='/api/v1/session/context')return new Response(JSON.stringify({workspace:{workspaceId}}),{status:200,headers:{'content-type':'application/json'}});
    throw new Error(`Unexpected endpoint ${url.pathname}`);
  };
  const wrapped=createAuthenticatedBootstrapFetch({fetchImpl,baseUrl:'https://qelly.test'});
  const [config,context]=await Promise.all([wrapped('/api/v1/config'),wrapped('/api/v1/session/context')]);
  assert.equal(bootstrapCalls,1);
  assert.deepEqual(endpointCalls.sort(),['/api/v1/config','/api/v1/session/context']);
  assert.equal((await config.json()).defaultRoute,'market');
  assert.equal((await context.json()).workspace.workspaceId,workspaceId);
});

test('bootstrap installer executes before the application shell entry',async()=>{
  const html=await readFile(new URL('../apps/web/public/index.html',import.meta.url),'utf8');
  const installer=html.indexOf('./assets/authenticated-bootstrap-install.mjs');
  const app=html.indexOf('./assets/app.js');
  assert.ok(installer>=0);
  assert.ok(app>installer);
});
