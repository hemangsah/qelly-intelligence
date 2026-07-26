import crypto from 'node:crypto';
import { AtomicJsonStore } from '../platform/json-store.mjs';
import { marketRows } from '../server/fixtures.mjs';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const supportedIntervals = new Map([['1h',1],['4h',4],['1d',24]]);

function hashNumber(value) {
  const hex = crypto.createHash('sha256').update(String(value)).digest('hex').slice(0, 8);
  return Number.parseInt(hex, 16) / 0xffffffff;
}

function fixed(value, precision = 8) { return Number(value).toFixed(precision).replace(/\.?0+$/, ''); }

function buildSeed() {
  const anchor = Date.parse('2026-07-24T08:00:00.000Z');
  const series = {};
  for (const [instrumentIndex, row] of marketRows.entries()) {
    const points = [];
    const target = Number(row.price);
    const phase = hashNumber(row.id) * Math.PI * 2;
    for (let index = 0; index < 360; index += 1) {
      const at = anchor - (359 - index) * HOUR;
      const progress = index / 359;
      const trend = 0.91 + progress * 0.09;
      const cycle = Math.sin(index / 11 + phase) * 0.012 + Math.cos(index / 29 + phase / 2) * 0.006;
      const close = target * (trend + cycle);
      const previous = points.at(-1)?.close ? Number(points.at(-1).close) : close * (1 - 0.0015);
      const open = previous;
      const spread = Math.max(target * (0.0012 + hashNumber(`${row.id}:${index}`) * 0.0028), target * 0.0001);
      const high = Math.max(open, close) + spread;
      const low = Math.max(0.00000001, Math.min(open, close) - spread * 0.88);
      const volumeBase = row.volume24h ? Number(row.volume24h) / 24 : 1_000_000 * (instrumentIndex + 1);
      const volume = volumeBase * (0.72 + hashNumber(`${index}:${row.id}:volume`) * 0.62);
      points.push({
        at: new Date(at).toISOString(),
        open: fixed(open), high: fixed(high), low: fixed(low), close: fixed(close), volume: fixed(volume, 2),
        sequence: index + 1,
        providerId: 'qelly-fixture-primary', freshnessClass: row.freshnessClass === 'simulated' ? 'simulated' : row.freshnessClass,
        qualityFlags: ['deterministic-timeseries-seed']
      });
    }
    series[row.id] = { canonicalId: row.id, baseInterval: '1h', currency: row.currency, revision: 1, points };
  }
  return { version: 1, mode: 'persistent-deterministic-timeseries', generatedAt: new Date().toISOString(), series };
}

function aggregate(points, hours) {
  if (hours === 1) return points;
  const buckets = [];
  for (let index = 0; index < points.length; index += hours) {
    const group = points.slice(index, index + hours);
    if (!group.length) continue;
    buckets.push({
      at: group[0].at,
      open: group[0].open,
      high: fixed(Math.max(...group.map((point) => Number(point.high)))),
      low: fixed(Math.min(...group.map((point) => Number(point.low)))),
      close: group.at(-1).close,
      volume: fixed(group.reduce((sum, point) => sum + Number(point.volume), 0), 2),
      sequence: group.at(-1).sequence,
      providerId: group.at(-1).providerId,
      freshnessClass: group.some((point) => point.freshnessClass === 'stale') ? 'stale' : group.at(-1).freshnessClass,
      qualityFlags: [...new Set(group.flatMap((point) => point.qualityFlags ?? []))]
    });
  }
  return buckets;
}

export class TimeSeriesStore {
  constructor({ filePath, auditLedger = null } = {}) {
    if (!filePath) throw new Error('TimeSeriesStore filePath is required');
    this.store = new AtomicJsonStore(filePath, buildSeed);
    this.auditLedger = auditLedger;
  }

  async summary() {
    const data = await this.store.read();
    const series = Object.values(data.series);
    return {
      mode: data.mode,
      instruments: series.length,
      points: series.reduce((sum, item) => sum + item.points.length, 0),
      supportedIntervals: [...supportedIntervals.keys()],
      oldestAt: series.map((item) => item.points[0]?.at).filter(Boolean).sort()[0] ?? null,
      newestAt: series.map((item) => item.points.at(-1)?.at).filter(Boolean).sort().at(-1) ?? null,
      persistence: 'atomic-json-local-foundation',
      productionTimeSeriesDatabase: false
    };
  }

  async query({ canonicalId, interval = '1h', from = null, to = null, limit = 500, cursor = null } = {}) {
    if (!supportedIntervals.has(interval)) throw Object.assign(new Error('Unsupported interval'), { status: 400, code: 'interval_not_supported', details: { supported: [...supportedIntervals.keys()] } });
    const data = await this.store.read();
    const item = data.series[canonicalId];
    if (!item) throw Object.assign(new Error('Time series not found'), { status: 404, code: 'timeseries_not_found' });
    const fromMs = from ? Date.parse(from) : -Infinity;
    const toMs = to ? Date.parse(to) : Infinity;
    if (Number.isNaN(fromMs) || Number.isNaN(toMs) || fromMs > toMs) throw Object.assign(new Error('Invalid time range'), { status: 400, code: 'time_range_invalid' });
    const all = aggregate(item.points.filter((point) => { const time = Date.parse(point.at); return time >= fromMs && time <= toMs; }), supportedIntervals.get(interval));
    const start = cursor ? Number(Buffer.from(cursor, 'base64url').toString('utf8')) : 0;
    if (!Number.isInteger(start) || start < 0) throw Object.assign(new Error('Invalid cursor'), { status: 400, code: 'cursor_invalid' });
    const safeLimit = Math.max(1, Math.min(Number(limit) || 500, 500));
    const points = all.slice(start, start + safeLimit);
    const nextIndex = start + points.length;
    const nextCursor = nextIndex < all.length ? Buffer.from(String(nextIndex)).toString('base64url') : null;
    return {
      canonicalId,
      interval,
      points,
      page: { count: points.length, total: all.length, nextCursor },
      metadata: {
        source: 'Qelly persistent deterministic time-series store', providerId: 'qelly-fixture-primary',
        observedAt: points.at(-1)?.at ?? null, receivedAt: new Date().toISOString(),
        freshnessClass: points.at(-1)?.freshnessClass ?? 'unavailable', confidence: 0.96,
        qualityFlags: ['deterministic-fixture','normalized-ohlcv'], entitlementClass: 'development-fixture',
        methodologyVersion: 'qelly-timeseries-normalization-1.0.0', decimalEncoding: 'string', timezone: 'UTC'
      }
    };
  }

  async latest(canonicalId) {
    const data = await this.store.read();
    const item = data.series[canonicalId];
    if (!item) throw Object.assign(new Error('Time series not found'), { status: 404, code: 'timeseries_not_found' });
    return structuredClone(item.points.at(-1));
  }

  async append({ canonicalId, point, actorId, correlationId, tenantId, workspaceId } = {}) {
    const required = ['at','open','high','low','close','volume'];
    for (const key of required) if (point?.[key] == null || (key !== 'at' && !Number.isFinite(Number(point[key])))) throw Object.assign(new Error(`Invalid point field: ${key}`), { status: 400, code: 'timeseries_point_invalid' });
    if (Number.isNaN(Date.parse(point.at))) throw Object.assign(new Error('Invalid point timestamp'), { status: 400, code: 'timeseries_point_invalid' });
    const next = await this.store.update((data) => {
      const item = data.series[canonicalId];
      if (!item) throw Object.assign(new Error('Time series not found'), { status: 404, code: 'timeseries_not_found' });
      const last = item.points.at(-1);
      if (Date.parse(point.at) <= Date.parse(last.at)) throw Object.assign(new Error('Point timestamp must be newer than the latest record'), { status: 409, code: 'timeseries_sequence_conflict' });
      const normalized = {
        at: new Date(point.at).toISOString(), open: fixed(point.open), high: fixed(point.high), low: fixed(point.low), close: fixed(point.close), volume: fixed(point.volume, 2),
        sequence: last.sequence + 1, providerId: String(point.providerId ?? 'qelly-fixture-ingest'), freshnessClass: String(point.freshnessClass ?? 'simulated'), qualityFlags: [...new Set(['normalized-ingest', ...(point.qualityFlags ?? [])])]
      };
      if (Number(normalized.low) > Math.min(Number(normalized.open), Number(normalized.close)) || Number(normalized.high) < Math.max(Number(normalized.open), Number(normalized.close))) throw Object.assign(new Error('OHLC bounds are invalid'), { status: 400, code: 'timeseries_ohlc_invalid' });
      item.points.push(normalized);
      item.revision += 1;
      data.version += 1;
      data.updatedAt = new Date().toISOString();
      return data;
    });
    const stored = next.series[canonicalId].points.at(-1);
    await this.auditLedger?.append({ eventType:'timeseries.point.appended.v1', correlationId, actor:{type:'user',id:actorId}, tenantId, workspaceId, details:{canonicalId,at:stored.at,sequence:stored.sequence,providerId:stored.providerId} });
    return { canonicalId, point: stored, revision: next.series[canonicalId].revision };
  }
}
