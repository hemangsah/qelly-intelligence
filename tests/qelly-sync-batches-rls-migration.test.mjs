import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const migration=()=>readFile(new URL('../packages/migrations/20260807040000_qelly_sync_batches_private_rls.sql',import.meta.url),'utf8');

test('private sync-batch ledger enables non-forced RLS and exposes no client policy',async()=>{
  const sql=await migration();
  assert.match(sql,/ALTER TABLE qelly_private\.sync_batches ENABLE ROW LEVEL SECURITY;/i);
  assert.doesNotMatch(sql,/FORCE ROW LEVEL SECURITY/i);
  assert.doesNotMatch(sql,/CREATE\s+POLICY/i);
  assert.match(sql,/REVOKE ALL ON TABLE qelly_private\.sync_batches FROM PUBLIC;/i);
  assert.match(sql,/REVOKE ALL ON TABLE qelly_private\.sync_batches FROM anon;/i);
  assert.match(sql,/REVOKE ALL ON TABLE qelly_private\.sync_batches FROM authenticated;/i);
});

test('migration refuses to change the owner-executed security-definer boundary',async()=>{
  const sql=await migration();
  assert.match(sql,/table_owner IS DISTINCT FROM 'postgres'/i);
  assert.match(sql,/function_owner IS DISTINCT FROM table_owner/i);
  assert.match(sql,/is_security_definer IS DISTINCT FROM true/i);
  assert.match(sql,/authentication, workspace-role and cloud-opt-in checks/i);
});
