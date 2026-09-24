import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=(path)=>readFile(new URL(`../${path}`,import.meta.url),'utf8');
const json=async(path)=>JSON.parse(await read(path));

test('Wave ZB final acceptance artifact covers every master Decision and Terminal checklist item',async()=>{
  const acceptance=await json('artifacts/QELLY_NEXT_FRONTIER_FINAL_ACCEPTANCE.json');
  assert.equal(acceptance.schemaVersion,'qelly.next-frontier-final-acceptance/1.0.0');
  assert.equal(acceptance.start.promptBaselineSha,'0fc22351c5fcf4541892954e273ef58e95691106');
  assert.equal(acceptance.start.reconciledProductionSha,'9f422f60a393e87285201abab12934acd18b4780');
  assert.equal(acceptance.start.openPrsAtZbStart,0);
  assert.equal(acceptance.waves.length,12);
  assert.deepEqual(acceptance.waves.map(x=>x.pr),[385,386,387,388,389,390,391,392,393,394,395,396]);
  assert.equal(acceptance.decisionChecklist.length,45);
  assert.equal(acceptance.terminalChecklist.length,20);
  assert.ok(acceptance.decisionChecklist.every(x=>['PASS','PASS_WITH_REVIEWED_EXCEPTIONS'].includes(x.status)));
  assert.ok(acceptance.terminalChecklist.every(x=>x.status==='PASS'));
});

test('Wave ZB performance report is transparent about point latency and preserves exact-head browser budgets',async()=>{
  const acceptance=await json('artifacts/QELLY_NEXT_FRONTIER_FINAL_ACCEPTANCE.json');
  const perf=acceptance.performance;
  assert.equal(perf.waveQPointBaselineMs.decisionApi,3056);
  assert.equal(perf.waveQPointBaselineMs.scannerApi,2556);
  assert.equal(perf.browserWaveZaExactHead.maxFcpMs,940);
  assert.equal(perf.browserWaveZaExactHead.maxLcpMs,1060);
  assert.equal(perf.browserWaveZaExactHead.maxCls,0.00203);
  assert.equal(perf.browserWaveZaExactHead.maxInpMs,272);
  assert.equal(perf.browserWaveZaExactHead.maxLongTaskMs,162);
  assert.equal(perf.browserWaveZaExactHead.longTasksOver500,0);
  assert.equal(perf.browserWaveZaExactHead.criticalStalls,0);
  assert.equal(perf.browserWaveZaExactHead.routeCycleStatus,'passed');
  assert.equal(perf.browserWaveZaExactHead.routeCycleDomStart,perf.browserWaveZaExactHead.routeCycleDomEnd);
  assert.match(perf.pointObservationBoundary,/not percentile/i);
  assert.match(perf.budgetBoundary,/no threshold was loosened/i);
});

test('Wave ZB final security acceptance records RLS/JWT/custom-auth boundaries and the manual leaked-password setting',async()=>{
  const acceptance=await json('artifacts/QELLY_NEXT_FRONTIER_FINAL_ACCEPTANCE.json');
  const security=acceptance.security;
  assert.match(security.publicTablesRls,/every public table.*RLS enabled/i);
  assert.match(security.edgeFunctions,/verify_jwt=true/i);
  assert.match(security.edgeFunctions,/internal secret-header/i);
  assert.match(security.securityDefiner,/auth\.uid\(\)/i);
  assert.match(security.securityDefiner,/empty search_path/i);
  assert.match(security.leakedPasswordProtection,/EXTERNAL_MANUAL/);
  assert.match(security.recentBackendLogs,/zero error-level/i);
  assert.match(security.performanceAdvisors,/35 unused-index/i);
});

test('Wave ZB production acceptance preserves truth boundaries and one authoritative research flow',async()=>{
  const [acceptance,decision,scan,context,chatTools,flowAudit]=await Promise.all([
    json('artifacts/QELLY_NEXT_FRONTIER_FINAL_ACCEPTANCE.json'),
    read('functions/api/v1/decision-proven-graph.js'),
    read('functions/api/v1/decision-scan.js'),
    read('functions/_lib/decision-context.js'),
    read('functions/_lib/qelly-chat-tools.js'),
    json('artifacts/QELLY_WAVE_Z_PRODUCT_COHERENCE.json')
  ]);
  assert.match(decision,/buildUnavailableDecisionEventRisk/);
  assert.match(decision,/buildDecisionCrossAsset/);
  assert.match(scan,/governedUniverse|GOVERNED/i);
  assert.match(context,/qelly\.past-present-future\/2\.0\.0/);
  assert.match(context,/qelly\.evidence-graph\/2\.0\.0/);
  assert.match(chatTools,/qelly\.decision-copilot-context\/2\.0\.0/);
  assert.equal(flowAudit.flow.canonical.join(' → '),'Universal Search → Asset Dossier → Decision Intelligence → Formula Screener → Qelly Chat');
  assert.match(acceptance.decisionEvidence.events,/scheduled feed unavailable/i);
  assert.match(acceptance.decisionEvidence.analogs,/leakage-guarded/i);
});

test('Wave ZB final report contains every master-required report section and avoids claiming an unmeasured API speedup',async()=>{
  const report=await read('docs/audits/QELLY_NEXT_FRONTIER_FINAL_REPORT.md');
  for(const heading of ['## START','## WAVES','## DECISION','## PERFORMANCE','## SECURITY','## CLEANUP','## PRODUCTION','## COMPLETION CANDIDATE']){
    assert.ok(report.includes(heading),heading);
  }
  assert.match(report,/no API speedup is claimed/i);
  assert.match(report,/leaked-password protection remains disabled/i);
  assert.match(report,/not the final deployment claim by itself/i);
});
