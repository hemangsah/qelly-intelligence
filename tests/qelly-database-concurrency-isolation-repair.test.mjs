import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const workspaceMigration=()=>readFile(new URL('../packages/migrations/20260806152500_qelly_workspace_role_caller_isolation.sql',import.meta.url),'utf8');
const deletionMigration=()=>readFile(new URL('../packages/migrations/20260806153000_qelly_deletion_request_serialization.sql',import.meta.url),'utf8');

test('workspace role helper preserves policy signature and binds lookup to auth uid',async()=>{
  const sql=await workspaceMigration();
  assert.match(sql,/create or replace function qelly_private\.workspace_role\(\s*target_workspace uuid,\s*target_user uuid default auth\.uid\(\)\s*\)/i);
  assert.match(sql,/returns text\s+language sql\s+stable\s+security definer/i);
  assert.match(sql,/set search_path\s*=\s*''/i);
  assert.match(sql,/and auth\.uid\(\) is not null/i);
  assert.match(sql,/and target_user = auth\.uid\(\)/i);
  assert.doesNotMatch(sql,/auth\.uid\(\)\s+is\s+null\s+or/i);
});

test('workspace role helper retains least privilege execution grants',async()=>{
  const sql=await workspaceMigration();
  assert.match(sql,/revoke all on function qelly_private\.workspace_role\(uuid,uuid\)[\s\S]*from public, anon, authenticated, service_role/i);
  assert.match(sql,/grant execute on function qelly_private\.workspace_role\(uuid,uuid\)[\s\S]*to authenticated/i);
  assert.doesNotMatch(sql,/grant execute[\s\S]*to (?:public|anon)/i);
});

test('deletion requests serialize per actor before active request lookup',async()=>{
  const sql=await deletionMigration();
  assert.match(sql,/pg_catalog\.pg_advisory_xact_lock\([\s\S]*pg_catalog\.hashtextextended\([\s\S]*v_actor::text/i);
  const lock=sql.indexOf('pg_catalog.pg_advisory_xact_lock');
  const lookup=sql.indexOf('select requested.request_id');
  assert.ok(lock>=0&&lookup>lock,'per-user transaction lock must precede active-request lookup');
  assert.match(sql,/terminal\.event_type in \('completed','failed','cancelled'\)/i);
  assert.match(sql,/order by requested\.occurred_at desc, requested\.id desc/i);
});

test('deletion RPC remains caller bound and least privilege',async()=>{
  const sql=await deletionMigration();
  assert.match(sql,/v_actor uuid := auth\.uid\(\)/i);
  assert.match(sql,/if v_actor is null then[\s\S]*authentication_required/i);
  assert.match(sql,/requested\.owner_id = v_actor/i);
  assert.match(sql,/revoke all on function qelly_private\.qelly_request_account_deletion\(text,text,text\)[\s\S]*from public, anon, authenticated, service_role/i);
  assert.match(sql,/grant execute on function qelly_private\.qelly_request_account_deletion\(text,text,text\)[\s\S]*to authenticated/i);
});
