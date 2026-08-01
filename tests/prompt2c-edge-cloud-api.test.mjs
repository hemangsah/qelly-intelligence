import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../apps/edge/prompt2c-worker.mjs';

const env={QELLY_ALLOWED_ORIGINS:'https://qelly.example',QELLY_PUBLIC_SUPABASE_URL:'https://project.supabase.co/',QELLY_PUBLIC_SUPABASE_ANON_KEY:'public-anon-key'};
function request(path,{body,headers={}}={}){return new Request(`https://edge.example${path}`,{method:'POST',headers:{Origin:'https://qelly.example',Authorization:'Bearer user.jwt.token','Content-Type':'application/json',...headers},body:body===undefined?undefined:JSON.stringify(body)});}

test('account export verifies the Supabase user and aggregates only RLS-visible records',async()=>{
  const original=globalThis.fetch;const calls=[];
  globalThis.fetch=async(url,options={})=>{calls.push({url:String(url),options});const path=new URL(url).pathname;if(path==='/auth/v1/user')return new Response(JSON.stringify({id:'user-a',email:'a@example.com'}),{status:200});return new Response(JSON.stringify([]),{status:200});};
  try{
    const response=await worker.fetch(request('/api/v1/account/export'),env);
    assert.equal(response.status,200);
    const body=await response.json();
    assert.equal(body.ownerId,'user-a');
    assert.equal(body.schemaVersion,1);
    assert.equal(calls.length,6);
    assert.equal(calls.every((call)=>call.options.headers.Authorization==='Bearer user.jwt.token'),true);
    assert.equal(calls.some((call)=>JSON.stringify(call.options).includes('service_role')),false);
  }finally{globalThis.fetch=original;}
});

test('sync operation rejects a mismatched owner before any database write',async()=>{
  const original=globalThis.fetch;let databaseWrites=0;
  globalThis.fetch=async(url,options={})=>{const path=new URL(url).pathname;if(path==='/auth/v1/user')return new Response(JSON.stringify({id:'user-a'}),{status:200});if(options.method==='POST')databaseWrites+=1;return new Response(JSON.stringify([]),{status:200});};
  try{
    const response=await worker.fetch(request('/api/v1/sync/operations',{headers:{'Idempotency-Key':'operation-key-123'},body:{clientOperationId:'11111111-1111-4111-8111-111111111111',ownerId:'user-b',type:'update',payload:{title:'safe'}}}),env);
    assert.equal(response.status,403);
    assert.equal((await response.json()).error,'tenant_isolation_violation');
    assert.equal(databaseWrites,0);
  }finally{globalThis.fetch=original;}
});

test('valid sync operation is idempotently inserted through the user RLS token',async()=>{
  const original=globalThis.fetch;let stored;
  globalThis.fetch=async(url,options={})=>{const path=new URL(url).pathname;if(path==='/auth/v1/user')return new Response(JSON.stringify({id:'user-a'}),{status:200});stored=JSON.parse(options.body);return new Response(JSON.stringify([{id:'sync-1',...stored}]),{status:200});};
  try{
    const response=await worker.fetch(request('/api/v1/sync/operations',{headers:{'Idempotency-Key':'operation-key-456'},body:{clientOperationId:'22222222-2222-4222-8222-222222222222',ownerId:'user-a',type:'create',payload:{formulaId:'fv'}}}),env);
    assert.equal(response.status,202);
    assert.equal(stored.owner_id,'user-a');
    assert.equal(stored.operation_type,'create');
    assert.equal((await response.json()).accepted,true);
  }finally{globalThis.fetch=original;}
});

test('account deletion fails closed until cloud authorization exists',async()=>{
  const response=await worker.fetch(request('/api/v1/account/deletion'),{QELLY_ALLOWED_ORIGINS:'https://qelly.example'});
  assert.equal(response.status,503);
  assert.equal((await response.json()).error,'external_authorization_required');
});
