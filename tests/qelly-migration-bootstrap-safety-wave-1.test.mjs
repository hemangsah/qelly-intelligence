import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {
  assertSafeMigrationBootstrap,
  migrationBootstrapState
} from '../scripts/migration-bootstrap-policy.mjs';

test('clean database without migration history is eligible for first provisioning',()=>{
  const state=migrationBootstrapState({history_table:null,managed_objects:[]});
  assert.equal(state.historyTable,null);
  assert.equal(state.managedObjects.length,0);
  assert.equal(state.bootstrapConflict,false);
  assert.equal(assertSafeMigrationBootstrap(state),state);
});

test('managed database with migration history remains eligible for incremental migrations',()=>{
  const state=migrationBootstrapState({
    history_table:'qelly_migration_history',
    managed_objects:[{kind:'relation',identity:'public.qelly_workspaces'}]
  });
  assert.equal(state.historyTable,'qelly_migration_history');
  assert.equal(state.managedObjects.length,1);
  assert.equal(state.bootstrapConflict,false);
  assert.equal(assertSafeMigrationBootstrap(state),state);
});

test('existing managed schema without migration history fails closed',()=>{
  const state=migrationBootstrapState({
    history_table:null,
    managed_objects:[
      {kind:'relation',identity:'public.qelly_workspaces'},
      {kind:'function',identity:'public.qelly_sync_push_batch(uuid,text,text,jsonb)'}
    ]
  });
  assert.equal(state.bootstrapConflict,true);
  assert.throws(
    ()=>assertSafeMigrationBootstrap(state),
    error=>{
      assert.equal(error?.code,'migration_history_bootstrap_required');
      assert.equal(error?.details?.historyTable,null);
      assert.equal(error?.details?.managedObjectCount,2);
      assert.match(error?.message||'',/Refusing to replay migrations/i);
      return true;
    }
  );
});

test('production migrator probes both relations and routines before creating history',async()=>{
  const source=await readFile(new URL('../scripts/migrate-production.mjs',import.meta.url),'utf8');
  assert.match(source,/WITH managed_objects AS/i);
  assert.match(source,/FROM pg_class relation/i);
  assert.match(source,/FROM pg_proc routine/i);
  assert.match(source,/relation\.relname <> 'qelly_migration_history'/i);
  assert.match(source,/const bootstrap = migrationBootstrapState\(bootstrapProbe\.rows\[0\]\);/);
  assert.match(source,/assertSafeMigrationBootstrap\(bootstrap\);/);
  assert.match(source,/if \(mode === 'apply' && !bootstrap\.historyTable\)/);
  const guard=source.indexOf('assertSafeMigrationBootstrap(bootstrap);');
  const create=source.indexOf('CREATE TABLE public.qelly_migration_history');
  assert.ok(guard>=0&&create>guard,'bootstrap guard must run before migration-history creation');
});

test('production migrator never uses create-if-not-exists to conceal an unmanaged baseline',async()=>{
  const source=await readFile(new URL('../scripts/migrate-production.mjs',import.meta.url),'utf8');
  assert.doesNotMatch(source,/CREATE TABLE IF NOT EXISTS qelly_migration_history/i);
  assert.doesNotMatch(source,/CREATE TABLE IF NOT EXISTS public\.qelly_migration_history/i);
});
