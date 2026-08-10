import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildV53ActivationAudit } from '../scripts/qelly-v53-activation-audit.mjs';

const browserProbePath=new URL('../scripts/qelly-v53-activation-browser-evidence.mjs',import.meta.url);

test('V5.3 activation audit freezes the actual runtime contract without globally activating legacy CSS',async()=>{
  const report=await buildV53ActivationAudit();

  assert.equal(report.contract.runtimeAttribute,'data-ui-lock-v53');
  assert.equal(report.contract.legacyCssAttribute,'data-ui-lock-v5-3');
  assert.equal(report.contract.runtimeWrites.actual,true);
  assert.equal(report.contract.runtimeWrites.legacy,false);

  assert.equal(report.findings.baseLegacyLayerDormant,true);
  assert.equal(report.findings.visibleRefinementDormant,true);
  assert.ok(report.inventory.base.legacyAttributeOccurrences>20);
  assert.ok(report.inventory.visibleRefinement.legacyAttributeOccurrences>10);
  assert.equal(report.findings.globalActualActivationPresent,false);
  assert.equal(report.decision.globalActivation,'hold');
});

test('only the governed Time Series containment exception uses the actual V5.3 runtime attribute in the legacy base sheet',async()=>{
  const report=await buildV53ActivationAudit();

  assert.equal(report.findings.routeScopedActualExceptionPresent,true);
  assert.equal(report.findings.actualExceptionIsTimeSeriesOnly,true);
  assert.ok(report.inventory.base.actualAttributeOccurrences>=1);
  for(const selector of report.inventory.base.actualSelectors)assert.match(selector,/#series-grid \.q-grid-scroll/);
});

test('the independently activated post-merge convergence layer remains a separate valid contract',async()=>{
  const report=await buildV53ActivationAudit();

  assert.equal(report.contract.postmergeAttribute,'data-v53-postmerge-convergence');
  assert.equal(report.contract.runtimeWrites.postmerge,true);
  assert.equal(report.findings.postmergeConvergenceActive,true);
  assert.ok(report.inventory.postmergeConvergence.attributeOccurrences>10);
});

test('legacy V5.3 surface inventory proves a global switch would touch shell, workspace, evidence and theme surfaces',async()=>{
  const report=await buildV53ActivationAudit();
  const expected=['.q-global-strip','.q-command-bar','.q-rail','#main','.q-page-head','.q-panel','.q-kpi','.q-context-drawer','.q-compare-tray','.q-live-chart-shell','.q-ti-controls'];
  for(const selector of expected)assert.equal(report.findings.legacySurfaceCoverage[selector],true,`missing legacy surface inventory for ${selector}`);
});

test('computed-style evidence harness measures dormant-current versus legacy-activated pixels without production dependencies',async()=>{
  const source=await readFile(browserProbePath,'utf8');
  assert.match(source,/getComputedStyle/);
  assert.match(source,/data-ui-lock-v53="active"/);
  assert.match(source,/setAttribute\('data-ui-lock-v5-3','active'\)/);
  assert.match(source,/timeSeriesActualAttributeExceptionActive/);
  assert.match(source,/legacyGlobalActivationChangesComputedStyles/);
  assert.match(source,/no production data, provider calls, auth, execution, custody or persistence/i);
});
