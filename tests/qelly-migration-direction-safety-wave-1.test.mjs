import test from 'node:test';
import assert from 'node:assert/strict';
import {readdir,readFile} from 'node:fs/promises';
import {isForwardMigrationFile,selectForwardMigrationFiles} from '../scripts/migration-file-policy.mjs';

const migrationDirectory=new URL('../packages/migrations/',import.meta.url);

test('forward migration policy rejects reverse and non-migration files',()=>{
  for(const name of [
    '110_prompt2c_global_public_beta.down.sql',
    '110_prompt2c_global_public_beta.rollback.sql',
    '110_prompt2c_global_public_beta.undo.sql',
    'README.md',
    '.hidden.sql',
    '../110_escape.sql',
    'nested/110_escape.sql'
  ])assert.equal(isForwardMigrationFile(name),false,name);

  for(const name of [
    '001_foundation.sql',
    '110a_qelly_private_workspace_role_policy_transition.sql',
    '20260805030200_qelly_private_rpc_implementations.sql'
  ])assert.equal(isForwardMigrationFile(name),true,name);
});

test('repository rollback artifact is never selected by the production runner',async()=>{
  const names=await readdir(migrationDirectory);
  assert.equal(names.includes('110_prompt2c_global_public_beta.down.sql'),true);
  const selected=selectForwardMigrationFiles(names);
  assert.equal(selected.includes('110_prompt2c_global_public_beta.down.sql'),false);
  assert.equal(selected.includes('109_prompt2c_global_public_beta.sql'),true);
  assert.equal(selected.includes('110_prompt2c_revision_trigger_order.sql'),true);
  assert.equal(selected.includes('110a_qelly_private_workspace_role_policy_transition.sql'),true);
  assert.deepEqual(selected,[...selected].sort());
});

test('production migrator delegates file selection to the forward-only policy',async()=>{
  const source=await readFile(new URL('../scripts/migrate-production.mjs',import.meta.url),'utf8');
  assert.match(source,/import \{ selectForwardMigrationFiles \} from '\.\/migration-file-policy\.mjs';/);
  assert.match(source,/const files = selectForwardMigrationFiles\(await readdir\(migrationDir\)\);/);
  assert.doesNotMatch(source,/filter\(\(name\) => \/\^\\d\+\.\*\\\.sql\$\//);
});
