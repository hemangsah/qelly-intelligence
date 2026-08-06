import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const sources=()=>Promise.all([
  readFile(new URL('../functions/api/v1/_middleware.js',import.meta.url),'utf8'),
  readFile(new URL('../functions/_lib/data.js',import.meta.url),'utf8'),
  readFile(new URL('../functions/_lib/governance.js',import.meta.url),'utf8')
]);

test('API middleware intercepts governed and transactional-email writes before the legacy router',async()=>{
  const [middleware]=await sources();
  assert.match(middleware,/governanceRoute\(path,method\)/);
  assert.match(middleware,/transactionalEmailRoute\(path,method\)/);
  assert.match(middleware,/handleGovernance\(context,path,method,session,qelly\)/);
  assert.match(middleware,/if\(!interceptReadiness&&!interceptGovernance&&!interceptEmail\)return context\.next\(\)/);
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
  assert.match(governance,/rpc\/qelly_request_account_deletion/);
  assert.match(governance,/rpc\/qelly_complete_account_deletion/);
  const implementationSources=`${data}\n${governance}`;
  assert.equal((implementationSources.match(/path==='cloud\/opt-in'/g)||[]).length,1);
  assert.equal((implementationSources.match(/path==='account\/delete'/g)||[]).length,1);
  assert.match(middleware,/path==='cloud\/opt-in'/);
  assert.match(middleware,/path==='account\/delete'/);
});

test('deletion evidence brackets optional identity deletion',async()=>{
  const [,,governance]=await sources();
  const requestEvidence=governance.indexOf('rpc/qelly_request_account_deletion');
  const adminDelete=governance.indexOf('/auth/v1/admin/users/');
  const completionEvidence=governance.indexOf('/rest/v1/rpc/qelly_complete_account_deletion');
  assert.ok(requestEvidence>=0&&adminDelete>requestEvidence,'request evidence must precede identity deletion');
  assert.ok(completionEvidence>adminDelete,'completion evidence must follow identity deletion');
  assert.match(governance,/identity_deleted_evidence_pending/);
});
