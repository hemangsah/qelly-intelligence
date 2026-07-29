const SECRET_KEY_PATTERN = /(password|passphrase|secret|token|authorization|cookie|private.?key|seed|recovery|credential)/i;

function redact(value, depth = 0) {
  if (depth > 8) return '[TRUNCATED]';
  if (Array.isArray(value)) return value.map((item) => redact(item, depth + 1));
  if (!value || typeof value !== 'object') return value;
  const output = {};
  for (const [key, item] of Object.entries(value)) {
    output[key] = SECRET_KEY_PATTERN.test(key) ? '[REDACTED]' : redact(item, depth + 1);
  }
  return output;
}

export function createObservabilityEvent({ type, severity = 'info', message, context = {}, traceId = null }) {
  if (!type || !message) throw new TypeError('Observability events require type and message.');
  return Object.freeze({
    schemaVersion: 1,
    type: String(type),
    severity: String(severity),
    message: String(message),
    traceId,
    recordedAt: new Date().toISOString(),
    context: Object.freeze(redact(context))
  });
}

export function createProviderFailureEvent(error, context = {}) {
  return createObservabilityEvent({
    type: 'provider.failure',
    severity: 'warning',
    message: error?.message || 'Provider failure',
    traceId: context.traceId ?? null,
    context: {
      ...context,
      providerId: error?.providerId ?? context.providerId ?? null,
      code: error?.code ?? 'UNKNOWN',
      retryable: Boolean(error?.retryable)
    }
  });
}

export { redact as redactObservabilityContext };
