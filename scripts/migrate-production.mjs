import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { PostgresDirectClient } from '../src/production/postgres-pool-client.mjs';
import { selectForwardMigrationFiles } from './migration-file-policy.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const migrationDir = path.join(root, 'packages/migrations');
const production = process.env.NODE_ENV === 'production';
const databaseUrl = process.env.QELLY_MIGRATION_DATABASE_URL ?? (!production ? process.env.DATABASE_URL : null);
if (!databaseUrl) throw Object.assign(new Error('QELLY_MIGRATION_DATABASE_URL is required in production'), { code: 'migration_database_configuration_missing' });

const args = new Set(process.argv.slice(2));
const mode = args.has('--status') ? 'status' : args.has('--check') ? 'check' : args.has('--dry-run') ? 'dry-run' : 'apply';
const lockTimeoutMs = Math.max(1_000, Math.min(Number(process.env.QELLY_MIGRATION_LOCK_TIMEOUT_MS ?? 30_000), 300_000));
const migrationStatementTimeoutMs = Math.max(30_000, Math.min(Number(process.env.QELLY_MIGRATION_STATEMENT_TIMEOUT_MS ?? 300_000), 900_000));
const advisoryLockId = '7643511194262026';
const checksumOf = (sql) => crypto.createHash('sha256').update(sql).digest('hex');
const withoutOuterTransaction = (sql) => sql
  .replace(/(^|\n)\s*BEGIN;\s*(?=\n)/i, '$1')
  .replace(/\n\s*COMMIT;\s*$/i, '\n');

const files = selectForwardMigrationFiles(await readdir(migrationDir));
const migrations = await Promise.all(files.map(async (file) => {
  const sql = await readFile(path.join(migrationDir, file), 'utf8');
  return { file, sql, checksum: checksumOf(sql) };
}));

const client = new PostgresDirectClient({ databaseUrl, environment: process.env });
let lockHeld = false;
try {
  await client.connect();
  await client.query(`SET statement_timeout TO ${lockTimeoutMs}`);
  if (mode === 'apply') {
    await client.query('SELECT pg_advisory_lock($1::bigint)', [advisoryLockId]);
    lockHeld = true;
    await client.query(`SET statement_timeout TO ${migrationStatementTimeoutMs}`);
    await client.query(`CREATE TABLE IF NOT EXISTS qelly_migration_history(
      migration_id text PRIMARY KEY,
      checksum text NOT NULL,
      applied_at timestamptz NOT NULL DEFAULT now(),
      runtime text NOT NULL
    )`);
  }
  const historyTable = mode === 'apply'
    ? 'qelly_migration_history'
    : (await client.query(`SELECT to_regclass('public.qelly_migration_history') AS relation`)).rows[0]?.relation;
  const history = historyTable
    ? await client.query('SELECT migration_id,checksum,applied_at FROM qelly_migration_history ORDER BY migration_id')
    : { rows: [] };
  const prior = new Map(history.rows.map((row) => [row.migration_id, row]));
  const drift = migrations.filter(({ file, checksum }) => prior.has(file) && prior.get(file).checksum !== checksum);
  if (drift.length) throw Object.assign(new Error(`Migration checksum drift: ${drift.map((item) => item.file).join(', ')}`), { code: 'migration_checksum_drift' });
  const pending = migrations.filter(({ file }) => !prior.has(file));

  if (mode !== 'apply') {
    console.log(JSON.stringify({
      ok: true,
      mode,
      total: migrations.length,
      applied: migrations.length - pending.length,
      pending: pending.map((item) => item.file),
      latestApplied: history.rows.at(-1)?.migration_id ?? null,
      lockAcquired: false,
      databaseMutated: false
    }, null, 2));
  } else {
    const applied = [];
    for (const migration of pending) {
      await client.transaction(async () => {
        await client.query(withoutOuterTransaction(migration.sql));
        await client.query(
          'INSERT INTO qelly_migration_history(migration_id,checksum,runtime) VALUES($1,$2,$3)',
          [migration.file, migration.checksum, 'qelly-controlled-migrator-v2']
        );
      });
      applied.push(migration.file);
    }
    console.log(JSON.stringify({
      ok: true,
      mode,
      applied,
      total: migrations.length,
      latestApplied: migrations.at(-1)?.file ?? null,
      repeatedSafe: applied.length === 0,
      lockAcquired: true,
      transactionBoundary: 'one-transaction-per-migration'
    }, null, 2));
  }
} finally {
  if (lockHeld) await client.query('SELECT pg_advisory_unlock($1::bigint)', [advisoryLockId]).catch(() => {});
  await client.close();
}
