import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const migration=()=>readFile(new URL('../packages/migrations/20260807040500_qelly_sync_batches_explicit_client_deny.sql',import.meta.url),'utf8');

test('private sync-batch policy explicitly denies direct browser roles',async()=>{
  const sql=await migration();
  assert.match(sql,/CREATE POLICY qelly_sync_batches_explicit_client_deny/i);
  assert.match(sql,/AS RESTRICTIVE/i);
  assert.match(sql,/FOR ALL\s+TO anon, authenticated/i);
  assert.match(sql,/USING \(false\)/i);
  assert.match(sql,/WITH CHECK \(false\)/i);
  assert.doesNotMatch(sql,/TO service_role/i);
});

test('policy documents the only governed synchronization boundary',async()=>{
  const sql=await migration();
  assert.match(sql,/only through qelly_private\.qelly_sync_push_batch/i);
  assert.match(sql,/SECURITY DEFINER/i);
  assert.match(sql,/workspace role and cloud opt-in/i);
});
