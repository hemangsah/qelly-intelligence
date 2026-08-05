import test from 'node:test';
import assert from 'node:assert/strict';
import {handleData,__dataTest} from '../functions/_lib/data.js';

const SITE='https://qelly-revision-bounds.test';
const SUPABASE='https://example.supabase.co';
const USER_ID='11111111-1111-4111-8111-111111111111';
const WORKSPACE_ID='22222222-2222-4222-8222-222222222222';
const CALCULATION_ID='33333333-3333-4333-8333-333333333333';

const jsonResponse=(body,status=200)=>new Response(JSON.stringify(body),{
  status,
  headers:{'content-type':'application/json'}
});

const baseEnv=(fetchImpl)=>({
  QELLY_PUBLIC_SITE_URL:SITE,
  QELLY_PUBLIC_SUPABASE_URL:SUPABASE,
  QELLY_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_revision_bounds_test_1234567890',
  __fetch:fetchImpl
});

const session={accessToken:'test-access-token',user:{id:USER_ID}};
const qelly={
  user:{userId:USER_ID},
  workspace:{workspaceId:WORKSPACE_ID,name:'Revision bounds workspace'},
  profile:{cloud_sync_opt_in:true}
};

test('revision page path is bounded, deterministic and column-minimized',()=>{
  const second='44444444-4444-4444-8444-444444444444';
  const path=__dataTest.revisionPagePath([
    {id:CALCULATION_ID},
    {id:'not-a-uuid'},
    {id:second}
  ]);
  assert.ok(path);
  const query=new URLSearchParams(path.split('?')[1]);
  assert.equal(query.get('select'),'id,calculation_id,revision_no,created_at,snapshot');
  assert.equal(query.get('calculation_id'),`in.(${CALCULATION_ID},${second})`);
  assert.equal(query.get('order'),'created_at.desc,id.desc');
  assert.equal(query.get('limit'),String(__dataTest.MAX_PULL_REVISION_ROWS));
  assert.equal(__dataTest.MAX_PULL_REVISION_ROWS,500);
  assert.equal(__dataTest.revisionPagePath([]),null);
});

test('cloud pull reports partial revision history when the bounded window is saturated',async()=>{
  let revisionQuery;
  const revisions=Array.from({length:__dataTest.MAX_PULL_REVISION_ROWS},(_,index)=>({
    id:`${String(index+1).padStart(8,'0')}-1111-4111-8111-111111111111`,
    calculation_id:CALCULATION_ID,
    revision_no:__dataTest.MAX_PULL_REVISION_ROWS-index,
    created_at:new Date(Date.UTC(2026,7,5,0,0,index)).toISOString(),
    snapshot:{title:`Revision ${index+1}`,result:{value:index+1},provenance:{}}
  }));
  const env=baseEnv(async(url)=>{
    const target=new URL(url);
    if(target.pathname==='/rest/v1/qelly_saved_calculations')return jsonResponse([{
      id:CALCULATION_ID,
      workspace_id:WORKSPACE_ID,
      owner_id:USER_ID,
      title:'Bounded calculation',
      result_payload:{value:500},
      provenance:{},
      current_revision:500,
      created_at:'2026-08-05T00:00:00.000Z',
      updated_at:'2026-08-05T01:00:00.000Z',
      deleted_at:null
    }]);
    if(target.pathname==='/rest/v1/qelly_saved_calculation_revisions'){
      revisionQuery=target.searchParams;
      return jsonResponse(revisions);
    }
    throw new Error(`Unexpected URL ${target}`);
  });
  const request=new Request(`${SITE}/api/v1/sync/pull?limit=1`);
  const response=await handleData({request,env},'sync/pull',[],'GET',session,qelly);
  const body=await response.json();
  assert.equal(response.status,200);
  assert.equal(body.revisionHistoryPartial,true);
  assert.equal(body.revisionRowsReturned,500);
  assert.equal(body.revisionRowsLimit,500);
  assert.equal(body.items.length,1);
  assert.equal(body.items[0].revisions.length,500);
  assert.equal(body.items[0].revisions[0].version,1);
  assert.equal(body.items[0].revisions.at(-1).version,500);
  assert.equal(revisionQuery.get('limit'),'500');
  assert.equal(revisionQuery.get('select'),'id,calculation_id,revision_no,created_at,snapshot');
});

test('cloud pull does not claim truncation below the revision limit',async()=>{
  const env=baseEnv(async(url)=>{
    const target=new URL(url);
    if(target.pathname==='/rest/v1/qelly_saved_calculations')return jsonResponse([{
      id:CALCULATION_ID,
      title:'Small history',
      result_payload:{},
      provenance:{},
      current_revision:1,
      created_at:'2026-08-05T00:00:00.000Z',
      updated_at:'2026-08-05T01:00:00.000Z',
      deleted_at:null
    }]);
    if(target.pathname==='/rest/v1/qelly_saved_calculation_revisions')return jsonResponse([{
      id:'55555555-5555-4555-8555-555555555555',
      calculation_id:CALCULATION_ID,
      revision_no:1,
      created_at:'2026-08-05T00:30:00.000Z',
      snapshot:{title:'First',result:{},provenance:{}}
    }]);
    throw new Error(`Unexpected URL ${target}`);
  });
  const request=new Request(`${SITE}/api/v1/sync/pull?limit=1`);
  const response=await handleData({request,env},'sync/pull',[],'GET',session,qelly);
  const body=await response.json();
  assert.equal(body.revisionHistoryPartial,false);
  assert.equal(body.revisionRowsReturned,1);
  assert.equal(body.revisionRowsLimit,500);
});
