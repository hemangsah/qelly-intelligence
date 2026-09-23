import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {__decisionProvenGraphRouteTest} from '../apps/web/public/assets/routes/decision-proven-graph.mjs';
import {sanitizeGrowthEvent} from '../apps/web/public/assets/qelly-growth-runtime.mjs';
import {normalizeAnalyticsBatch} from '../functions/_lib/public-analytics.js';

const read=(path)=>readFile(new URL(`../${path}`,import.meta.url),'utf8');

test('Decision observability normalizes result and calibration states to coarse taxonomy tokens',()=>{
  assert.equal(__decisionProvenGraphRouteTest.telemetryToken('NO TRADE'),'no_trade');
  assert.equal(__decisionProvenGraphRouteTest.telemetryToken('WEAK_CALIBRATION'),'weak_calibration');
  assert.equal(__decisionProvenGraphRouteTest.telemetryToken('SEVERE CONFLICT'),'severe_conflict');
  assert.equal(__decisionProvenGraphRouteTest.telemetryToken(null),'unknown');
});

test('Decision R:R telemetry exposes category only and never the custom numeric input',()=>{
  assert.equal(__decisionProvenGraphRouteTest.rrTelemetryState('auto'),'auto');
  assert.equal(__decisionProvenGraphRouteTest.rrTelemetryState('1'),'rr_1_1');
  assert.equal(__decisionProvenGraphRouteTest.rrTelemetryState('2'),'rr_1_2');
  assert.equal(__decisionProvenGraphRouteTest.rrTelemetryState('3'),'rr_1_3');
  assert.equal(__decisionProvenGraphRouteTest.rrTelemetryState('4'),'rr_1_4');
  assert.equal(__decisionProvenGraphRouteTest.rrTelemetryState('custom'),'custom');
  assert.equal(__decisionProvenGraphRouteTest.rrTelemetryState('2.5'),'unknown');
});

test('growth analytics accepts coarse Decision acceptance events without identifiers or raw inputs',()=>{
  const now=Date.parse('2026-09-23T20:00:00.000Z');
  const event=sanitizeGrowthEvent({
    name:'qelly_view_interaction',
    properties:{route:'decision-provenance',feature:'decision_view',action:'result',state:'no_trade'}
  },now);
  assert.deepEqual(event,{
    name:'qelly_view_interaction',
    properties:{route:'decision-provenance',feature:'decision_view',action:'result',state:'no_trade'},
    occurredAt:'2026-09-23T20:00:00.000Z'
  });

  const normalized=normalizeAnalyticsBatch({
    schemaVersion:1,
    events:[{
      name:'qelly_view_interaction',
      properties:{route:'decision-provenance',feature:'eligible_setup',action:'count',state:'nonzero',count:3},
      occurredAt:'2026-09-23T20:00:00.000Z'
    }]
  },{now});
  assert.equal(normalized[0].properties.count,3);
  assert.equal('asset' in normalized[0].properties,false);
  assert.equal('price' in normalized[0].properties,false);
  assert.equal('prompt' in normalized[0].properties,false);
});

test('Decision route emits section-69 signals through existing analytics only',async()=>{
  const source=await read('apps/web/public/assets/routes/decision-proven-graph.mjs');
  assert.match(source,/feature:'decision_view',action:'result'/);
  assert.match(source,/feature:'calibration',action:'state'/);
  assert.match(source,/feature:'risk_reward',action:'select'/);
  assert.match(source,/feature:'decision_scan',action:'complete'/);
  assert.match(source,/feature:'eligible_setup',action:'count'/);
  assert.match(source,/feature:'decision_scan',action:'failure',state:'unavailable',surface:'api'/);
  assert.match(source,/feature:'decision',action:'failure',state:'unavailable',surface:'api'/);

  const emitted=[...source.matchAll(/emitProductEvent\(([^;]+)\);/g)].map(match=>match[1]);
  assert.ok(emitted.length>=5);
  for(const statement of emitted){
    assert.doesNotMatch(statement,/asset\s*:|price\s*:|prompt\s*:|target\s*:|customRr\s*:/);
  }
});

test('existing runtime observability remains responsible for long tasks memory pressure retries and client errors',async()=>{
  const source=await read('apps/web/public/assets/qelly-growth-runtime.mjs');
  assert.match(source,/PerformanceObserver/);
  assert.match(source,/action:'long_task'/);
  assert.match(source,/action:'memory_pressure'/);
  assert.match(source,/feature:'provider',action:'retry'/);
  assert.match(source,/analytics\.track\('client_error'/);
  assert.match(source,/document\.addEventListener\('qelly:runtime-signal'/);
});
