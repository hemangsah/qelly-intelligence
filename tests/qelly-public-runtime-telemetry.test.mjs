import test from 'node:test';
import assert from 'node:assert/strict';
import {buildAnalyticsEvent,PrivacyAnalytics,redactLogValue,structuredLog,publicRuntimeReadiness} from '../src/public-runtime/telemetry.mjs';

test('analytics rejects non-allowlisted events and strips sensitive properties',()=>{
  assert.throws(()=>buildAnalyticsEvent('calculation_payload_uploaded',{}),/not_allowlisted/);
  const event=buildAnalyticsEvent('calculation_completed',{routeFamily:'calculator',result:'999',email:'user@example.com',durationBucket:420,providerId:'ecb-reference-rates'},{releaseSha:'a'.repeat(40),sessionId:'session-secret',occurredAt:'2026-08-01T00:00:00Z'});
  assert.equal(event.properties.routeFamily,'calculator');
  assert.equal(event.properties.durationBucket,'100-499ms');
  assert.equal('result'in event.properties,false);
  assert.equal('email'in event.properties,false);
  assert.notEqual(event.context.sessionId,'session-secret');
});

test('analytics is disabled by default and honors consent and do-not-track',async()=>{
  const disabled=new PrivacyAnalytics();
  assert.equal(disabled.track('page_view',{routeFamily:'market'}).accepted,false);
  const dnt=new PrivacyAnalytics({enabled:true,consent:true,doNotTrack:true});
  assert.equal(dnt.track('page_view',{routeFamily:'market'}).reason,'do_not_track');
  let sent=[];const active=new PrivacyAnalytics({enabled:true,consent:true,doNotTrack:false,send:async(batch)=>{sent=batch;}});
  assert.equal(active.track('page_view',{routeFamily:'market'}).accepted,true);
  assert.equal((await active.flush()).sent,1);
  assert.equal(sent[0].event,'page_view');
});

test('structured logs redact credentials and calculation payloads',()=>{
  const value=redactLogValue({email:'user@example.com',authorization:'Bearer secret',payload:{result:42},status:'failed'});
  assert.equal(value.email,'[redacted]');
  assert.equal(value.authorization,'[redacted]');
  assert.equal(value.payload,'[redacted]');
  assert.equal(value.status,'failed');
  const log=structuredLog('error','provider failed',{correlationId:'corr-1',releaseSha:'b'.repeat(40),token:'secret',errorClass:'timeout'});
  assert.equal(log.correlationId,'corr-1');
  assert.equal(log.fields.token,'[redacted]');
  assert.equal(log.fields.errorClass,'timeout');
});

test('readiness separates deterministic public beta from unavailable cloud services',()=>{
  const readiness=publicRuntimeReadiness();
  assert.equal(readiness.readyForDeterministicPublicBeta,true);
  assert.equal(readiness.readyForCloudPublicBeta,false);
  assert.equal(readiness.blockers.some((blocker)=>blocker.name==='database'),true);
});
