import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {buildPublicFilingWorkspace,__test} from '../functions/_lib/public-filing-workspace.js';

const read=(path)=>readFile(new URL(`../${path}`,import.meta.url),'utf8');

test('public filing contract starts empty without fixture content or invented source evidence',()=>{
  const result=buildPublicFilingWorkspace('QI-EQUITY-AAPL');
  assert.equal(result.selected.symbol,'AAPL');
  assert.equal(result.coverage.documents,0);
  assert.equal(result.coverage.sections,0);
  assert.equal(result.citation.state,'draft');
  assert.equal(result.boundaries.fixtureContent,false);
  assert.equal(result.boundaries.summaryGenerated,false);
  assert.equal(result.boundaries.officialDocumentFetched,false);
  assert.equal(result.readiness.citationReady,false);
  assert.equal(result.gates.length,7);
});

test('complete official declaration produces a deterministic reconstructable citation receipt',()=>{
  const input={form:'10-Q',filingDate:'2026-07-31',periodEnd:'2026-06-30',officialDocumentUrl:'https://www.sec.gov/Archives/edgar/data/example/report.htm',section:'Item 2 · MD&A',locator:'Page 24 · paragraph 2',claim:'Operating margin changed because input costs increased.',excerpt:'Operating margin declined during the quarter because input costs increased.',evidenceRole:'direct'};
  const first=buildPublicFilingWorkspace('MSFT',input);const second=buildPublicFilingWorkspace('QI-EQUITY-MSFT',input);
  assert.equal(first.citation.state,'ready');
  assert.equal(first.readiness.readyGates,7);
  assert.equal(first.citation.citationId,second.citation.citationId);
  assert.equal(first.citation.fingerprint,second.citation.fingerprint);
  assert.equal(first.citation.originalDocumentStored,false);
  assert.match(first.citation.citationId,/^MSFT-10-Q-/);
});

test('source validation accepts exact SEC HTTPS hosts and rejects lookalikes or unsafe schemes',()=>{
  assert.equal(__test.officialUrl('https://www.sec.gov/Archives/example.htm'),'https://www.sec.gov/Archives/example.htm');
  assert.equal(__test.officialUrl('https://sec.gov/Archives/example.htm'),'https://sec.gov/Archives/example.htm');
  assert.equal(__test.officialUrl('https://sec.gov.evil.example/report'),null);
  assert.equal(__test.officialUrl('http://www.sec.gov/report'),null);
  assert.equal(__test.officialUrl('javascript:alert(1)'),null);
});

test('Filing Workspace browser route uses only the public citation contract and responsive evidence-safe CSS',async()=>{
  const route=await read('apps/web/public/assets/routes/filing-workspace.mjs');
  const css=await read('apps/web/public/assets/routes/filing-workspace-v2.css');
  assert.match(route,/\/api\/v1\/discovery\/filing-workspace/);
  assert.doesNotMatch(route,/\/asset-intelligence\/\$\{selected\}\/filings/);
  assert.match(route,/data-fw-form/);
  assert.match(route,/data-fw-copy/);
  assert.match(route,/Verbatim excerpt/);
  assert.match(route,/Read the delta, not only the latest wording/);
  assert.match(css,/@media\(max-width:1100px\)/);
  assert.match(css,/@media\(max-width:720px\)/);
  assert.match(css,/@media\(max-width:430px\)/);
  assert.doesNotMatch(css,/display\s*:\s*none|visibility\s*:\s*hidden/);
});
