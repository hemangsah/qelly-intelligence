import { appendFile, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { canonicalize } from '../platform/canonical-json.mjs';
import { withLocalFileLock } from '../platform/local-file-lock.mjs';

const sha256 = (value) => crypto.createHash('sha256').update(canonicalize(value)).digest('hex');

export class AuditLedger {
  constructor(filePath) {
    this.filePath = filePath;
    this.checkpointPath = `${filePath}.checkpoint.json`;
    this.queue = Promise.resolve();
    this.delegate = null;
  }

  use(delegate) { this.delegate = delegate; return this; }

  async #records() {
    try {
      const text = await readFile(this.filePath, 'utf8');
      return text.trim() ? text.trim().split('\n').map((line, index) => {
        try { return JSON.parse(line); }
        catch { throw Object.assign(new Error(`Audit record ${index} is not valid JSON`), { code: 'audit_record_parse_failed', invalidIndex: index }); }
      }) : [];
    } catch (error) {
      if (error.code === 'ENOENT') return [];
      throw error;
    }
  }

  async #writeCheckpoint(checkpoint) {
    const temp = `${this.checkpointPath}.${process.pid}.${crypto.randomUUID()}.tmp`;
    await writeFile(temp, `${JSON.stringify(checkpoint, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
    await rename(temp, this.checkpointPath);
  }

  async append(input) {
    if (this.delegate) return this.delegate.append(input);
    this.queue = this.queue.catch(() => undefined).then(() => withLocalFileLock(this.filePath, async () => {
      await mkdir(path.dirname(this.filePath), { recursive: true });
      const records = await this.#records();
      const previousHash = records.at(-1)?.recordHash ?? 'GENESIS';
      const payload = {
        eventId: input.eventId ?? crypto.randomUUID(),
        eventType: String(input.eventType ?? 'audit.unknown.v1'),
        occurredAt: input.occurredAt ?? new Date().toISOString(),
        actor: input.actor ?? { type: 'system', id: 'qelly-local-runtime' },
        tenantId: input.tenantId ?? null,
        workspaceId: input.workspaceId ?? null,
        correlationId: input.correlationId ?? crypto.randomUUID(),
        outcome: input.outcome ?? 'success',
        classification: input.classification ?? 'internal',
        details: input.details ?? {},
        previousHash
      };
      const recordHash = sha256(payload);
      const record = { ...payload, recordHash };
      await appendFile(this.filePath, `${JSON.stringify(record)}\n`, { encoding: 'utf8', mode: 0o600, flush: true });
      await this.#writeCheckpoint({ version: 1, records: records.length + 1, headHash: recordHash, updatedAt: new Date().toISOString() });
      return record;
    }));
    return this.queue;
  }

  async list(limit = 100, scope = null) {
    if (this.delegate) return this.delegate.list(limit, scope);
    const records = await this.#records();
    const scoped = scope?.tenantId
      ? records.filter((record) => record.tenantId === scope.tenantId && (!scope.workspaceId || record.workspaceId === scope.workspaceId))
      : records;
    return scoped.slice(-Math.max(1, Math.min(Number(limit) || 100, 1000)));
  }

  async verify() {
    if (this.delegate) return this.delegate.verify();
    let records;
    try { records = await this.#records(); }
    catch (error) { return { valid: false, records: 0, invalidIndex: error.invalidIndex ?? null, reason: error.code ?? 'audit_read_failed' }; }
    let previousHash = 'GENESIS';
    for (let index = 0; index < records.length; index += 1) {
      const { recordHash, ...payload } = records[index];
      if (payload.previousHash !== previousHash) return { valid: false, records: records.length, invalidIndex: index, reason: 'previous-hash-mismatch' };
      const expected = sha256(payload);
      if (expected !== recordHash) return { valid: false, records: records.length, invalidIndex: index, reason: 'record-hash-mismatch' };
      previousHash = recordHash;
    }
    let checkpoint = null;
    try { checkpoint = JSON.parse(await readFile(this.checkpointPath, 'utf8')); } catch {}
    if (checkpoint && (checkpoint.records !== records.length || checkpoint.headHash !== previousHash)) {
      return { valid: false, records: records.length, invalidIndex: null, reason: 'checkpoint-mismatch', headHash: previousHash, checkpoint };
    }
    return { valid: true, records: records.length, headHash: previousHash, canonicalization: 'recursive-key-sort-v2', nestedFieldsCovered: true, checkpointVerified: Boolean(checkpoint) };
  }
}
