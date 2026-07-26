import crypto from 'node:crypto';
import { AtomicJsonStore } from '../platform/json-store.mjs';

const catalog = [
  { channel:'quotes', description:'Normalized quote snapshots and deltas', entitlementAction:'stream:read', retentionEvents:500 },
  { channel:'candles', description:'Normalized OHLCV completion events', entitlementAction:'stream:read', retentionEvents:500 },
  { channel:'provider-health', description:'Provider runtime health deltas', entitlementAction:'observability:read', retentionEvents:250 },
  { channel:'operations', description:'Local runtime operational events', entitlementAction:'observability:read', retentionEvents:250 }
];

function seed() { return { version:1, mode:'persistent-local-event-journal', channels:Object.fromEntries(catalog.map((item)=>[item.channel,{sequence:0,events:[]}])) }; }
function token(channel, sequence) { return Buffer.from(JSON.stringify({channel,sequence})).toString('base64url'); }
function parseToken(value) { try { return JSON.parse(Buffer.from(String(value), 'base64url').toString('utf8')); } catch { return null; } }

export class StreamGateway {
  constructor({ filePath, timeSeriesStore, providerRuntime, qualityEngine, auditLedger, now = () => new Date() } = {}) {
    if (!filePath) throw new Error('StreamGateway filePath is required');
    this.store = new AtomicJsonStore(filePath, seed);
    this.timeSeriesStore = timeSeriesStore;
    this.providerRuntime = providerRuntime;
    this.qualityEngine = qualityEngine;
    this.auditLedger = auditLedger;
    this.now = now;
    this.metrics = { connections:0, eventsPublished:0, replayRequests:0, gapSignals:0, heartbeats:0, activeConnections:0 };
  }

  catalog() { return catalog.map((item)=>({...item})); }
  stats() { return {...this.metrics}; }

  async publish({ channel, payload, tenantId, workspaceId, correlationId, freshnessClass = 'simulated', eventType = null }) {
    if (!catalog.some((item)=>item.channel===channel)) throw Object.assign(new Error('Unknown stream channel'), { status:400, code:'stream_channel_invalid' });
    let event;
    await this.store.update((state) => {
      const entry = state.channels[channel];
      const sequence = entry.sequence + 1;
      event = {
        schemaVersion:'1.0', channel, sequence, eventId:crypto.randomUUID(), eventType:eventType ?? `${channel}.delta.v1`,
        emittedAt:this.now().toISOString(), tenantId, workspaceId, freshnessClass, resumeToken:token(channel,sequence),
        payload, causalId:correlationId ?? null, quality:null
      };
      event.quality = this.qualityEngine?.inspectEvent(event) ?? {valid:true,flags:[],confidence:1};
      entry.sequence = sequence;
      entry.events.push(event);
      const retention = catalog.find((item)=>item.channel===channel).retentionEvents;
      if (entry.events.length > retention) entry.events.splice(0, entry.events.length - retention);
      state.version += 1;
      state.updatedAt = this.now().toISOString();
      return state;
    });
    this.metrics.eventsPublished += 1;
    if (!event.quality.valid) this.metrics.gapSignals += 1;
    return structuredClone(event);
  }

  async quoteSnapshot({ canonicalIds, tenantId, workspaceId, correlationId }) {
    const quotes = [];
    for (const canonicalId of canonicalIds) {
      const point = await this.timeSeriesStore.latest(canonicalId);
      quotes.push({ canonicalEntityId:canonicalId, value:point.close, unit:null, providerId:point.providerId, observedAt:point.at, receivedAt:this.now().toISOString(), freshnessClass:point.freshnessClass, qualityFlags:point.qualityFlags, entitlementClass:'development-fixture' });
    }
    return this.publish({ channel:'quotes', eventType:'quotes.snapshot.v1', payload:quotes, tenantId, workspaceId, correlationId });
  }

  async quoteDelta({ canonicalIds, tenantId, workspaceId, correlationId, step = 1 }) {
    const state = await this.store.read();
    const nextSequence = state.channels.quotes.sequence + 1;
    const values = [];
    for (const canonicalId of canonicalIds) {
      const point = await this.timeSeriesStore.latest(canonicalId);
      const base = Number(point.close);
      const drift = Math.sin((nextSequence + step + canonicalId.length) / 3) * 0.0009 + Math.cos((nextSequence + canonicalId.length) / 7) * 0.0004;
      values.push({ canonicalEntityId:canonicalId, value:(base*(1+drift)).toFixed(8).replace(/\.?0+$/,''), providerId:'qelly-fixture-stream', observedAt:this.now().toISOString(), receivedAt:this.now().toISOString(), freshnessClass:'simulated', qualityFlags:['deterministic-stream-delta'], entitlementClass:'development-fixture' });
    }
    return this.publish({ channel:'quotes', eventType:'quotes.delta.v1', payload:values, tenantId, workspaceId, correlationId });
  }

  async providerHealth({ tenantId, workspaceId, correlationId }) {
    return this.publish({ channel:'provider-health', eventType:'provider-health.snapshot.v1', payload:this.providerRuntime.registry().map((item)=>({providerId:item.providerId,status:item.status,breaker:item.breaker,bulkhead:item.bulkhead,quality:item.quality})), tenantId, workspaceId, correlationId, freshnessClass:'cached' });
  }

  async replay({ channel, afterSequence = 0, resumeToken = null, limit = 100 } = {}) {
    this.metrics.replayRequests += 1;
    const parsed = resumeToken ? parseToken(resumeToken) : null;
    if (resumeToken && (!parsed || parsed.channel !== channel || !Number.isInteger(parsed.sequence))) throw Object.assign(new Error('Invalid resume token'), { status:400, code:'resume_token_invalid' });
    const sequence = parsed?.sequence ?? Number(afterSequence ?? 0);
    const state = await this.store.read();
    const entry = state.channels[channel];
    if (!entry) throw Object.assign(new Error('Unknown stream channel'), { status:400, code:'stream_channel_invalid' });
    const firstAvailable = entry.events[0]?.sequence ?? entry.sequence + 1;
    const gap = sequence + 1 < firstAvailable;
    if (gap) this.metrics.gapSignals += 1;
    const items = entry.events.filter((event)=>event.sequence > sequence).slice(0,Math.max(1,Math.min(Number(limit)||100,500)));
    return { channel, requestedAfterSequence:sequence, currentSequence:entry.sequence, firstAvailableSequence:firstAvailable, gap, gapDetails:gap?{missingFrom:sequence+1,missingTo:firstAvailable-1,recovery:'request-fresh-snapshot'}:null, items, nextResumeToken:items.at(-1)?.resumeToken ?? token(channel,sequence) };
  }

  connectionOpened() { this.metrics.connections += 1; this.metrics.activeConnections += 1; }
  connectionClosed() { this.metrics.activeConnections = Math.max(0,this.metrics.activeConnections-1); }
  heartbeat() { this.metrics.heartbeats += 1; return { eventType:'stream.heartbeat.v1', emittedAt:this.now().toISOString() }; }
}
