import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PostgresDecisionProvenanceStore } from '../src/evidence/postgres-decision-provenance-store.mjs';

test('decision provenance migration uses text identifiers compatible with production identity tables',async()=>{
  const sql=await readFile(new URL('../packages/migrations/105_scope_a_decision_provenance.sql',import.meta.url),'utf8');
  assert.match(sql,/graph_id text PRIMARY KEY/);
  assert.match(sql,/user_id text NOT NULL REFERENCES qelly_users\(user_id\)/);
  assert.doesNotMatch(sql,/user_id uuid/);
});

test('PostgreSQL provenance store scopes graph reads by tenant and workspace',async()=>{
  const queries=[];
  const repository={query:async(sql)=>{queries.push(sql);if(sql.startsWith('SELECT * FROM qelly_evidence_graphs'))return {rows:[]};if(sql.startsWith('SELECT COUNT'))return {rows:[{count:'0'}]};return {rows:[]};}};
  const store=new PostgresDecisionProvenanceStore({repository});
  const result=await store.list({userId:'usr_a',tenantId:'org_a',workspaceId:'ws_a'});
  assert.equal(result.total,0);
  assert.ok(queries.every(sql=>sql.includes("org_a")&&sql.includes("ws_a")));
});
