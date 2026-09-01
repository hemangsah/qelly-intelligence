import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildPublicNotificationTriage,__test} from '../functions/_lib/public-notification-triage.js';
import {startServer} from '../scripts/release-a5-evidence-server.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const complete={notificationId:'notif-aapl-001',title:'AAPL breakout requires review',summary:'A declared price observation crossed the governed review threshold.',type:'alert_trigger',severity:'critical',channel:'in_app',sourceRoute:'alert-center',deliveryReceipt:'inapp-receipt-20260901-001',createdAt:'2026-09-01T08:00:00.000Z',reviewedAt:'2026-09-01T08:45:00.000Z',dedupeKey:'AAPL:price:crosses-above:220',duplicateCount:'1',owner:'Research operations',reviewer:'Portfolio risk lead',reviewQuestion:'Does the qualified breakout change the declared risk-reward assessment?',responsePlan:'Verify the source observation and update the risk review.',escalationCondition:'Escalate when the critical receipt exceeds its thirty-minute policy.',acknowledgementNote:'Reviewer accepted ownership of the evidence review.'};

test('empty notification triage exposes no fixture inbox or delivery claims',()=>{
  const result=buildPublicNotificationTriage();
  assert.equal(result.version,'governed-notification-triage-v2');
  assert.equal(result.receipt.state,'draft');
  assert.equal(result.coverage.persistedNotifications,0);
  assert.equal(result.boundaries.fixtureNotifications,false);
  assert.equal(result.boundaries.connectedInbox,false);
  assert.equal(result.boundaries.deliveryVerified,false);
  assert.equal(result.readiness.readyGates,1);
  assert.equal(result.gates.length,8);
});

test('complete critical overdue receipt deterministically escalates',()=>{
  const first=buildPublicNotificationTriage(complete);
  const second=buildPublicNotificationTriage(complete);
  assert.equal(first.receipt.state,'ready');
  assert.equal(first.readiness.readyGates,8);
  assert.equal(first.triage.state,'escalate-now');
  assert.equal(first.triage.ageMinutes,45);
  assert.equal(first.triage.slaMinutes,30);
  assert.match(first.receipt.triageId,/^NTF-ALERT-[0-9a-f]{8}$/);
  assert.equal(first.receipt.triageId,second.receipt.triageId);
  assert.equal(first.triage.automaticActionTaken,false);
  assert.equal(first.receipt.readStateMutated,false);
});

test('severity, SLA and duplicate queue states stay distinct',()=>{
  const clustered=buildPublicNotificationTriage({...complete,severity:'information',reviewedAt:'2026-09-01T08:15:00.000Z',duplicateCount:'4'});
  const standard=buildPublicNotificationTriage({...complete,severity:'information',reviewedAt:'2026-09-01T08:15:00.000Z',duplicateCount:'0'});
  const attention=buildPublicNotificationTriage({...complete,severity:'attention',reviewedAt:'2026-09-01T08:15:00.000Z'});
  assert.equal(clustered.triage.state,'review-cluster');
  assert.equal(standard.triage.state,'standard-queue');
  assert.equal(attention.triage.state,'same-session-review');
});

test('invalid timestamp order and incomplete response fail closed',()=>{
  const futureReview=buildPublicNotificationTriage({...complete,reviewedAt:'2026-09-01T07:59:00.000Z'});
  const missing=buildPublicNotificationTriage({...complete,responsePlan:'',acknowledgementNote:''});
  assert.equal(futureReview.receipt.state,'draft');
  assert.equal(futureReview.gates.find((gate)=>gate.id==='freshness').state,'blocked');
  assert.equal(missing.receipt.state,'draft');
  assert.equal(missing.gates.find((gate)=>gate.id==='response').state,'blocked');
  assert.equal(missing.triage.state,'blocked');
});

test('input normalization bounds duplicates and rejects unknown choices',()=>{
  const result=buildPublicNotificationTriage({...complete,type:'unknown',severity:'unknown',channel:'unknown',sourceRoute:'unknown',duplicateCount:'5000',title:'A\u0000 B'});
  assert.equal(result.type.id,'alert_trigger');
  assert.equal(result.severity.id,'attention');
  assert.equal(result.channel.id,'in_app');
  assert.equal(result.sourceRoute.id,'alert-center');
  assert.equal(result.declaration.duplicateCount,999);
  assert.equal(result.declaration.title,'A B');
  assert.equal(__test.instant('not-a-date'),null);
});

test('evidence server exposes the public triage contract without authentication',async()=>{
  const started=await startServer({port:0});
  try{
    const query=new URLSearchParams(complete);
    const response=await fetch(`http://${started.host}:${started.port}/api/v1/discovery/notification-triage?${query}`);
    const body=await response.json();
    assert.equal(response.status,200);
    assert.equal(body.receipt.state,'ready');
    assert.equal(body.triage.state,'escalate-now');
    assert.equal(body.releaseSha,'evidence-fixture');
  }finally{await new Promise((resolve)=>started.server.close(resolve));await new Promise((resolve)=>started.evidenceUpstream.server.close(resolve));}
});

test('frontend uses only the public triage API and retains visible responsive controls',async()=>{
  const [route,css,guard,registry,worker]=await Promise.all([
    readFile(path.join(root,'apps/web/public/assets/routes/notification-center.mjs'),'utf8'),
    readFile(path.join(root,'apps/web/public/assets/routes/notification-triage-v2.css'),'utf8'),
    readFile(path.join(root,'apps/web/public/assets/qelly-product-route-guard.mjs'),'utf8'),
    readFile(path.join(root,'apps/web/public/assets/route-registry.mjs'),'utf8'),
    readFile(path.join(root,'apps/web/public/qelly-service-worker.js'),'utf8')
  ]);
  assert.match(route,/\/api\/v1\/discovery\/notification-triage/);
  assert.doesNotMatch(route,/api\/v1\/notifications(?:\/|['"?])/);
  assert.match(route,/Eight review gates/);
  assert.match(route,/Evaluation trace/);
  assert.match(route,/No fixture inbox/);
  assert.doesNotMatch(guard,/\['notification-center','Notifications'\]/);
  assert.match(registry,/route:'notification-center'.*public:true/);
  assert.match(worker,/notification-triage-v2\.css/);
  assert.match(css,/@media\(max-width:760px\)/);
  assert.match(css,/@media\(max-width:430px\)/);
  assert.doesNotMatch(css,/display\s*:\s*none|visibility\s*:\s*hidden/);
});
