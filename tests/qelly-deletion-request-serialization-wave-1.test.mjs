import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const migrationUrl=new URL(
  '../packages/migrations/20260805183000_qelly_deletion_request_serialization.sql',
  import.meta.url
);

const readMigration=()=>readFile(migrationUrl,'utf8');

test('deletion requests serialize per authenticated actor before active-request lookup',async()=>{
  const sql=await readMigration();
  assert.match(sql,/create or replace function qelly_private\.qelly_request_account_deletion/i);
  assert.match(sql,/security definer[\s\S]*set search_path\s*=\s*''/i);
  assert.match(sql,/pg_catalog\.pg_advisory_xact_lock\([\s\S]*pg_catalog\.hashtextextended\([\s\S]*v_actor::text/i);
  const lock=sql.indexOf('pg_catalog.pg_advisory_xact_lock');
  const lookup=sql.indexOf('select requested.request_id');
  assert.ok(lock>=0&&lookup>lock,'per-user transaction lock must precede active-request lookup');
});

test('completed, failed and cancelled events all close a deletion request lifecycle',async()=>{
  const sql=await readMigration();
  assert.match(sql,/terminal\.event_type in \('completed','failed','cancelled'\)/i);
  assert.doesNotMatch(sql,/completed\.event_type\s*=\s*'completed'/i);
  assert.match(sql,/order by requested\.occurred_at desc, requested\.id desc/i);
});

test('deletion request RPC remains caller-bound and least privilege',async()=>{
  const sql=await readMigration();
  assert.match(sql,/v_actor uuid := auth\.uid\(\)/i);
  assert.match(sql,/if v_actor is null then[\s\S]*authentication_required/i);
  assert.match(sql,/requested\.owner_id = v_actor/i);
  assert.match(sql,/revoke all on function qelly_private\.qelly_request_account_deletion\(text,text,text\)[\s\S]*from public, anon, authenticated, service_role/i);
  assert.match(sql,/grant execute on function qelly_private\.qelly_request_account_deletion\(text,text,text\)[\s\S]*to authenticated/i);
  assert.doesNotMatch(sql,/grant execute[\s\S]*to (?:public|anon)/i);
});

test('serialized lifecycle model replays active request and permits a new request after terminal event',()=>{
  const activeRequest=(events)=>{
    const terminal=new Set(events.filter(event=>['completed','failed','cancelled'].includes(event.type)).map(event=>event.requestId));
    return [...events]
      .filter(event=>event.type==='requested'&&!terminal.has(event.requestId))
      .sort((left,right)=>right.sequence-left.sequence)[0]?.requestId??null;
  };
  assert.equal(activeRequest([{requestId:'a',type:'requested',sequence:1}]),'a');
  assert.equal(activeRequest([
    {requestId:'a',type:'requested',sequence:1},
    {requestId:'a',type:'failed',sequence:2}
  ]),null);
  assert.equal(activeRequest([
    {requestId:'a',type:'requested',sequence:1},
    {requestId:'a',type:'cancelled',sequence:2},
    {requestId:'b',type:'requested',sequence:3}
  ]),'b');
});
