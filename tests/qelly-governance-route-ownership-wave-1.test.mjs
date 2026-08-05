import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const readSources=()=>Promise.all([
  readFile(new URL('../functions/api/v1/[[path]].js',import.meta.url),'utf8'),
  readFile(new URL('../functions/_lib/data.js',import.meta.url),'utf8'),
  readFile(new URL('../functions/_lib/governance.js',import.meta.url),'utf8')
]);

test('authenticated router dispatches governance before general data routes',async()=>{
  const [router]=await readSources();
  assert.match(router,/import \{handleGovernance\} from '\.\.\/\.\.\/_lib\/governance\.js';/);
  assert.match(router,/const governance=await handleGovernance\(context,path,method,session,qelly\);/);
  assert.match(router,/if\(governance\)return governance;/);
  const governanceCall=router.indexOf('const governance=await handleGovernance');
  const dataCall=router.indexOf('const data=await handleData');
  assert.ok(governanceCall>=0&&dataCall>governanceCall,'governance must own its routes before handleData');
});

test('legacy data module cannot bypass consent or deletion evidence',async()=>{
  const [,data]=await readSources();
  assert.doesNotMatch(data,/path==='cloud\/opt-in'/);
  assert.doesNotMatch(data,/path==='account\/delete'/);
  assert.doesNotMatch(data,/qelly_account_deletion_requests/);
  assert.doesNotMatch(data,/auth\/v1\/admin\/users/);
  assert.doesNotMatch(data,/QELLY_SUPABASE_SERVICE_ROLE_KEY/);
  assert.doesNotMatch(data,/cloud_sync_opt_in:enabled/);
});

test('governance module is the single route owner for durable consent and deletion evidence',async()=>{
  const [router,data,governance]=await readSources();
  assert.match(governance,/path==='cloud\/opt-in'&&method==='POST'/);
  assert.match(governance,/rpc\/qelly_set_cloud_sync_consent/);
  assert.match(governance,/path==='account\/delete'&&method==='POST'/);
  assert.match(governance,/rpc\/qelly_request_account_deletion/);
  assert.match(governance,/rpc\/qelly_complete_account_deletion/);
  const combined=`${router}\n${data}\n${governance}`;
  assert.equal((combined.match(/path==='cloud\/opt-in'/g)||[]).length,1);
  assert.equal((combined.match(/path==='account\/delete'/g)||[]).length,1);
});

test('deletion evidence is requested before optional Supabase Admin deletion',async()=>{
  const [,,governance]=await readSources();
  const requestEvidence=governance.indexOf("rpc/qelly_request_account_deletion");
  const adminDelete=governance.indexOf('/auth/v1/admin/users/');
  const completionEvidence=governance.indexOf('rpc/qelly_complete_account_deletion');
  assert.ok(requestEvidence>=0&&adminDelete>requestEvidence,'request evidence must precede identity deletion');
  assert.ok(completionEvidence>adminDelete,'completion evidence must follow successful identity deletion');
  assert.match(governance,/status=identityDeleted[\s\S]*identity_deleted_evidence_pending/);
});
