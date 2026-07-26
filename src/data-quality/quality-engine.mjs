import crypto from 'node:crypto';

export class DataQualityEngine {
  constructor() {
    this.seenEvents = new Set();
    this.lastSequence = new Map();
    this.incidents = [];
    this.overrides = [];
  }

  validateQuote(quote, context = {}) {
    const flags = [];
    const missing = [];
    for (const field of ['canonicalEntityId','value','source','observedAt','receivedAt','freshnessClass']) if (quote?.[field] == null) missing.push(field);
    if (missing.length) flags.push(`missing:${missing.join(',')}`);
    const numeric = Number(quote?.value);
    if (quote?.value != null && !Number.isFinite(numeric)) flags.push('value:not-numeric');
    if (Number.isFinite(numeric) && numeric < 0 && !context.allowNegative) flags.push('range:negative');
    const observed = Date.parse(quote?.observedAt);
    const received = Date.parse(quote?.receivedAt);
    if (!Number.isFinite(observed) || !Number.isFinite(received)) flags.push('timestamp:invalid');
    if (Number.isFinite(observed) && Number.isFinite(received) && observed > received + 1000) flags.push('timestamp:observed-after-received');
    if (Number.isFinite(observed) && Date.now() - observed > 24 * 60 * 60 * 1000 && quote?.freshnessClass === 'live') flags.push('freshness:misclassified-live');
    if (context.previousValue != null && Number.isFinite(numeric)) {
      const previous = Number(context.previousValue);
      if (Number.isFinite(previous) && previous !== 0 && Math.abs((numeric - previous) / previous) > (context.outlierThreshold ?? 0.25)) flags.push('outlier:large-move');
    }
    const confidence = Math.max(0, Math.min(1,
      1 - flags.length * 0.12 - (quote?.freshnessClass === 'stale' ? 0.2 : 0) - (quote?.freshnessClass === 'simulated' ? 0.05 : 0)
    ));
    return { valid: flags.length === 0, flags, missingFields: missing, confidence:Number(confidence.toFixed(3)) };
  }

  reconcile(quotes, tolerance = 0.02) {
    const numeric = quotes.map((item) => Number(item.value)).filter(Number.isFinite);
    if (numeric.length < 2) return { status:'insufficient-sources', variance:null, flags:['reconciliation:insufficient-sources'] };
    const min = Math.min(...numeric); const max = Math.max(...numeric); const midpoint = (min + max) / 2;
    const variance = midpoint === 0 ? 0 : (max - min) / midpoint;
    return { status:variance <= tolerance ? 'consistent' : 'divergent', variance:Number(variance.toFixed(6)), flags:variance <= tolerance ? [] : ['reconciliation:cross-provider-variance'] };
  }

  inspectEvent({ eventId, channel, sequence }) {
    const flags = [];
    if (this.seenEvents.has(eventId)) flags.push('event:duplicate'); else this.seenEvents.add(eventId);
    const previous = this.lastSequence.get(channel);
    if (previous != null && sequence !== previous + 1) flags.push(`sequence:gap:${previous}->${sequence}`);
    this.lastSequence.set(channel, sequence);
    return { valid:flags.length === 0, flags };
  }

  recordIncident(input) {
    const incident = {
      incidentId: crypto.randomUUID(),
      status:'open', severity:input.severity ?? 'medium',
      category:input.category ?? 'data-quality', providerId:input.providerId ?? null,
      canonicalId:input.canonicalId ?? null, flags:input.flags ?? [],
      detectedAt:new Date().toISOString(), details:input.details ?? {}, resolution:null
    };
    this.incidents.push(incident);
    return incident;
  }

  listIncidents() { return structuredClone(this.incidents); }

  override({ incidentId, reason, actorId, expiresAt = null }) {
    if (!reason || reason.length < 10) throw Object.assign(new Error('Override reason must contain at least 10 characters'), { status:400, code:'request_invalid' });
    const incident = this.incidents.find((item) => item.incidentId === incidentId);
    if (!incident) throw Object.assign(new Error('Data-quality incident not found'), { status:404, code:'incident_not_found' });
    const value = { overrideId:crypto.randomUUID(), incidentId, reason, actorId, createdAt:new Date().toISOString(), expiresAt };
    this.overrides.push(value); incident.status='overridden'; incident.resolution=value;
    return structuredClone(value);
  }
}
