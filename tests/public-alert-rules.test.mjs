import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {buildPublicAlertRules,__test} from '../functions/_lib/public-alert-rules.js';

const read=(path)=>readFile(new URL(`../${path}`,import.meta.url),'utf8');
const complete={asset:'QI-EQUITY-AAPL',ruleName:'AAPL price breakout review',metric:'price',operator:'crosses_above',threshold:'220',previousValue:'219',currentValue:'221',sourceUrl:'https://www.nasdaq.com/market-activity/stocks/aapl',observedAt:'2026-09-01T08:00:00.000Z',evaluatedAt:'2026-09-01T08:05:00.000Z',staleAfterMinutes:'15',cooldownMinutes:'60',confirmationCount:'2',severity:'attention',cadence:'15m',reviewQuestion:'Does the qualified breakout change the declared risk-reward assessment?',triggerMeaning:'A confirmed move above the review boundary may require updated evidence and sizing assumptions.',resetCondition:'Rearm only after a declared observation returns to or below 220.',owner:'Market research lead',reviewer:'Portfolio risk reviewer'};

test('public alert-rule contract starts empty without fixture rules, schedules or delivery',()=>{
  const result=buildPublicAlertRules();
  assert.equal(result.selected.symbol,'AAPL');
  assert.equal(result.coverage.connectedRules,0);
  assert.equal(result.coverage.scheduledEvaluations,0);
  assert.equal(result.receipt.state,'draft');
  assert.equal(result.evaluation.state,'blocked');
  assert.equal(result.boundaries.fixtureRules,false);
  assert.equal(result.boundaries.scheduler,false);
  assert.equal(result.boundaries.execution,false);
  assert.equal(result.readiness.readyGates,1);
  assert.equal(result.gates.length,9);
});

test('complete crosses-above declaration produces a deterministic qualified trigger receipt',()=>{
  const first=buildPublicAlertRules(complete);
  const second=buildPublicAlertRules({...complete});
  assert.equal(first.receipt.state,'ready');
  assert.equal(first.readiness.readyGates,9);
  assert.equal(first.evaluation.state,'trigger-qualified');
  assert.equal(first.evaluation.conditionMet,true);
  assert.equal(first.evaluation.observationAgeMinutes,5);
  assert.equal(first.receipt.ruleId,second.receipt.ruleId);
  assert.equal(first.receipt.fingerprint,second.receipt.fingerprint);
  assert.match(first.receipt.ruleId,/^AAPL-PRICE-[a-f0-9]{8}$/);
  assert.equal(first.evaluation.notificationsCreated,0);
  assert.equal(first.receipt.scheduleRegistered,false);
});

test('ready non-match remains distinct from a blocked evaluation',()=>{
  const noMatch=buildPublicAlertRules({...complete,currentValue:'219.5'});
  const missingPrevious=buildPublicAlertRules({...complete,previousValue:''});
  assert.equal(noMatch.receipt.state,'ready');
  assert.equal(noMatch.evaluation.state,'condition-not-met');
  assert.equal(noMatch.evaluation.conditionMet,false);
  assert.equal(missingPrevious.receipt.state,'draft');
  assert.equal(missingPrevious.evaluation.state,'blocked');
  assert.equal(missingPrevious.gates.find((gate)=>gate.id==='observation').state,'blocked');
});

test('outside-band integrity and temporal freshness fail closed',()=>{
  const invalidBand=buildPublicAlertRules({...complete,operator:'outside_band',threshold:'210',upperThreshold:'205'});
  const stale=buildPublicAlertRules({...complete,observedAt:'2026-09-01T06:00:00.000Z'});
  const future=buildPublicAlertRules({...complete,observedAt:'2026-09-01T08:06:00.000Z'});
  assert.equal(invalidBand.gates.find((gate)=>gate.id==='threshold').state,'blocked');
  assert.equal(stale.gates.find((gate)=>gate.id==='freshness').state,'blocked');
  assert.equal(future.gates.find((gate)=>gate.id==='freshness').state,'blocked');
});

test('source validation accepts approved HTTPS authorities and rejects lookalikes or unsafe schemes',()=>{
  assert.deepEqual(__test.officialSource('https://www.nasdaq.com/market-activity/stocks/aapl'),{url:'https://www.nasdaq.com/market-activity/stocks/aapl',authority:'nasdaq.com'});
  assert.deepEqual(__test.officialSource('https://www.sec.gov/Archives/example.htm'),{url:'https://www.sec.gov/Archives/example.htm',authority:'sec.gov'});
  assert.equal(__test.officialSource('https://nasdaq.com.evil.example/aapl'),null);
  assert.equal(__test.officialSource('http://www.nasdaq.com/aapl'),null);
  assert.equal(__test.officialSource('javascript:alert(1)'),null);
});

test('operator evaluation distinguishes boundaries, crossings and bands',()=>{
  assert.equal(__test.evaluate({operator:'greater_than',currentValue:11,threshold:10}),true);
  assert.equal(__test.evaluate({operator:'less_than',currentValue:10,threshold:10}),false);
  assert.equal(__test.evaluate({operator:'crosses_above',previousValue:10,currentValue:11,threshold:10}),true);
  assert.equal(__test.evaluate({operator:'crosses_above',previousValue:11,currentValue:12,threshold:10}),false);
  assert.equal(__test.evaluate({operator:'outside_band',currentValue:19,threshold:10,upperThreshold:18}),true);
});

test('Alert Rules browser route uses the public dry-run contract and responsive purpose-built UI',async()=>{
  const route=await read('apps/web/public/assets/routes/alert-center.mjs');
  const css=await read('apps/web/public/assets/routes/alert-rules-v2.css');
  const guard=await read('apps/web/public/assets/qelly-product-route-guard.mjs');
  assert.match(route,/\/api\/v1\/discovery\/alert-rules/);
  assert.doesNotMatch(route,/\/api\/v1\/alerts\/rules|\/api\/v1\/alerts\/evaluate/);
  assert.doesNotMatch(guard,/\['alert-center','Alerts'\]/);
  assert.match(route,/data-ar-form/);
  assert.match(route,/Nine gates before a condition asks for attention/);
  assert.match(route,/Evaluation trace/);
  assert.match(route,/No live feed · no persistence · no scheduler · no delivery · no recommendation · no execution/);
  assert.match(css,/@media\(max-width:1160px\)/);
  assert.match(css,/@media\(max-width:760px\)/);
  assert.match(css,/@media\(max-width:430px\)/);
  assert.doesNotMatch(css,/display\s*:\s*none|visibility\s*:\s*hidden/);
});
