import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { PostgresDirectClient } from '../src/production/postgres-pool-client.mjs';
import { migrationProfileForFile, normalizeMigrationProfile, selectMigrationFiles } from './migration-file-policy.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const migrationDir = path.join(root, 'packages/migrations');
const production = process.env.NODE_ENV === 'production';
const databaseUrl = process.env.QELLY_MIGRATION_DATABASE_URL ?? (!production ? process.env.DATABASE_URL : null);
if (!databaseUrl) throw Object.assign(new Error('QELLY_MIGRATION_DATABASE_URL is required in production'), { code: 'migration_database_configuration_missing' });

const profile=normalizeMigrationProfile(process.env.QELLY_MIGRATION_PROFILE,{production});
const args = new Set(process.argv.slice(2));
const mode = args.has('--status') ? 'status' : args.has('--check') ? 'check' : args.has('--dry-run') ? 'dry-run' : 'apply';
const lockTimeoutMs = Math.max(1_000, Math.min(Number(process.env.QELLY_MIGRATION_LOCK_TIMEOUT_MS ?? 30_000), 300_000));
const migrationStatementTimeoutMs = Math.max(30_000, Math.min(Number(process.env.QELLY_MIGRATION_STATEMENT_TIMEOUT_MS ?? 300_000), 900_000));
const advisoryLockId = '7643511194262026';
const checksumOf = (sql) => crypto.createHash('sha256').update(sql).digest('hex');
const withoutOuterTransaction = (sql) => sql
  .replace(/(^|\n)\s*BEGIN;\s*(?=\n)/i, '$1')
  .replace(/\n\s*COMMIT;\s*$/i, '\n');

const files = selectMigrationFiles(await readdir(migrationDir),profile);
if(!files.length)throw Object.assign(new Error(`No ${profile} migrations were selected`),{code:'migration_profile_empty'});
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
  }

  const bootstrap=(await client.query(`
    WITH managed AS (
      SELECT format('%I.%I',n.nspname,c.relname) AS identity
      FROM pg_class c
      JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE c.relkind IN ('r','p','v','m','S')
        AND ((n.nspname='public' AND left(c.relname,6)='qelly_' AND c.relname<>'qelly_migration_history') OR n.nspname='qelly_private')
      UNION ALL
      SELECT format('%I.%I(%s)',n.nspname,p.proname,pg_get_function_identity_arguments(p.oid))
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE (n.nspname='public' AND left(p.proname,6)='qelly_') OR n.nspname='qelly_private'
    )
    SELECT to_regclass('public.qelly_migration_history')::text AS history_table,
           COALESCE(array_agg(identity ORDER BY identity) FILTER (WHERE identity IS NOT NULL),'{}'::text[]) AS managed_objects
    FROM managed
  `)).rows[0]??{};
  const historyPresent=Boolean(bootstrap.history_table);
  const managedObjects=Array.isArray(bootstrap.managed_objects)?bootstrap.managed_objects:[];
  if(!historyPresent&&managedObjects.length){
    const error=new Error(`Migration history is missing while Qelly-managed objects already exist. Refusing ${profile} replay; establish a reviewed baseline first.`);
    error.code='migration_history_bootstrap_required';
    error.details={profile,managedObjectCount:managedObjects.length,managedObjects:managedObjects.slice(0,12)};
    throw error;
  }

  if (mode === 'apply' && !historyPresent) {
    await client.query(`CREATE TABLE public.qelly_migration_history(
      migration_id text PRIMARY KEY,
      checksum text NOT NULL,
      applied_at timestamptz NOT NULL DEFAULT now(),
      runtime text NOT NULL
    )`);
  }
  const historyTable = historyPresent || mode === 'apply';
  const history = historyTable
    ? await client.query('SELECT migration_id,checksum,applied_at,runtime FROM public.qelly_migration_history ORDER BY migration_id')
    : { rows: [] };
  const incompatible=history.rows.filter((row)=>migrationProfileForFile(row.migration_id)!==profile);
  if(incompatible.length){
    const error=new Error(`Migration history belongs to a different profile: ${incompatible.map((row)=>row.migration_id).slice(0,8).join(', ')}`);
    error.code='migration_profile_mismatch';
    error.details={requestedProfile:profile,incompatibleMigrations:incompatible.map((row)=>row.migration_id)};
    throw error;
  }
  const prior = new Map(history.rows.map((row) => [row.migration_id, row]));
  const drift = migrations.filter(({ file, checksum }) => prior.has(file) && prior.get(file).checksum !== checksum);
  if (drift.length) throw Object.assign(new Error(`Migration checksum drift: ${drift.map((item) => item.file).join(', ')}`), { code: 'migration_checksum_drift' });
  const pending = migrations.filter(({ file }) => !prior.has(file));

  if (mode !== 'apply') {
    console.log(JSON.stringify({
      ok: true,
      mode,
      profile,
      total: migrations.length,
      applied: migrations.length - pending.length,
      pending: pending.map((item) => item.file),
      latestApplied: history.rows.at(-1)?.migration_id ?? null,
      migrationHistoryPresent:historyPresent,
      managedObjectCount:managedObjects.length,
      lockAcquired: false,
      databaseMutated: false
    }, null, 2));
  } else {
    const applied = [];
    for (const migration of pending) {
      await client.transaction(async () => {
        await client.query(withoutOuterTransaction(migration.sql));
        await client.query(
          'INSERT INTO public.qelly_migration_history(migration_id,checksum,runtime) VALUES($1,$2,$3)',
          [migration.file, migration.checksum, `qelly-controlled-migrator-v3:${profile}`]
        );
      });
      applied.push(migration.file);
    }
    console.log(JSON.stringify({
      ok: true,
      mode,
      profile,
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
