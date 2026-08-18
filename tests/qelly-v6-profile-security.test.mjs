import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {__profileRouteTest} from '../functions/api/v1/profile.js';

const read=(path)=>readFile(new URL(`../${path}`,import.meta.url),'utf8');

test('profile validation matches the production profile schema boundary',()=>{
  const {BASE_CURRENCIES,safeCurrency,safeTimezone}=__profileRouteTest;
  assert.deepEqual([...BASE_CURRENCIES],['USD','INR','EUR','GBP','SGD','AED','JPY']);
  assert.equal(safeCurrency('inr'),'INR');
  assert.equal(safeTimezone('Asia/Kolkata'),'Asia/Kolkata');
  assert.equal(safeTimezone('Asia/Calcutta'),'Asia/Kolkata');
  assert.throws(()=>safeCurrency('BTC'),/Base currency is not supported/);
  assert.throws(()=>safeTimezone('not a timezone'),/Timezone is not recognized/);
});

test('profile capability payload exposes cloud sync explicitly and fails closed when proof is absent',()=>{
  const {profilePayload}=__profileRouteTest;
  const context={
    user:{userId:'00000000-0000-4000-8000-000000000001',email:'test@example.invalid',emailConfirmedAt:null,displayName:'Test'},
    profile:{display_name:'Test',base_currency:'USD',timezone:'UTC',cloud_sync_opt_in:true},
    workspace:{workspaceId:'00000000-0000-4000-8000-000000000002',name:'Test Workspace'},
    session:{}
  };
  assert.equal(profilePayload(context,{capabilities:{cloudSync:true}}).capabilities.cloudSync,true);
  assert.equal(profilePayload(context,{capabilities:{cloudSync:false}}).capabilities.cloudSync,false);
  assert.equal(profilePayload(context).capabilities.cloudSync,false);
});

test('profile writes remain authenticated, CSRF protected and RLS-scoped through the user token',async()=>{
  const source=await read('functions/api/v1/profile.js');
  assert.match(source,/resolveSession\(request,env,\{required:true\}\)/);
  assert.match(source,/requireCsrf\(request\)/);
  assert.match(source,/qelly_profiles\?user_id=eq\.\$\{session\.user\.id\}/);
  assert.match(source,/method:'PATCH'/);
  assert.match(source,/prefer:'return=representation'/);
  assert.match(source,/effectivePublicRuntimeConfig\(env,request\.url\)/);
  assert.match(source,/cloudSync:runtime\?\.capabilities\?\.cloudSync===true/);
  assert.doesNotMatch(source,/SUPABASE_SERVICE_ROLE_KEY|service_role/i);
});

test('V6 account workspace persists real profile fields and fails closed on cloud-sync capability',async()=>{
  const source=await read('apps/web/public/assets/routes/account-session.mjs');
  assert.match(source,/\/api\/v1\/profile/);
  assert.match(source,/method:'PATCH'/);
  for(const field of ['displayName','baseCurrency','timezone','cloudSyncOptIn'])assert.match(source,new RegExp(field));
  assert.match(source,/profileCapabilities\.cloudSync===true/);
  assert.doesNotMatch(source,/profileCapabilities\.cloudSync!==false/);
  assert.match(source,/data-cloud-sync-state=/);
  assert.match(source,/if\(cloudSyncAvailable\)payload\.cloudSyncOptIn=/);
  assert.match(source,/Any stored opt-in is retained but inactive/);
  assert.match(source,/MFA \/ TOTP/);
  assert.match(source,/Remote session control/);
  assert.match(source,/UNAVAILABLE/);
  assert.doesNotMatch(source,/enableMfa|registerPasskey|remoteRevoke/);
});

test('profile and security presentation is a dedicated V6 responsive surface',async()=>{
  const css=await read('apps/web/public/assets/routes/account-session-v6.css');
  assert.match(css,/q-v6-account-hero/);
  assert.match(css,/q-v6-profile-layout/);
  assert.match(css,/q-v6-capability-grid/);
  assert.match(css,/prefers-reduced-motion/);
});
