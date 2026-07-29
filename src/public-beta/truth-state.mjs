export const PUBLIC_BETA_TRUTH_STATES = Object.freeze([
  'LIVE',
  'DELAYED',
  'CACHED',
  'DETERMINISTIC_LOCAL',
  'SIMULATED',
  'ESTIMATED',
  'EMBEDDED',
  'UNAVAILABLE',
  'STALE',
  'PARTIAL',
  'REQUIRES_AUTHORIZATION',
  'REQUIRES_LICENSE',
  'DEMO'
]);

const stateSet = new Set(PUBLIC_BETA_TRUTH_STATES);

export function assertTruthState(value) {
  if (!stateSet.has(value)) {
    throw new TypeError(`Unsupported Qelly truth state: ${String(value)}`);
  }
  return value;
}

export function createEvidenceEnvelope(input) {
  if (!input || typeof input !== 'object') throw new TypeError('Evidence input must be an object.');
  const state = assertTruthState(input.state);
  const observedAt = new Date(input.observedAt);
  const retrievedAt = new Date(input.retrievedAt);
  if (!Number.isFinite(observedAt.valueOf()) || !Number.isFinite(retrievedAt.valueOf())) {
    throw new TypeError('Evidence timestamps must be valid ISO timestamps.');
  }
  if (retrievedAt < observedAt) throw new RangeError('retrievedAt cannot precede observedAt.');
  const confidence = Number(input.confidence);
  if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) {
    throw new RangeError('confidence must be between 0 and 1.');
  }
  if (!input.source || !input.lineageId || !input.entitlement) {
    throw new TypeError('source, lineageId and entitlement are required.');
  }
  return Object.freeze({
    state,
    source: String(input.source),
    sourceUrl: input.sourceUrl ?? null,
    providerId: input.providerId ?? null,
    observedAt: observedAt.toISOString(),
    retrievedAt: retrievedAt.toISOString(),
    freshnessSeconds: Math.max(0, Math.floor((retrievedAt - observedAt) / 1000)),
    timezone: input.timezone || 'UTC',
    currency: input.currency ?? null,
    unit: input.unit ?? null,
    instrumentId: input.instrumentId ?? null,
    methodologyVersion: input.methodologyVersion ?? null,
    confidence,
    entitlement: String(input.entitlement),
    redistribution: input.redistribution ?? null,
    fallbackSource: input.fallbackSource ?? null,
    qualityWarning: input.qualityWarning ?? null,
    lineageId: String(input.lineageId)
  });
}

export function isConnectedState(state) {
  return state === 'LIVE' || state === 'DELAYED' || state === 'CACHED' || state === 'STALE';
}
