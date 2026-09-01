import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {buildPublicEventCalendar,__test} from '../functions/_lib/public-event-calendar.js';

const read=(path)=>readFile(new URL(`../${path}`,import.meta.url),'utf8');
const complete={eventType:'earnings',dateConfidence:'confirmed',title:'AAPL quarterly results and guidance',scheduledDate:'2026-10-29',scheduledTime:'16:30',timezone:'America/New_York',windowDays:'3',sourceUrl:'https://www.apple.com/newsroom/',thesisExposure:'Services growth and gross margin can change the operating thesis.',preEventQuestion:'Does reported services growth support the declared margin assumption?',confirmationSignal:'Services growth accelerates while gross margin meets or exceeds the declared threshold.',adverseSignal:'Services growth slows and management lowers the relevant margin outlook.',owner:'Equity research lead'};

test('public event contract starts empty without fixture dates, feeds or scheduled alerts',()=>{
  const result=buildPublicEventCalendar('QI-EQUITY-AAPL');
  assert.equal(result.selected.symbol,'AAPL');
  assert.equal(result.coverage.connectedEvents,0);
  assert.equal(result.plan.state,'draft');
  assert.equal(result.boundaries.fixtureEvents,false);
  assert.equal(result.boundaries.datesInvented,false);
  assert.equal(result.boundaries.notificationDelivery,false);
  assert.equal(result.readiness.readyGates,1);
  assert.equal(result.gates.length,8);
});

test('complete event declaration produces a deterministic monitoring receipt and window',()=>{
  const first=buildPublicEventCalendar('AAPL',complete);
  const second=buildPublicEventCalendar('QI-EQUITY-AAPL',complete);
  assert.equal(first.plan.state,'ready');
  assert.equal(first.readiness.readyGates,8);
  assert.equal(first.plan.planId,second.plan.planId);
  assert.equal(first.plan.fingerprint,second.plan.fingerprint);
  assert.match(first.plan.planId,/^AAPL-EARNINGS-2026-10-29-[a-f0-9]{8}$/);
  assert.deepEqual(first.monitoringWindow,{start:'2026-10-26',event:'2026-10-29',end:'2026-11-01',days:3,timezone:'America/New_York'});
  assert.equal(first.plan.notificationScheduled,false);
});

test('source validation accepts approved HTTPS authorities and rejects lookalikes or unsafe schemes',()=>{
  assert.deepEqual(__test.officialSource('https://www.sec.gov/Archives/example.htm'),{url:'https://www.sec.gov/Archives/example.htm',authority:'sec.gov'});
  assert.deepEqual(__test.officialSource('https://investor.nvidia.com/events/'),{url:'https://investor.nvidia.com/events/',authority:'nvidia.com'});
  assert.equal(__test.officialSource('https://sec.gov.evil.example/event'),null);
  assert.equal(__test.officialSource('http://www.apple.com/newsroom/'),null);
  assert.equal(__test.officialSource('javascript:alert(1)'),null);
});

test('Event Calendar browser route uses the public planning contract and responsive purpose-built UI',async()=>{
  const route=await read('apps/web/public/assets/routes/event-calendar.mjs');
  const css=await read('apps/web/public/assets/routes/event-calendar-v2.css');
  assert.match(route,/\/api\/v1\/discovery\/event-calendar/);
  assert.doesNotMatch(route,/\/api\/v1\/asset-intelligence/);
  assert.match(route,/data-ec-form/);
  assert.match(route,/Two-sided outcomes|Record both sides/);
  assert.match(route,/Five review moments/);
  assert.match(route,/No persistence · no alerts · no recommendation · no execution/);
  assert.match(css,/@media\(max-width:1100px\)/);
  assert.match(css,/@media\(max-width:720px\)/);
  assert.match(css,/@media\(max-width:430px\)/);
  assert.doesNotMatch(css,/display\s*:\s*none|visibility\s*:\s*hidden/);
});
