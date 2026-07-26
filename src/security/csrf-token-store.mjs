import crypto from 'node:crypto';

export class CsrfTokenStore {
  constructor() { this.tokens = new Map(); }
  issue(sessionId) {
    if (!sessionId) return null;
    const current = this.tokens.get(sessionId);
    if (current && current.expiresAt > Date.now()) return current.token;
    const token = crypto.randomBytes(32).toString('base64url');
    this.tokens.set(sessionId, { token, expiresAt: Date.now() + 8 * 60 * 60 * 1000 });
    return token;
  }
  verify(sessionId, token) {
    const current = this.tokens.get(sessionId);
    if (!current || current.expiresAt <= Date.now() || typeof token !== 'string' || token.length <= 20) return false;
    const expected=Buffer.from(current.token); const received=Buffer.from(token);
    return expected.length===received.length && crypto.timingSafeEqual(expected,received);
  }
  revoke(sessionId) { this.tokens.delete(sessionId); }
}
