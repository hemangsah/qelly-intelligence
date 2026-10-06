import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import pg from 'pg';

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL required for disposable CI PostgreSQL');
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  await client.query('BEGIN');
  const migration = await readFile(new URL('../supabase/migrations/20261004164000_qelly_release_metadata_retention_v1.sql', import.meta.url), 'utf8');
  // Execute the exact migration against a transaction-local table, never a release row.
  await client.query(`CREATE TEMP TABLE qelly_release_metadata_test (
    environment text, release_key text, source_revision text, metadata jsonb,
    PRIMARY KEY (environment, release_key))`);
  await client.query(migration.replace('before update on public.qelly_release_identity', 'before update on pg_temp.qelly_release_metadata_test'));
  const insert = `INSERT INTO pg_temp.qelly_release_metadata_test VALUES ($1,$2,$3,$4::jsonb)
    ON CONFLICT (environment,release_key) DO UPDATE SET metadata=excluded.metadata,
    source_revision=excluded.source_revision RETURNING metadata`;
  const write = async (key, sha, metadata) => (await client.query(insert, ['test', key, sha, JSON.stringify(metadata)])).rows[0].metadata;
  await write('fixture:a', 'a', { testedHead: 'candidate', productionChecksPending: false, buildTimestamp: 'old' });
  assert.deepEqual(await write('fixture:a', 'a', { buildTimestamp: 'current', cloudSync: true }), {
    testedHead: 'candidate', productionChecksPending: false, buildTimestamp: 'current', cloudSync: true
  });
  assert.equal((await write('fixture:a', 'a', { productionChecksPending: true })).productionChecksPending, true);
  assert.equal((await write('fixture:a', 'a', { testedHead: null })).testedHead, null);
  assert.deepEqual(await write('fixture:b', 'b', { buildTimestamp: 'new-release' }), { buildTimestamp: 'new-release' });
  assert.deepEqual(await write('fixture:a', 'changed-sha', { buildTimestamp: 'changed-identity' }), { buildTimestamp: 'changed-identity' });
  console.log('Release metadata: repeated upsert retention, current-key authority, explicit invalidation and identity isolation passed');
} finally {
  await client.query('ROLLBACK').catch(() => {});
  await client.end();
}
