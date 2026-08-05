import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const migrationUrl=new URL(
  '../packages/migrations/20260805180500_qelly_workspace_role_caller_isolation.sql',
  import.meta.url
);

const readMigration=()=>readFile(migrationUrl,'utf8');

test('workspace role helper keeps the policy-compatible signature',async()=>{
  const sql=await readMigration();
  assert.match(sql,/create or replace function qelly_private\.workspace_role\(\s*target_workspace uuid,\s*target_user uuid default auth\.uid\(\)\s*\)/i);
  assert.match(sql,/returns text\s+language sql\s+stable\s+security definer/i);
  assert.match(sql,/set search_path\s*=\s*''/i);
});

test('workspace role helper rejects cross-user membership lookups',async()=>{
  const sql=await readMigration();
  assert.match(sql,/and auth\.uid\(\) is not null/i);
  assert.match(sql,/and target_user = auth\.uid\(\)/i);
  assert.doesNotMatch(sql,/target_user\s*=\s*auth\.uid\(\)\s+or/i);
  assert.doesNotMatch(sql,/auth\.uid\(\)\s+is\s+null\s+or/i);
});

test('workspace role helper retains least-privilege execution grants',async()=>{
  const sql=await readMigration();
  assert.match(sql,/revoke all on function qelly_private\.workspace_role\(uuid,uuid\)[\s\S]*from public, anon, authenticated, service_role/i);
  assert.match(sql,/grant execute on function qelly_private\.workspace_role\(uuid,uuid\)[\s\S]*to authenticated/i);
  assert.doesNotMatch(sql,/grant execute[\s\S]*to (?:public|anon)/i);
});

test('caller-isolation predicate allows only the authenticated identity',()=>{
  const canResolve=(targetUser,authenticatedUser)=>authenticatedUser!==null&&targetUser===authenticatedUser;
  assert.equal(canResolve('user-a','user-a'),true);
  assert.equal(canResolve('user-b','user-a'),false);
  assert.equal(canResolve('user-a',null),false);
});
