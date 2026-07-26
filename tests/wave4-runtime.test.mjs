import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { TimeSeriesStore } from '../src/timeseries/timeseries-store.mjs';
import { StreamGateway } from '../src/streaming/stream-gateway.mjs';
import { ObservabilityService } from '../src/observability/observability-service.mjs';
import { DataQualityEngine } from '../src/data-quality/quality-engine.mjs';

let dir;
test.before(async()=>{dir=await mkdtemp(path.join(os.tmpdir(),'qelly-part16-wave4-'));});
test.after(async()=>{await rm(dir,{recursive:true,force:true});});

test('time-series store seeds persistent normalized OHLCV history',async()=>{
  const store=new TimeSeriesStore({filePath:path.join(dir,'timeseries.json')});
  const summary=await store.summary();
  assert.equal(summary.instruments,8);assert.equal(summary.points,2880);assert.deepEqual(summary.supportedIntervals,['1h','4h','1d']);assert.equal(summary.productionTimeSeriesDatabase,false);
  const result=await store.query({canonicalId:'QI-CRYPTO-BTC',interval:'1h',limit:10});
  assert.equal(result.points.length,10);assert.equal(result.page.total,360);assert.ok(result.page.nextCursor);assert.match(result.points[0].close,/^[0-9.]+$/);assert.equal(result.metadata.decimalEncoding,'string');
});

test('time-series aggregation and cursor pagination are deterministic',async()=>{
  const store=new TimeSeriesStore({filePath:path.join(dir,'timeseries.json')});
  const fourHour=await store.query({canonicalId:'QI-CRYPTO-BTC',interval:'4h',limit:500});
  assert.equal(fourHour.points.length,90);assert.equal(fourHour.page.total,90);
  const first=await store.query({canonicalId:'QI-EQUITY-AAPL',interval:'1h',limit:25});
  const second=await store.query({canonicalId:'QI-EQUITY-AAPL',interval:'1h',limit:25,cursor:first.page.nextCursor});
  assert.equal(second.points[0].sequence,26);assert.equal(new Set([...first.points,...second.points].map(x=>x.sequence)).size,50);
});

test('time-series store rejects unsupported intervals and invalid OHLC',async()=>{
  const store=new TimeSeriesStore({filePath:path.join(dir,'timeseries-invalid.json')});
  await assert.rejects(()=>store.query({canonicalId:'QI-CRYPTO-BTC',interval:'2m'}),e=>e.code==='interval_not_supported');
  await assert.rejects(()=>store.append({canonicalId:'QI-CRYPTO-BTC',point:{at:'2026-07-24T09:00:00Z',open:'100',high:'99',low:'101',close:'100',volume:'1'}}),e=>e.code==='timeseries_ohlc_invalid');
});

test('time-series append preserves monotonic sequence and persistence',async()=>{
  const file=path.join(dir,'timeseries-append.json');const store=new TimeSeriesStore({filePath:file});const latest=await store.latest('QI-CRYPTO-BTC');
  const at=new Date(Date.parse(latest.at)+3600000).toISOString();const result=await store.append({canonicalId:'QI-CRYPTO-BTC',point:{at,open:latest.close,high:String(Number(latest.close)*1.01),low:String(Number(latest.close)*.99),close:String(Number(latest.close)*1.002),volume:'12345'}});
  assert.equal(result.point.sequence,361);assert.equal((await store.latest('QI-CRYPTO-BTC')).sequence,361);
});

test('stream gateway publishes, replays and resumes by token',async()=>{
  const timeSeriesStore=new TimeSeriesStore({filePath:path.join(dir,'stream-timeseries.json')});
  const qualityEngine=new DataQualityEngine();
  const providerRuntime={registry:()=>[{providerId:'fixture',status:'enabled',quality:{score:100},breaker:{state:'closed'},bulkhead:{active:0,limit:4}}]};
  const gateway=new StreamGateway({filePath:path.join(dir,'stream.json'),timeSeriesStore,providerRuntime,qualityEngine});
  const snapshot=await gateway.quoteSnapshot({canonicalIds:['QI-CRYPTO-BTC'],tenantId:'org',workspaceId:'ws',correlationId:'c1'});
  const delta=await gateway.quoteDelta({canonicalIds:['QI-CRYPTO-BTC'],tenantId:'org',workspaceId:'ws',correlationId:'c2'});
  assert.equal(snapshot.sequence,1);assert.equal(delta.sequence,2);assert.ok(delta.resumeToken);
  const replay=await gateway.replay({channel:'quotes',resumeToken:snapshot.resumeToken});
  assert.equal(replay.items.length,1);assert.equal(replay.items[0].sequence,2);assert.equal(replay.gap,false);
});

test('observability records bounded traces metrics logs and candidate SLOs',()=>{
  let now=1000;const service=new ObservabilityService({now:()=>now,maxRecords:10});
  const finish=service.startRequest({correlationId:'c',method:'GET',path:'/api/test'});now+=42;finish({statusCode:200});service.log('info','test.completed',{safe:true});
  const streamGateway={stats:()=>({eventsPublished:2,gapSignals:0,connections:1,activeConnections:0,heartbeats:1,replayRequests:1})};
  const providerRuntime={registry:()=>[{providerId:'fixture',status:'enabled',quality:{score:99,latencyMs:2,errorRate:0},metrics:{requests:1},breaker:{state:'closed'},bulkhead:{active:0,limit:4}}]};
  const overview=service.overview({providerRuntime,streamGateway,timeSeriesSummary:{instruments:8},auditIntegrity:{valid:true}});
  assert.equal(overview.metrics.http.requests,1);assert.equal(overview.metrics.http.latencyMs.p95,42);assert.equal(overview.externalTelemetryExport,false);assert.ok(overview.slos.every(item=>item.window==='candidate-only'));assert.equal(service.recentTraces().items.length,1);assert.equal(service.recentLogs().items.length,1);
});
