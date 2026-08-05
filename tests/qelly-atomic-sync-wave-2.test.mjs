import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {handleData,__dataTest} from '../functions/_lib/data.js';
import {__cloudSyncTest} from '../apps/web/public/assets/qelly-cloud-sync.mjs';

const USER_ID='11111111-1111-4111-8111-111111111111';
const WORKSPACE_ID='22222222-2222-4222-8222-222222222222';
const CALCULATION_ID='33333333-3333-4333-8333-333333333333';

const baseEnv=(fetchImpl)=>({
  QELLY_PUBLIC_SITE_URL:'https://qelly-intelligence.pages.dev',
  QELLY_PUBLIC_SUPABASE_URL:'https://example.supabase.co',
  QELLY_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_test_key_long_enough_for_validation',
  QELLY_PUBLIC_RELEASE_SHA:'b98a59157fedf0f36286d9f424e11c0a4fa64529',
  __fetch:fetchImpl
});

const session={accessToken:'test-access-token',user:{id:USER_ID}};
const qelly={
  user:{userId:USER_ID},
  workspace:{workspaceId:WORKSPACE_ID,name:'Test workspace'},
  profile:{cloud_sync_opt_in:true}
};

const savedItem=()=>({
  id:CALCULATION_ID,
  name:'Position size',
  savedAt:'2026-08-05T00:00:00.000Z',
  version:1,
  result:{formulaId:'position-size',inputs:{accountValue:100000,riskPercent:1},outputs:{quantity:200}},
  notes:'Test record',
  tags:['risk'],
  favorite:true
});

const pushRequest=(items=[savedItem()],key='qelly-sync-test-batch')=>new Request('https://qelly-intelligence.pages.dev/api/v1/sync/push',{
  method:'POST',
  headers:{
    Origin:'https://qelly-intelligence.pages.dev',
    Cookie:'qelly_csrf=test-proof',
    'X-Qelly-CSRF':'test-proof',
    'Idempotency-Key':key,
    'Content-Type':'application/json'
  },
  body:JSON.stringify({items,baseRevisions:{[CALCULATION_ID]:null}})
});

test('local cloud record and request hash are deterministic without updatedAt',async()=>{
  const first=__dataTest.localToCloud(savedItem(),qelly);
  const second=__dataTest.localToCloud(savedItem(),qelly);
  assert.deepEqual(first,second);
  assert.equal(first.client_updated_at,'2026-08-05T00:00:00.000Z');
  const firstHash=await __dataTest.sha256Hex({workspaceId:WORKSPACE_ID,items:[first]});
  const secondHash=await __dataTest.sha256Hex({items:[second],workspaceId:WORKSPACE_ID});
  assert.equal(firstHash,secondHash);
  assert.match(firstHash,/^[0-9a-f]{64}$/);
});

test('sync push makes one Supabase RPC request for the entire batch',async()=>{
  const calls=[];
  const env=baseEnv(async(url,init)=>{
    calls.push({url:String(url),init,body:JSON.parse(init.body)});
    return new Response(JSON.stringify({
      batchId:'44444444-4444-4444-8444-444444444444',
      results:[{id:CALCULATION_ID,status:'applied',cloudRevision:1}],
      applied:1,
      conflicts:0,
      replayed:false
    }),{status:200,headers:{'content-type':'application/json'}});
  });
  const response=await handleData({request:pushRequest(),env},'sync/push',[],'POST',session,qelly);
  const body=await response.json();
  assert.equal(response.status,200);
  assert.equal(body.applied,1);
  assert.equal(calls.length,1);
  assert.equal(calls[0].url,'https://example.supabase.co/rest/v1/rpc/qelly_sync_push_batch');
  assert.equal(calls[0].body.p_workspace_id,WORKSPACE_ID);
  assert.equal(calls[0].body.p_items.length,1);
  assert.equal(calls[0].body.p_items[0].id,CALCULATION_ID);
  assert.match(calls[0].body.p_items[0].operationId,/^[0-9a-f-]{36}$/);
  assert.match(calls[0].body.p_request_hash,/^[0-9a-f]{64}$/);
});

test('same key and payload produce the same client request hash and operation id',async()=>{
  const payloads=[];
  const env=baseEnv(async(_url,init)=>{
    payloads.push(JSON.parse(init.body));
    return new Response(JSON.stringify({results:[],applied:0,conflicts:0,replayed:false}),{status:200,headers:{'content-type':'application/json'}});
  });
  await handleData({request:pushRequest(),env},'sync/push',[],'POST',session,qelly);
  await handleData({request:pushRequest(),env},'sync/push',[],'POST',session,qelly);
  assert.equal(payloads.length,2);
  assert.equal(payloads[0].p_request_hash,payloads[1].p_request_hash);
  assert.equal(payloads[0].p_items[0].operationId,payloads[1].p_items[0].operationId);
});

test('sync push rejects oversized batches before any Supabase request',async()=>{
  let calls=0;
  const env=baseEnv(async()=>{calls+=1;throw new Error('must not call Supabase');});
  const items=Array.from({length:101},(_,index)=>({...savedItem(),id:`${String(index).padStart(8,'0')}-1111-4111-8111-111111111111`}));
  await assert.rejects(
    handleData({request:pushRequest(items),env},'sync/push',[],'POST',session,qelly),
    error=>error?.code==='sync_batch_size_invalid'
  );
  assert.equal(calls,0);
});

test('sync push rejects idempotency keys outside 8 to 128 characters without truncating',async()=>{
  let calls=0;
  const env=baseEnv(async()=>{calls+=1;throw new Error('must not call Supabase');});
  for(const key of ['short',`q${'x'.repeat(128)}`]){
    await assert.rejects(
      handleData({request:pushRequest([savedItem()],key),env},'sync/push',[],'POST',session,qelly),
      error=>error?.code==='idempotency_key_required'
    );
  }
  assert.equal(calls,0);
});

test('calculation pagination uses an opaque stable cursor and deterministic order',()=>{
  const records=[
    {id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',updated_at:'2026-08-05T01:00:00.000Z'},
    {id:'99999999-9999-4999-8999-999999999999',updated_at:'2026-08-05T00:00:00.000Z'}
  ];
  const cursor=__dataTest.nextCursorFor(records,2);
  assert.ok(cursor);
  const url=new URL(`https://qelly-intelligence.pages.dev/api/v1/sync/pull?limit=2&cursor=${encodeURIComponent(cursor)}`);
  const page=__dataTest.calculationPagePath(WORKSPACE_ID,url);
  assert.equal(page.limit,2);
  const query=new URLSearchParams(page.path.split('?')[1]);
  assert.equal(query.get('workspace_id'),`eq.${WORKSPACE_ID}`);
  assert.equal(query.get('order'),'updated_at.desc,id.desc');
  assert.equal(query.get('limit'),'2');
  assert.match(query.get('or'),/updated_at\.lt\.2026-08-05T00:00:00\.000Z/);
  assert.match(query.get('or'),/id\.lt\.99999999-9999-4999-8999-999999999999/);
});

test('browser queue splits local work into bounded atomic batches',()=>{
  const items=Array.from({length:205},(_,index)=>index);
  const batches=__cloudSyncTest.chunks(items,__cloudSyncTest.MAX_BATCH_ITEMS);
  assert.deepEqual(batches.map(batch=>batch.length),[100,100,5]);
  assert.equal(__cloudSyncTest.PULL_PAGE_SIZE,50);
});

test('migration enforces server-side payload hashing and least-privilege RPC execution',async()=>{
  const [sql,indexSql]=await Promise.all([
    readFile(new URL('../packages/migrations/20260805013300_qelly_atomic_sync_batch_v1.sql',import.meta.url),'utf8'),
    readFile(new URL('../packages/migrations/20260805013500_qelly_sync_batch_workspace_index.sql',import.meta.url),'utf8')
  ]);
  assert.match(sql,/create table if not exists qelly_private\.sync_batches/i);
  assert.match(sql,/security definer/i);
  assert.match(sql,/set search_path\s*=\s*''/i);
  assert.match(sql,/auth\.uid\(\)/i);
  assert.match(sql,/for update/i);
  assert.match(sql,/extensions\.digest/i);
  assert.match(sql,/idempotency_key_reused_with_different_request/i);
  assert.match(sql,/revoke all on function[\s\S]*from public, anon, service_role/i);
  assert.match(sql,/grant execute on function[\s\S]*to authenticated/i);
  assert.match(indexSql,/qelly_sync_batches_workspace_idx[\s\S]*sync_batches\(workspace_id\)/i);
});

test('authenticated clients cannot directly mutate sync-operation evidence',async()=>{
  const [lockdown,cleanup]=await Promise.all([
    readFile(new URL('../packages/migrations/20260805013400_qelly_sync_operation_evidence_lockdown.sql',import.meta.url),'utf8'),
    readFile(new URL('../packages/migrations/20260805013600_qelly_sync_operation_policy_cleanup.sql',import.meta.url),'utf8')
  ]);
  assert.match(lockdown,/revoke all privileges on table public\.qelly_sync_operations[\s\S]*from anon, authenticated/i);
  assert.match(lockdown,/grant select on table public\.qelly_sync_operations[\s\S]*to authenticated/i);
  assert.doesNotMatch(lockdown,/grant\s+(insert|update|delete)/i);
  for(const policy of ['qelly_sync_own_insert','qelly_sync_own_update','qelly_sync_own_delete']){
    assert.match(cleanup,new RegExp(`drop policy if exists ${policy}`,'i'));
  }
  assert.match(cleanup,/create policy qelly_sync_own_select[\s\S]*owner_id=\(select auth\.uid\(\)\)/i);
});

test('clean provisioning transitions policy dependencies before migration 111 drops the public helper',async()=>{
  const [transition,hardening,migrator]=await Promise.all([
    readFile(new URL('../packages/migrations/110a_qelly_private_workspace_role_policy_transition.sql',import.meta.url),'utf8'),
    readFile(new URL('../packages/migrations/111_qelly_final_live_activation_hardening.sql',import.meta.url),'utf8'),
    readFile(new URL('../scripts/migrate-production.mjs',import.meta.url),'utf8')
  ]);
  assert.match(transition,/create or replace function qelly_private\.workspace_role/i);
  for(const policy of [
    'qelly_workspaces_member_select',
    'qelly_members_visible',
    'qelly_members_owner_insert',
    'qelly_members_owner_update',
    'qelly_members_owner_delete',
    'qelly_saved_member_select',
    'qelly_revisions_member_select',
    'qelly_audit_member_select'
  ]){
    assert.match(transition,new RegExp(`drop policy if exists ${policy}`,'i'));
  }
  assert.match(transition,/to_regprocedure\('public\.qelly_workspace_role\(uuid,uuid\)'\)/i);
  assert.match(hardening,/drop function if exists public\.qelly_workspace_role\(uuid,uuid\)/i);
  assert.match(migrator,/import \{ selectForwardMigrationFiles \} from '\.\/migration-file-policy\.mjs';/);
  assert.match(migrator,/const files = selectForwardMigrationFiles\(await readdir\(migrationDir\)\);/);
  assert.deepEqual(
    ['110_prompt2c_revision_trigger_order.sql','110a_qelly_private_workspace_role_policy_transition.sql','111_qelly_final_live_activation_hardening.sql'].sort(),
    ['110_prompt2c_revision_trigger_order.sql','110a_qelly_private_workspace_role_policy_transition.sql','111_qelly_final_live_activation_hardening.sql']
  );
});

test('browser pull follows cursors and migrations are never auto-applied by the client',async()=>{
  const [client,migrator]=await Promise.all([
    readFile(new URL('../apps/web/public/assets/qelly-cloud-sync.mjs',import.meta.url),'utf8'),
    readFile(new URL('../scripts/migrate-production.mjs',import.meta.url),'utf8')
  ]);
  assert.match(client,/do\s*\{[\s\S]*result\.nextCursor[\s\S]*\}\s*while\(cursor\)/);
  assert.match(migrator,/QELLY_MIGRATION_DATABASE_URL is required in production/);
  assert.doesNotMatch(client,/qelly_sync_push_batch/);
});
