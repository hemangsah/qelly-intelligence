import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const sources=()=>Promise.all([
  readFile(new URL('../functions/api/v1/_middleware.js',import.meta.url),'utf8'),
  readFile(new URL('../functions/_lib/data.js',import.meta.url),'utf8'),
  readFile(new URL('../functions/_lib/governance.js',import.meta.url),'utf8')
]);

test('API middleware intercepts governed writes and registration preference validation before the legacy router',async()=>{
  const [middleware]=await sources();
  assert.match(middleware,/governanceRoute\(path,method\)/);
  assert.match(middleware,/registrationRoute\(path,method\)/);
  assert.match(middleware,/authMutationRoute\(path,method\)/);
  assert.match(middleware,/handleGovernance\(context,path,method,session,qelly\)/);
  assert.match(middleware,/if\(!interceptReadiness&&!interceptGovernance&&!interceptRegistration&&!interceptAuthMutation\)return context\.next\(\)/);
});

test('general data module has no consent or deletion write implementation',async()=>{
  const [,data]=await sources();
  assert.doesNotMatch(data,/path==='cloud\/opt-in'/);
  assert.doesNotMatch(data,/path==='account\/delete'/);
  assert.doesNotMatch(data,/qelly_account_deletion_requests/);
  assert.doesNotMatch(data,/auth\/v1\/admin\/users/);
  assert.doesNotMatch(data,/QELLY_SUPABASE_SERVICE_ROLE_KEY/);
  assert.doesNotMatch(data,/cloud_sync_opt_in:enabled/);
});

test('governance module is the only implementation owner',async()=>{
  const [middleware,data,governance]=await sources();
  assert.match(governance,/path==='cloud\/opt-in'&&method==='POST'/);
  assert.match(governance,/rpc\/qelly_set_cloud_sync_consent/);
  assert.match(governance,/path==='account\/delete'&&method==='POST'/);
  assert.match(governance,/rpc\/qelly_self_delete_account/);
  assert.doesNotMatch(governance,/rpc\/qelly_request_account_deletion/);
  assert.doesNotMatch(governance,/rpc\/qelly_complete_account_deletion/);
  assert.doesNotMatch(governance,/auth\/v1\/admin\/users/);
  assert.doesNotMatch(governance,/QELLY_SUPABASE_SERVICE_ROLE_KEY/);
  const implementationSources=`${data}\n${governance}`;
  assert.equal((implementationSources.match(/path==='cloud\/opt-in'/g)||[]).length,1);
  assert.equal((implementationSources.match(/path==='account\/delete'/g)||[]).length,1);
  assert.match(middleware,/path==='cloud\/opt-in'/);
  assert.match(middleware,/path==='account\/delete'/);
});

test('account deletion delegates one authenticated atomic transaction to Supabase and clears the browser session',async()=>{
  const [,,governance]=await sources();
  assert.match(governance,/restRequest\(env,session\.accessToken,'rpc\/qelly_self_delete_account'/);
  assert.match(governance,/p_reason:cleanText\(body\.reason,500\)\|\|null/);
  assert.match(governance,/p_privacy_version:privacyVersion/);
  assert.match(governance,/p_terms_version:termsVersion/);
  assert.match(governance,/identityDeleted:deletion\.identityDeleted===true/);
  assert.match(governance,/evidenceCompleted:deletion\.evidenceCompleted===true/);
  assert.match(governance,/cookies:clearSessionCookies\(\)/);
  assert.doesNotMatch(governance,/auth\/v1\/admin\/users/);
  assert.doesNotMatch(governance,/QELLY_SUPABASE_SERVICE_ROLE_KEY/);
});
