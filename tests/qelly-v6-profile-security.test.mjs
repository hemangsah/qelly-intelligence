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

test('profile writes remain authenticated, CSRF protected and RLS-scoped through the user token',async()=>{
  const source=await read('functions/api/v1/profile.js');
  assert.match(source,/resolveSession\(request,env,\{required:true\}\)/);
  assert.match(source,/requireCsrf\(request\)/);
  assert.match(source,/qelly_profiles\?user_id=eq\.\$\{session\.user\.id\}/);
  assert.match(source,/method:'PATCH'/);
  assert.match(source,/prefer:'return=representation'/);
  assert.doesNotMatch(source,/SUPABASE_SERVICE_ROLE_KEY|service_role/i);
});

test('V6 account workspace persists real profile fields and keeps unavailable security features non-interactive',async()=>{
  const source=await read('apps/web/public/assets/routes/account-session.mjs');
  assert.match(source,/\/api\/v1\/profile/);
  assert.match(source,/method:'PATCH'/);
  for(const field of ['displayName','baseCurrency','timezone','cloudSyncOptIn'])assert.match(source,new RegExp(field));
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
