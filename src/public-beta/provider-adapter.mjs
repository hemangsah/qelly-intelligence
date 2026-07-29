import { createEvidenceEnvelope } from './truth-state.mjs';

export class ProviderAdapterError extends Error {
  constructor(message, options = {}) {
    super(message, options);
    this.name = 'ProviderAdapterError';
    this.providerId = options.providerId ?? null;
    this.code = options.code ?? 'PROVIDER_ERROR';
    this.retryable = Boolean(options.retryable);
  }
}

export class PublicBetaProviderAdapter {
  constructor({ id, timeoutMs = 8000, redistribution = 'unknown', entitlement = 'public' }) {
    if (!id) throw new TypeError('Provider adapter id is required.');
    this.id = id;
    this.timeoutMs = timeoutMs;
    this.redistribution = redistribution;
    this.entitlement = entitlement;
    this.lastSuccessAt = null;
    this.lastFailureAt = null;
    this.lastFailureReason = null;
    this.killSwitch = false;
  }

  setKillSwitch(value) {
    this.killSwitch = Boolean(value);
  }

  health() {
    return Object.freeze({
      providerId: this.id,
      killSwitch: this.killSwitch,
      lastSuccessAt: this.lastSuccessAt,
      lastFailureAt: this.lastFailureAt,
      lastFailureReason: this.lastFailureReason
    });
  }

  async request(operation, { signal } = {}) {
    if (this.killSwitch) {
      throw new ProviderAdapterError('Provider adapter is disabled by kill switch.', {
        providerId: this.id,
        code: 'PROVIDER_DISABLED'
      });
    }
    if (typeof operation !== 'function') throw new TypeError('operation must be a function.');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(new Error('Provider timeout.')), this.timeoutMs);
    const abort = () => controller.abort(signal.reason);
    signal?.addEventListener('abort', abort, { once: true });

    try {
      const result = await operation({ signal: controller.signal });
      this.lastSuccessAt = new Date().toISOString();
      this.lastFailureReason = null;
      return result;
    } catch (cause) {
      this.lastFailureAt = new Date().toISOString();
      this.lastFailureReason = cause?.message || String(cause);
      throw new ProviderAdapterError(this.lastFailureReason, {
        providerId: this.id,
        code: controller.signal.aborted ? 'PROVIDER_TIMEOUT_OR_ABORT' : 'PROVIDER_REQUEST_FAILED',
        retryable: true,
        cause
      });
    } finally {
      clearTimeout(timeout);
      signal?.removeEventListener('abort', abort);
    }
  }

  evidence(input) {
    return createEvidenceEnvelope({
      ...input,
      providerId: this.id,
      entitlement: input.entitlement || this.entitlement,
      redistribution: input.redistribution || this.redistribution
    });
  }
}
