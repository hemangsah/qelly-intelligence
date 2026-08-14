import test from 'node:test';
import assert from 'node:assert/strict';
import {
  HttpError,
  errorResponse,
  resolveSession,
  responseJson
} from '../functions/_lib/runtime.js';

const baseEnv=(fetchImpl)=>({
  QELLY_PUBLIC_SITE_URL:'https://qelly.test',
  QELLY_PUBLIC_SUPABASE_URL:'https://project.supabase.co',
  QELLY_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'publishable-test-key-0000000000000000',
  __fetch:fetchImpl
});
const staleRefreshRequest=()=>new Request('https://qelly.test/api/v1/config',{headers:{cookie:'qelly_sb_refresh=stale-refresh-token'}});
const staleAccessRequest=()=>new Request('https://qelly.test/api/v1/config',{headers:{cookie:'qelly_sb_access=stale-access-token; qelly_csrf=stale-csrf'}});

test('invalid stored refresh token clears local auth cookies and resolves anonymous when auth is optional',async()=>{
  const request=staleRefreshRequest();
  const env=baseEnv(async()=>new Response(JSON.stringify({code:'refresh_token_not_found',message:'Invalid Refresh Token'}),{status:400,headers:{'content-type':'application/json'}}));
  const session=await resolveSession(request,env);
  assert.equal(session,null);
  const response=responseJson(request,env,{ok:true});
  const cookies=response.headers.get('set-cookie')||'';
  assert.match(cookies,/qelly_sb_access=/);
  assert.match(cookies,/qelly_sb_refresh=/);
  assert.match(cookies,/qelly_csrf=/);
  assert.match(cookies,/Max-Age=0/);
});

test('invalid stored refresh token clears cookies and returns authentication_required when auth is required',async()=>{
  const request=staleRefreshRequest();
  const env=baseEnv(async()=>new Response(JSON.stringify({code:'refresh_token_already_used',message:'Invalid Refresh Token'}),{status:401,headers:{'content-type':'application/json'}}));
  let failure;
  try{await resolveSession(request,env,{required:true});}catch(error){failure=error;}
  assert.ok(failure instanceof HttpError);
  assert.equal(failure.status,401);
  assert.equal(failure.code,'authentication_required');
  const response=errorResponse(request,env,failure);
  assert.match(response.headers.get('set-cookie')||'',/Max-Age=0/);
});

test('invalid access-only session clears stale access and csrf cookies instead of retrying forever',async()=>{
  const request=staleAccessRequest();
  const env=baseEnv(async()=>{throw new Error('network should not be reached for malformed access token');});
  const session=await resolveSession(request,env);
  assert.equal(session,null);
  const response=responseJson(request,env,{ok:true});
  const cookies=response.headers.get('set-cookie')||'';
  assert.match(cookies,/qelly_sb_access=/);
  assert.match(cookies,/qelly_sb_refresh=/);
  assert.match(cookies,/qelly_csrf=/);
  assert.match(cookies,/Max-Age=0/);
});

test('retryable Supabase refresh failures remain fail-closed and do not discard the browser session',async()=>{
  const request=staleRefreshRequest();
  const env=baseEnv(async()=>new Response(JSON.stringify({message:'temporary upstream failure'}),{status:500,headers:{'content-type':'application/json'}}));
  await assert.rejects(
    resolveSession(request,env),
    (error)=>error instanceof HttpError&&error.status===503&&error.retryable===true
  );
  const response=errorResponse(request,env,new HttpError(503,'supabase_request_failed','temporary upstream failure',{retryable:true}));
  assert.equal(response.headers.get('set-cookie'),null);
});
