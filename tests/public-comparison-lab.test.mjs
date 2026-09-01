import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {buildPublicComparisonLab,__test} from '../functions/_lib/public-comparison-lab.js';

const read=(path)=>readFile(new URL(`../${path}`,import.meta.url),'utf8');
const complete={candidateA:'QI-EQUITY-AAPL',candidateB:'QI-EQUITY-NVDA',question:'Which candidate has the stronger quality-adjusted operating setup for the next year?',horizon:'year',owner:'Equity research lead',invalidationRule:'Rebuild after either issuer reports the next fiscal year or changes segment definitions.',sourceA:'https://www.apple.com/newsroom/',sourceB:'https://investor.nvidia.com/',period1:'FY2026E',period2:'FY2026E',period3:'FY2026E',direction1:'higher',direction2:'higher',direction3:'lower',evidenceType1:'reported',evidenceType2:'reported',evidenceType3:'consensus',weight1:'40',weight2:'35',weight3:'25',valueA1:'12',valueA2:'31',valueA3:'28',valueB1:'55',valueB2:'62',valueB3:'36'};

test('public comparison contract starts empty without protected fixture snapshots or invented values',()=>{
  const result=buildPublicComparisonLab();
  assert.equal(result.candidateA.symbol,'AAPL');
  assert.equal(result.candidateB.symbol,'NVDA');
  assert.equal(result.coverage.connectedSnapshots,0);
  assert.equal(result.receipt.state,'draft');
  assert.equal(result.receipt.scoreA,null);
  assert.equal(result.boundaries.fixtureSnapshots,false);
  assert.equal(result.boundaries.recommendation,false);
  assert.equal(result.readiness.readyGates,3);
  assert.equal(result.gates.length,8);
});

test('complete aligned declaration produces deterministic direction-aware scores and receipt',()=>{
  const first=buildPublicComparisonLab(complete);
  const second=buildPublicComparisonLab({...complete});
  assert.equal(first.receipt.state,'ready');
  assert.equal(first.readiness.readyGates,8);
  assert.equal(first.receipt.comparisonId,second.receipt.comparisonId);
  assert.equal(first.receipt.fingerprint,second.receipt.fingerprint);
  assert.match(first.receipt.comparisonId,/^AAPL-NVDA-[a-f0-9]{8}$/);
  assert.equal(first.receipt.scoreA+first.receipt.scoreB,100);
  assert.equal(first.receipt.weightsTotal,100);
  assert.equal(first.criteria[2].direction,'lower');
  assert.ok(first.criteria[2].scoreA>first.criteria[2].scoreB);
  assert.equal(first.receipt.arithmeticOnly,true);
  assert.equal(first.receipt.persisted,false);
});

test('cross-class and duplicate candidates are blocked rather than coerced into a score',()=>{
  const crossClass=buildPublicComparisonLab({...complete,candidateB:'QI-CRYPTO-BTC',sourceB:'https://bitcoin.org/en/'});
  const duplicate=buildPublicComparisonLab({...complete,candidateB:'QI-EQUITY-AAPL'});
  assert.equal(crossClass.compatible,false);
  assert.equal(crossClass.receipt.scoreA,null);
  assert.equal(crossClass.gates[0].state,'blocked');
  assert.equal(duplicate.compatible,false);
  assert.equal(duplicate.receipt.state,'draft');
});

test('source validation accepts approved HTTPS authorities and rejects lookalikes or unsafe schemes',()=>{
  assert.deepEqual(__test.officialSource('https://www.sec.gov/Archives/example.htm'),{url:'https://www.sec.gov/Archives/example.htm',authority:'sec.gov'});
  assert.deepEqual(__test.officialSource('https://investor.nvidia.com/'),{url:'https://investor.nvidia.com/',authority:'nvidia.com'});
  assert.equal(__test.officialSource('https://sec.gov.evil.example/filing'),null);
  assert.equal(__test.officialSource('http://www.apple.com/newsroom/'),null);
  assert.equal(__test.officialSource('javascript:alert(1)'),null);
});

test('Comparison Lab browser route uses the public contract and a responsive purpose-built interface',async()=>{
  const route=await read('apps/web/public/assets/routes/comparison-lab.mjs');
  const css=await read('apps/web/public/assets/routes/comparison-lab-v2.css');
  assert.match(route,/\/api\/v1\/discovery\/comparison-lab/);
  assert.doesNotMatch(route,/\/api\/v1\/asset-intelligence\/compare/);
  assert.match(route,/data-cl-form/);
  assert.match(route,/Eight gates before arithmetic/);
  assert.match(route,/<svg aria-hidden="true" focusable="false"/);
  assert.match(route,/No market feed · no source verification · no recommendation · no execution · no persistence/);
  assert.match(css,/@media\(max-width:1180px\)/);
  assert.match(css,/@media\(max-width:760px\)/);
  assert.match(css,/@media\(max-width:430px\)/);
  assert.doesNotMatch(css,/display\s*:\s*none|visibility\s*:\s*hidden/);
});
