import crypto from 'node:crypto';

export class IdempotencyStore {
  constructor({ ttlMs = 24 * 60 * 60 * 1000 } = {}) {
    this.ttlMs = ttlMs;
    this.entries = new Map();
  }

  fingerprint(body) {
    return crypto.createHash('sha256').update(JSON.stringify(body ?? null)).digest('hex');
  }

  get(key, fingerprint, now = Date.now()) {
    const entry = this.entries.get(key);
    if (!entry) return null;
    if (entry.expiresAt <= now) { this.entries.delete(key); return null; }
    if (entry.fingerprint !== fingerprint) {
      const error = new Error('Idempotency key was already used with a different payload');
      error.status = 409;
      error.code = 'idempotency_conflict';
      throw error;
    }
    return structuredClone(entry.response);
  }

  put(key, fingerprint, response, now = Date.now()) {
    this.entries.set(key, { fingerprint, response: structuredClone(response), expiresAt: now + this.ttlMs });
    return response;
  }
}
