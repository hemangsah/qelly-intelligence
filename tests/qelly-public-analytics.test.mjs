import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeAnalyticsBatch,summarizeAnalyticsBatch} from '../functions/_lib/public-analytics.js';
import {__test as apiTest} from '../functions/api/v1/[[path]].js';

const env={QELLY_PUBLIC_SITE_URL:'https://terminal.qellyintelligence.com',QELLY_PUBLIC_SUPABASE_URL:'https://example.supabase.co',QELLY_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_test_key_long_enough_for_validation'};

test('edge analytics accepts coarse events and produces identifier-free counts',()=>{
  const events=normalizeAnalyticsBatch({schemaVersion:1,events:[{name:'route_view',properties:{route:'market',feature:'market'},occurredAt:'2026-09-20T00:00:00.000Z'},{name:'route_view',properties:{route:'market',feature:'market'},occurredAt:'2026-09-20T00:00:01.000Z'}]},{now:Date.parse('2026-09-20T00:01:00.000Z')});
  assert.deepEqual(summarizeAnalyticsBatch(events),{event:'qelly_product_analytics',schemaVersion:1,eventCount:2,counts:{'route_view:market:market':2},containsUserInputs:false,containsIdentifiers:false});
});

test('edge analytics rejects arbitrary fields, routes and event names',()=>{
  const wrap=(event)=>()=>normalizeAnalyticsBatch({schemaVersion:1,events:[event]},{now:Date.parse('2026-09-20T00:01:00.000Z')});
  assert.throws(wrap({name:'route_view',properties:{route:'market',query:'private'},occurredAt:'2026-09-20T00:00:00.000Z'}),/property is not allowlisted/);
  assert.throws(wrap({name:'route_view',properties:{route:'admin-secrets'},occurredAt:'2026-09-20T00:00:00.000Z'}),/route is not allowlisted/);
  assert.throws(wrap({name:'form_value',properties:{route:'market'},occurredAt:'2026-09-20T00:00:00.000Z'}),/event is not allowlisted/);
});

test('public analytics endpoint accepts a bounded consent-originated batch without authentication',async()=>{
  const request=new Request('https://terminal.qellyintelligence.com/api/v1/analytics/events',{method:'POST',headers:{Origin:'https://terminal.qellyintelligence.com','Content-Type':'application/json'},body:JSON.stringify({schemaVersion:1,events:[{name:'decision_open',properties:{route:'decision-provenance',feature:'decision_intelligence',returning:false},occurredAt:new Date().toISOString()}]})});
  const response=await apiTest.route({request,env,params:{path:['analytics','events']}});
  assert.equal(response.status,202);assert.deepEqual(await response.json(),{accepted:1});
});

test('runtime observability accepts only coarse taxonomy tokens',()=>{
  const events=normalizeAnalyticsBatch({schemaVersion:1,events:[{name:'runtime_signal',properties:{route:'market',feature:'api',action:'latency',state:'gte_2000ms',surface:'fetch'},occurredAt:'2026-09-20T00:00:00.000Z'}]},{now:Date.parse('2026-09-20T00:01:00.000Z')});
  assert.deepEqual(events[0].properties,{route:'market',feature:'api',action:'latency',state:'gte_2000ms',surface:'fetch'});
  assert.deepEqual(summarizeAnalyticsBatch(events),{event:'qelly_product_analytics',schemaVersion:1,eventCount:1,counts:{'runtime_signal:market:api':1},containsUserInputs:false,containsIdentifiers:false});
});
