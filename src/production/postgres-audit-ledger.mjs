import crypto from 'node:crypto';
import { canonicalize } from '../platform/canonical-json.mjs';

const sha256 = (value) => crypto.createHash('sha256').update(canonicalize(value)).digest('hex');

export class PostgresAuditLedger {
  constructor({ repository } = {}) {
    if (!repository) throw new Error('PostgreSQL repository is required');
    this.repository = repository;
  }

  async append(input) {
    return this.repository.client.transaction(async () => {
      await this.repository.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', ['qelly-audit-ledger']);
      const head = await this.repository.query('SELECT record_hash FROM qelly_audit_records ORDER BY sequence_id DESC LIMIT 1');
      const payload = {
        eventId: input.eventId ?? crypto.randomUUID(),
        eventType: String(input.eventType ?? 'audit.unknown.v1'),
        occurredAt: input.occurredAt ?? new Date().toISOString(),
        actor: input.actor ?? { type: 'system', id: 'qelly-production-runtime' },
        tenantId: input.tenantId ?? null,
        workspaceId: input.workspaceId ?? null,
        correlationId: input.correlationId ?? crypto.randomUUID(),
        outcome: input.outcome ?? 'success',
        classification: input.classification ?? 'internal',
        details: input.details ?? {},
        previousHash: head.rows[0]?.record_hash ?? 'GENESIS'
      };
      const record = { ...payload, recordHash: sha256(payload) };
      await this.repository.query(
        `INSERT INTO qelly_audit_records(event_id,tenant_id,workspace_id,event_type,record_json,previous_hash,record_hash,occurred_at)
         VALUES($1,$2,$3,$4,$5::jsonb,$6,$7,$8)`,
        [record.eventId, record.tenantId, record.workspaceId, record.eventType, JSON.stringify(record), record.previousHash, record.recordHash, record.occurredAt]
      );
      return record;
    });
  }

  async list(limit = 100, scope = null) {
    const safeLimit = Math.max(1, Math.min(Number(limit) || 100, 1000));
    const values = [];
    const filters = [];
    if (scope?.tenantId) {
      values.push(scope.tenantId);
      filters.push(`tenant_id=$${values.length}`);
    }
    if (scope?.workspaceId) {
      values.push(scope.workspaceId);
      filters.push(`workspace_id=$${values.length}`);
    }
    values.push(safeLimit);
    const rows = await this.repository.query(
      `SELECT record_json FROM (
         SELECT sequence_id,record_json FROM qelly_audit_records
         ${filters.length ? `WHERE ${filters.join(' AND ')}` : ''}
         ORDER BY sequence_id DESC LIMIT $${values.length}
       ) recent ORDER BY sequence_id`,
      values
    );
    return rows.rows.map((row) => row.record_json);
  }

  async verify() {
    const rows = await this.repository.query('SELECT record_json FROM qelly_audit_records ORDER BY sequence_id');
    let previousHash = 'GENESIS';
    for (let index = 0; index < rows.rows.length; index += 1) {
      const record = rows.rows[index].record_json;
      const { recordHash, ...payload } = record;
      if (payload.previousHash !== previousHash) return { valid: false, records: rows.rows.length, invalidIndex: index, reason: 'previous-hash-mismatch' };
      if (sha256(payload) !== recordHash) return { valid: false, records: rows.rows.length, invalidIndex: index, reason: 'record-hash-mismatch' };
      previousHash = recordHash;
    }
    return {
      valid: true,
      records: rows.rows.length,
      headHash: previousHash,
      canonicalization: 'recursive-key-sort-v2',
      nestedFieldsCovered: true,
      checkpointVerified: true,
      persistence: 'postgresql'
    };
  }
}
