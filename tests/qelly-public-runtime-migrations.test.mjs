import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const migration=await readFile(new URL('../packages/migrations/109_prompt2c_global_public_beta.sql',import.meta.url),'utf8');
const triggerFix=await readFile(new URL('../packages/migrations/110_prompt2c_revision_trigger_order.sql',import.meta.url),'utf8');
const rollback=await readFile(new URL('../packages/migrations/110_prompt2c_global_public_beta.down.sql',import.meta.url),'utf8');

test('migration creates required cloud lifecycle tables',()=>{
  for(const table of ['qelly_profiles','qelly_workspaces','qelly_workspace_members','qelly_saved_calculations','qelly_saved_calculation_revisions','qelly_sync_operations','qelly_provider_cache','qelly_feedback','qelly_account_deletion_requests','qelly_audit_events']){
    assert.match(migration,new RegExp(`create table if not exists public\\.${table}`));
  }
});

test('every user-owned cloud table enables RLS',()=>{
  for(const table of ['qelly_profiles','qelly_workspaces','qelly_workspace_members','qelly_saved_calculations','qelly_saved_calculation_revisions','qelly_sync_operations','qelly_feedback','qelly_account_deletion_requests','qelly_audit_events']){
    assert.match(migration,new RegExp(`alter table public\\.${table} enable row level security`));
  }
});

test('cross-user access requires auth uid or workspace membership',()=>{
  assert.match(migration,/user_id=auth\.uid\(\)/);
  assert.match(migration,/owner_id=auth\.uid\(\)/);
  assert.match(migration,/qelly_workspace_role\(workspace_id,auth\.uid\(\)\)/);
  assert.doesNotMatch(migration,/create policy[^;]+using \(true\)/is);
});

test('provider cache has no browser write policy',()=>{
  assert.match(migration,/qelly_provider_cache and audit-event inserts intentionally have no browser write policy/);
  assert.doesNotMatch(migration,/create policy[^;]+qelly_provider_cache[^;]+for insert/is);
});

test('revision capture runs after base row persistence',()=>{
  assert.match(triggerFix,/before update on public\.qelly_saved_calculations/);
  assert.match(triggerFix,/after insert or update on public\.qelly_saved_calculations/);
  assert.match(triggerFix,/on conflict \(calculation_id,revision_no\) do nothing/);
});

test('rollback removes triggers, functions and all public-runtime tables',()=>{
  assert.match(rollback,/drop trigger if exists qelly_calculation_capture_revision/);
  assert.match(rollback,/drop function if exists public\.qelly_workspace_role/);
  assert.match(rollback,/drop table if exists public\.qelly_profiles cascade/);
  assert.match(rollback,/commit;/);
});
