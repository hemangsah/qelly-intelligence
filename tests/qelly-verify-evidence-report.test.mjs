import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {analyzeTrades,parseTradeCsv,sampleTradeCsv} from '../apps/web/public/assets/qelly-verify-engine.mjs';
import {QELLY_VERIFY_METHODOLOGY,QELLY_VERIFY_METHODOLOGY_VERSION,QELLY_VERIFY_REPORT_SCHEMA} from '../apps/web/public/assets/qelly-verify-methodology.mjs';
import {composeStrategyEvidenceReport,fingerprintSource,stableEvidenceCore} from '../apps/web/public/assets/qelly-verify-report.mjs';

const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');

async function evidence(){
  const source=sampleTradeCsv();
  const parsed=parseTradeCsv(source);
  const analysis=analyzeTrades(parsed.trades,{sourceName:'governed-sample.csv'});
  const report=await composeStrategyEvidenceReport({analysis,validation:parsed.validation,sourceText:source,sourceName:'governed-sample.csv'});
  return {source,parsed,analysis,report};
}

test('methodology publishes explicit evidence states and unassessed boundaries',()=>{
  assert.equal(QELLY_VERIFY_METHODOLOGY.version,QELLY_VERIFY_METHODOLOGY_VERSION);
  assert.equal(QELLY_VERIFY_METHODOLOGY.evidenceClasses.length,4);
  assert.deepEqual(QELLY_VERIFY_METHODOLOGY.evidenceClasses.map(item=>item.label),['COMPUTED','HEURISTIC','NOT ASSESSED','BOUNDARY']);
  const gaps=QELLY_VERIFY_METHODOLOGY.notAssessed.map(item=>item.id);
  for(const required of ['out-of-sample','walk-forward','parameter-sensitivity','regime-dependency','transaction-cost','execution-sensitivity','portfolio-context','live-degradation'])assert.ok(gaps.includes(required));
  assert.match(QELLY_VERIFY_METHODOLOGY.scoreDisclosure.overfittingRisk,/not an estimated probability/i);
});

test('Strategy Evidence Report is versioned, local-only and provenance complete',async()=>{
  const {report,parsed}=await evidence();
  assert.equal(report.schema,QELLY_VERIFY_REPORT_SCHEMA);
  assert.equal(report.methodologyVersion,QELLY_VERIFY_METHODOLOGY_VERSION);
  assert.equal(report.source.uploaded,false);
  assert.equal(report.source.retained,false);
  assert.equal(report.source.processingBoundary,'browser-local');
  assert.match(report.source.fingerprint.algorithm,/SHA-256|FNV-1A-32-FALLBACK/);
  assert.ok(report.source.fingerprint.value.length>=8);
  assert.equal(report.dataQuality.validRows,parsed.validation.validRows);
  assert.equal(report.evidenceCoverage.computedCount,6);
  assert.equal(report.evidenceCoverage.notAssessedCount,8);
  assert.match(report.executiveSummary.conclusionBoundary,/does not predict performance|does not.*personalized financial advice/i);
  assert.equal(report.sequenceStress.state,'COMPUTED');
  assert.equal(report.internalStability.state,'HEURISTIC');
  assert.ok(report.failureConditions.length>=1);
});

test('fingerprint and numerical evidence core are deterministic for identical normalized input',async()=>{
  const source=sampleTradeCsv();
  const firstFingerprint=await fingerprintSource(source.replace(/\n/g,'\r\n'));
  const secondFingerprint=await fingerprintSource(source);
  assert.equal(firstFingerprint.value,secondFingerprint.value);
  const first=await evidence();
  const second=await evidence();
  assert.deepEqual(stableEvidenceCore(first.report),stableEvidenceCore(second.report));
});

test('report refuses incomplete analysis inputs',async()=>{
  await assert.rejects(()=>composeStrategyEvidenceReport({analysis:{},validation:null,sourceText:'pnl\n1'}),error=>error?.code==='verify_report_input_invalid');
});

test('product renders full report modules and public evidence methodology without network analysis',async()=>{
  const product=await read('apps/web/public/assets/qelly-verify-product.mjs');
  for(const phrase of ['Qelly Strategy Evidence Report','Executive evidence posture','Evidence coverage','Explicitly not assessed','Evidence provenance','Failure conditions','public evidence methodology','Every conclusion needs an evidence state'])assert.match(product,new RegExp(phrase,'i'));
  assert.match(product,/composeStrategyEvidenceReport/);
  assert.match(product,/data-verify-print/);
  assert.match(product,/data-verify-export/);
  assert.doesNotMatch(product,/fetch\s*\(/);
  assert.doesNotMatch(product,/placeOrder|executeTrade|wallet\.sign/i);
});

test('compiled shell and release-aware service worker include every evidence module',async()=>{
  const index=await read('apps/web/public/index.html');
  const worker=await read('apps/web/public/qelly-service-worker.js');
  assert.match(index,/qelly-verify-evidence\.css/);
  for(const asset of ['qelly-verify-evidence.css','qelly-verify-methodology.mjs','qelly-verify-report.mjs'])assert.match(worker,new RegExp(asset.replaceAll('.','\\.')));
  assert.match(worker,/networkFirst\(request\)/);
});
