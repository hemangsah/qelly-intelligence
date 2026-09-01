import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildPublicScreenerLab,__test} from '../functions/_lib/public-screener-lab.js';
import {onRequest} from '../functions/api/v1/[[path]].js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const complete={screenName:'Quality momentum review',researchQuestion:'Which US equities combine positive momentum, controlled volatility and sufficient scale?',assetClass:'equity',region:'us',sourceName:'Approved research export',sourceLocator:'dataset://research/universe/2026-09-01',snapshotAt:'2026-09-01T09:00:00.000Z',observedAt:'2026-09-01T08:30:00.000Z',maxAgeMinutes:'60',missingPolicy:'exclude',sortField:'marketCap',direction:'desc',resultLimit:'20',owner:'Cross-asset research desk',reviewCadence:'weekly',invalidationCondition:'Invalidate when field definitions, source lineage or eligible universe changes.',candidateId:'QI-EQUITY-AAPL',symbol:'AAPL',candidateAssetClass:'equity',candidateRegion:'us',candidateNote:'Test one declared candidate without inferring a universe scan.',rule1Field:'change24h',rule1Operator:'greater_than_or_equal',rule1Value:'0',rule1Observed:'2.5',rule2Field:'volatility30d',rule2Operator:'less_than_or_equal',rule2Value:'40',rule2Observed:'22.4',rule3Field:'marketCap',rule3Operator:'greater_than_or_equal',rule3Value:'100000000000',rule3Observed:'3000000000000'};

test('empty Screener Lab exposes no fixture universe or match claims',()=>{
  const result=buildPublicScreenerLab();
  assert.equal(result.version,'governed-screener-lab-v2');
  assert.equal(result.receipt.state,'draft');
  assert.equal(result.coverage.scannedRows,0);
  assert.equal(result.coverage.matchedRows,0);
  assert.equal(result.boundaries.fixtureUniverse,false);
  assert.equal(result.boundaries.savedScreenStore,false);
  assert.equal(result.boundaries.liveProvider,false);
  assert.equal(result.gates.length,8);
});

test('complete typed definition deterministically qualifies a matching candidate',()=>{
  const first=buildPublicScreenerLab(complete);
  const second=buildPublicScreenerLab(complete);
  assert.equal(first.receipt.state,'ready');
  assert.equal(first.readiness.readyGates,8);
  assert.equal(first.evaluation.outcome,'qualified');
  assert.equal(first.evaluation.ageMinutes,30);
  assert.equal(first.evaluation.passedRules,3);
  assert.match(first.receipt.screenId,/^SCR-[0-9A-F]{8}$/);
  assert.equal(first.receipt.screenId,second.receipt.screenId);
  assert.equal(first.evaluation.automaticDecision,false);
  assert.equal(first.receipt.persisted,false);
});

test('failed, missing and outside-universe candidates remain distinct',()=>{
  const failed=buildPublicScreenerLab({...complete,rule2Observed:'55'});
  const missing=buildPublicScreenerLab({...complete,missingPolicy:'manual_review',rule3Observed:''});
  const outside=buildPublicScreenerLab({...complete,candidateRegion:'india'});
  assert.equal(failed.evaluation.outcome,'excluded');
  assert.equal(failed.evaluation.failedRules,1);
  assert.equal(missing.evaluation.outcome,'review-required');
  assert.equal(missing.evaluations[2].state,'manual-review');
  assert.equal(outside.evaluation.outcome,'outside-universe');
  assert.equal(outside.evaluation.universeMatch,false);
});

test('stale evidence and incomplete rules fail closed',()=>{
  const stale=buildPublicScreenerLab({...complete,observedAt:'2026-09-01T06:00:00.000Z'});
  const incomplete=buildPublicScreenerLab({...complete,rule2Value:''});
  assert.equal(stale.receipt.state,'draft');
  assert.equal(stale.gates.find((gate)=>gate.id==='evidence').state,'blocked');
  assert.equal(incomplete.receipt.state,'draft');
  assert.equal(incomplete.gates.find((gate)=>gate.id==='rules').state,'blocked');
  assert.equal(incomplete.evaluation.outcome,'blocked');
});

test('normalization bounds output and rejects unknown choices',()=>{
  const result=buildPublicScreenerLab({...complete,assetClass:'unknown',region:'unknown',missingPolicy:'unknown',reviewCadence:'unknown',sortField:'unknown',resultLimit:'999',maxAgeMinutes:'0',screenName:'A\u0000 B'});
  assert.equal(result.declaration.assetClass,'all');
  assert.equal(result.declaration.region,'global');
  assert.equal(result.declaration.missingPolicy,'manual_review');
  assert.equal(result.declaration.reviewCadence,'weekly');
  assert.equal(result.declaration.sortField,'marketCap');
  assert.equal(result.declaration.resultLimit,100);
  assert.equal(result.declaration.maxAgeMinutes,1);
  assert.equal(result.declaration.screenName,'A B');
  assert.equal(__test.instant('not-a-date'),null);
});

test('Cloudflare handler exposes public Screener Lab without authentication',async()=>{
  const query=new URLSearchParams(complete);
  const request=new Request(`https://qelly-runtime.test/api/v1/discovery/screener-lab?${query}`);
  const response=await onRequest({request,env:{},params:{path:['discovery','screener-lab']},waitUntil(){}});
  const body=await response.json();
  assert.equal(response.status,200);
  assert.equal(body.receipt.state,'ready');
  assert.equal(body.evaluation.outcome,'qualified');
  assert.equal(body.releaseSha,'unresolved');
});

test('frontend uses only the public screen contract and retains visible responsive controls',async()=>{
  const [route,css,registry,worker]=await Promise.all([
    readFile(path.join(root,'apps/web/public/assets/routes/screener-lab.mjs'),'utf8'),
    readFile(path.join(root,'apps/web/public/assets/routes/screener-lab-v2.css'),'utf8'),
    readFile(path.join(root,'apps/web/public/assets/route-registry.mjs'),'utf8'),
    readFile(path.join(root,'apps/web/public/qelly-service-worker.js'),'utf8')
  ]);
  assert.match(route,/\/api\/v1\/discovery\/screener-lab/);
  assert.doesNotMatch(route,/api\/v1\/screeners(?:\/|['"?])/);
  assert.match(route,/Eight definition gates/);
  assert.match(route,/Predicate trace/);
  assert.match(route,/No fixture universe/);
  assert.match(route,/q-v53-real-workspace/);
  assert.match(route,/q-v53-real-inspector/);
  assert.match(registry,/route:'screener-lab'.*public:true/);
  assert.match(worker,/screener-lab-v2\.css/);
  assert.match(css,/@media\(max-width:760px\)/);
  assert.match(css,/@media\(max-width:430px\)/);
  assert.doesNotMatch(css,/display\s*:\s*none|visibility\s*:\s*hidden/);
});
