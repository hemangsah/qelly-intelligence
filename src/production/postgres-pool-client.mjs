import { AsyncLocalStorage } from 'node:async_hooks';
import pg from 'pg';

const { Pool, Client } = pg;

function integer(value, fallback, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) {
  if (value == null || String(value).trim() === '') return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(min, Math.min(max, Math.trunc(parsed))) : fallback;
}

export function postgresTlsOptions({ databaseUrl, environment = process.env } = {}) {
  const url = new URL(databaseUrl);
  const sslMode = String(url.searchParams.get('sslmode') ?? environment.QELLY_POSTGRES_TLS_MODE ?? '').toLowerCase();
  const production = environment.NODE_ENV === 'production';
  if (production && !['require', 'verify-ca', 'verify-full'].includes(sslMode)) {
    throw Object.assign(new Error('Production PostgreSQL URLs must set sslmode=require, verify-ca, or verify-full'), {
      code: 'postgres_tls_required'
    });
  }
  if (!sslMode || sslMode === 'disable') return undefined;
  const caEncoded = String(environment.QELLY_POSTGRES_TLS_CA_BASE64 ?? '').trim();
  const ca = caEncoded ? Buffer.from(caEncoded, 'base64').toString('utf8') : undefined;
  return {
    rejectUnauthorized: environment.QELLY_POSTGRES_TLS_REJECT_UNAUTHORIZED !== 'false',
    ...(ca ? { ca } : {})
  };
}

export function postgresConnectionOptions({ databaseUrl, environment = process.env, applicationName }) {
  const url = new URL(databaseUrl);
  if (!['postgres:', 'postgresql:'].includes(url.protocol)) throw Object.assign(new Error('PostgreSQL connection URL is invalid'), { code: 'postgres_url_invalid' });
  const authentication = Object.fromEntries([
    ['user', decodeURIComponent(url.username)],
    ['password', decodeURIComponent(url.password)]
  ]);
  return {
    host: url.hostname.replace(/^\[|\]$/g, ''),
    port: integer(url.port || undefined, 5432, { min: 1, max: 65535 }),
    ...authentication,
    database: decodeURIComponent(url.pathname.replace(/^\//, '')),
    application_name: applicationName,
    ssl: postgresTlsOptions({ databaseUrl, environment }),
    connectionTimeoutMillis: integer(environment.QELLY_POSTGRES_CONNECT_TIMEOUT_MS, 10_000, { min: 1_000, max: 60_000 }),
    statement_timeout: integer(environment.QELLY_POSTGRES_STATEMENT_TIMEOUT_MS, 30_000, { min: 1_000, max: 300_000 }),
    query_timeout: integer(environment.QELLY_POSTGRES_QUERY_TIMEOUT_MS, 35_000, { min: 1_000, max: 305_000 }),
    keepAlive: true
  };
}

export class PostgresPoolClient {
  constructor({ databaseUrl, environment = process.env, pool = null } = {}) {
    if (!databaseUrl) throw Object.assign(new Error('DATABASE_URL is required'), { code: 'database_configuration_missing' });
    this.environment = environment;
    this.storage = new AsyncLocalStorage();
    this.pool = pool ?? new Pool({
      ...postgresConnectionOptions({ databaseUrl, environment, applicationName: 'qelly-api' }),
      max: integer(environment.QELLY_POSTGRES_POOL_MAX, 12, { min: 2, max: 50 }),
      min: integer(environment.QELLY_POSTGRES_POOL_MIN, 1, { min: 0, max: 20 }),
      idleTimeoutMillis: integer(environment.QELLY_POSTGRES_IDLE_TIMEOUT_MS, 30_000, { min: 1_000, max: 300_000 }),
      maxLifetimeSeconds: integer(environment.QELLY_POSTGRES_MAX_LIFETIME_SECONDS, 1_800, { min: 60, max: 86_400 }),
      allowExitOnIdle: false
    });
    this.parameters = {};
    this.connected = false;
    this.closed = false;
  }

  async connect() {
    if (this.closed) throw Object.assign(new Error('PostgreSQL pool is closed'), { code: 'postgres_pool_closed' });
    if (!this.connected) {
      const result = await this.pool.query('SELECT current_setting(\'server_version\') AS server_version');
      this.parameters.server_version = result.rows[0]?.server_version ?? null;
      this.connected = true;
    }
    return this;
  }

  async query(text, values = undefined) {
    await this.connect();
    const active = this.storage.getStore();
    return active ? active.query(text, values) : this.pool.query(text, values);
  }

  async transaction(callback, { isolationLevel = 'READ COMMITTED', readOnly = false } = {}) {
    const existing = this.storage.getStore();
    if (existing) return callback(existing);
    const normalizedIsolationLevel = String(isolationLevel).toUpperCase();
    if (!['READ COMMITTED', 'REPEATABLE READ', 'SERIALIZABLE'].includes(normalizedIsolationLevel)) {
      throw Object.assign(new Error('Unsupported PostgreSQL transaction isolation level'), { code: 'postgres_isolation_level_invalid' });
    }
    await this.connect();
    const client = await this.pool.connect();
    try {
      await client.query(`BEGIN ISOLATION LEVEL ${normalizedIsolationLevel}${readOnly ? ' READ ONLY' : ''}`);
      const result = await this.storage.run(client, () => callback(client));
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  }

  stats() {
    return {
      total: this.pool.totalCount,
      idle: this.pool.idleCount,
      waiting: this.pool.waitingCount
    };
  }

  async close() {
    if (this.closed) return;
    this.closed = true;
    this.connected = false;
    await this.pool.end();
  }
}

export class PostgresDirectClient {
  constructor({ databaseUrl, environment = process.env, applicationName = 'qelly-migrations' } = {}) {
    if (!databaseUrl) throw Object.assign(new Error('QELLY_MIGRATION_DATABASE_URL is required'), { code: 'migration_database_configuration_missing' });
    this.client = new Client(postgresConnectionOptions({ databaseUrl, environment, applicationName }));
    this.connected = false;
  }

  async connect() {
    if (!this.connected) {
      await this.client.connect();
      this.connected = true;
    }
    return this;
  }

  async query(text, values = undefined) {
    await this.connect();
    return this.client.query(text, values);
  }

  async transaction(callback) {
    await this.query('BEGIN');
    try {
      const result = await callback(this);
      await this.query('COMMIT');
      return result;
    } catch (error) {
      await this.query('ROLLBACK').catch(() => {});
      throw error;
    }
  }

  async close() {
    if (!this.connected) return;
    this.connected = false;
    await this.client.end();
  }
}
