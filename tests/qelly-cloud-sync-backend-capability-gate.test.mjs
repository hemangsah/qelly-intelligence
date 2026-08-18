import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {__test as apiTest} from '../functions/api/v1/[[path]].js';

const USER_ID='11111111-1111-4111-8111-111111111111';
const WORKSPACE_ID='22222222-2222-4222-8222-222222222222';
const SITE='https://qelly-intelligence.pages.dev';
const SUPABASE='https://example.supabase.co';

const jwt=()=>{
  const claims={iss:`${SUPABASE}/auth/v1`,aud:'authenticated',exp:Math.floor(Date.now()/1000)+3600,sub:USER_ID};
  return `e30.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.sig`;
};

const environment=(cloudSync=false)=>({
  QELLY_PUBLIC_SITE_URL:SITE,
  QELLY_ALLOWED_ORIGINS:SITE,
  QELLY_PUBLIC_SUPABASE_URL:SUPABASE,
  QELLY_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_test_key_long_enough_for_validation',
  QELLY_ENABLE_CLOUD_SYNC:String(cloudSync),
  QELLY_PUBLIC_RELEASE_SHA:'dadc635b52be95b80b357cd5a78931818a8226ed',
  __fetch:async(url)=>{
    const value=String(url);
    if(value===`${SUPABASE}/auth/v1/user`)return new Response(JSON.stringify({id:USER_ID,email:'test@example.invalid',user_metadata:{}}),{status:200,headers:{'content-type':'application/json'}});
    if(value.includes('/rest/v1/qelly_profiles?'))return new Response(JSON.stringify([{user_id:USER_ID,display_name:'Test',cloud_sync_opt_in:true}]),{status:200,headers:{'content-type':'application/json'}});
    if(value.includes('/rest/v1/qelly_workspaces?'))return new Response(JSON.stringify([{id:WORKSPACE_ID,owner_id:USER_ID,name:'Test Workspace'}]),{status:200,headers:{'content-type':'application/json'}});
    if(value.includes('/rest/v1/qelly_saved_calculations?'))return new Response(JSON.stringify([]),{status:200,headers:{'content-type':'application/json'}});
    throw new Error(`unexpected upstream request: ${value}`);
  }
});

const request=(path,method='GET')=>new Request(`${SITE}/api/v1/${path}`,{
  method,
  headers:{Cookie:`qelly_sb_access=${jwt()}`,Origin:SITE}
});

for(const [path,method] of [['cloud/status','GET'],['sync/push','POST'],['sync/pull','GET']]){
  test(`${method} ${path} fails closed when canonical cloud sync capability is disabled`,async()=>{
    await assert.rejects(
      apiTest.route({request:request(path,method),env:environment(false),params:{path:path.split('/')}}),
      error=>error?.status===503&&error?.code==='cloud_sync_unavailable'&&error?.retryable===false&&error?.details?.capability==='cloudSync'&&error?.details?.truthState==='UNAVAILABLE'
    );
  });
}

test('cloud sync capability helper requires explicit true proof',()=>{
  assert.equal(apiTest.cloudSyncRoute('cloud/status'),true);
  assert.equal(apiTest.cloudSyncRoute('sync/push'),true);
  assert.equal(apiTest.cloudSyncRoute('sync/pull'),true);
  assert.equal(apiTest.cloudSyncRoute('saved-calculations'),false);
  assert.throws(()=>apiTest.requireCloudSyncCapability('sync/pull',{capabilities:{}}),error=>error?.code==='cloud_sync_unavailable');
  assert.throws(()=>apiTest.requireCloudSyncCapability('sync/pull',{capabilities:{cloudSync:false}}),error=>error?.code==='cloud_sync_unavailable');
  assert.doesNotThrow(()=>apiTest.requireCloudSyncCapability('sync/pull',{capabilities:{cloudSync:true}}));
});

test('saved-calculation persistence remains reachable when synchronization is disabled',async()=>{
  const response=await apiTest.route({request:request('saved-calculations'),env:environment(false),params:{path:['saved-calculations']}});
  assert.equal(response.status,200);
  const payload=await response.json();
  assert.deepEqual(payload.items,[]);
});

test('capability gate is ordered after authenticated context and before data dispatch',async()=>{
  const source=await readFile(new URL('../functions/api/v1/[[path]].js',import.meta.url),'utf8');
  assert.match(source,/const session=await resolveSession[\s\S]*const qelly=await bootstrapContext[\s\S]*requireCloudSyncCapability\(path,authRuntime\)[\s\S]*handleData\(/);
});
