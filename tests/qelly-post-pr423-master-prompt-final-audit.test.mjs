import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=(path)=>readFile(new URL('../'+path,import.meta.url),'utf8');

test('final master-prompt audit locks the exact runtime acceptance anchor and every engineering wave',async()=>{
  const state=JSON.parse(await read('project-state/QELLY_POST_PR423_MASTER_PROMPT_FINAL_AUDIT_2026-09-30.json'));
  assert.equal(state.masterPromptBaseline,'11ff35cdd934c357c800db4c8e1195a63247d291');
  assert.equal(state.runtimeAcceptanceAnchor,'d95a7954d1733cc57ec893b757ee1adb78400539');
  assert.equal(state.overallState,'ENGINEERING_ACCEPTED_PROVIDER_LIMITED_WITH_EXPLICIT_EXTERNAL_LIMITATIONS');
  assert.equal(Object.keys(state.engineeringWaves).length,21);
  for(const [wave,item] of Object.entries(state.engineeringWaves)){
    assert.equal(Number.isInteger(item.pr),true,wave);
    assert.match(item.testedHead,/^[0-9a-f]{40}$/i,wave);
    assert.match(item.mergeSha,/^[0-9a-f]{40}$/i,wave);
  }
  assert.equal(state.completion.engineeringWavesPercent,100);
  assert.equal(state.completion.auditedSourceSupportedRemediationPercent,100);
});

test('final audit separates catalog completeness from live provider coverage',async()=>{
  const state=JSON.parse(await read('project-state/QELLY_POST_PR423_MASTER_PROMPT_FINAL_AUDIT_2026-09-30.json'));
  assert.equal(state.assetCoverage.requestedCategoryCount,10);
  assert.equal(state.assetCoverage.catalogRepresentedCategoryCount,10);
  assert.equal(state.assetCoverage.catalogCoveragePercent,100);
  assert.equal(state.assetCoverage.selectableCategoryCount,1);
  assert.equal(state.assetCoverage.selectableCategoryPercent,10);
  assert.equal(state.assetCoverage.referenceOnlyCategoryCount,1);
  assert.equal(state.assetCoverage.referenceOnlyCategoryPercent,10);
  assert.equal(state.assetCoverage.unavailableCategoryCount,8);
  assert.equal(state.assetCoverage.unavailableCategoryPercent,80);
  assert.equal(state.assetCoverage.selectableAssetCount,6);
  assert.deepEqual(state.assetCoverage.selectableSymbols,['BTC','ETH','SOL','HYPE','XRP','DOGE']);
});

test('final audit preserves probability and provider truth boundaries',async()=>{
  const state=JSON.parse(await read('project-state/QELLY_POST_PR423_MASTER_PROMPT_FINAL_AUDIT_2026-09-30.json'));
  assert.equal(state.remediation.probability90MinimumRelevantBucketSamples,200);
  assert.equal(state.remediation.highestCalibratedProbabilityState,'UNAVAILABLE_UNTIL_GENUINE_TARGET_TOUCH_CALIBRATION');
  assert.equal(state.boundaries.fabricatedProviderTruthAllowed,false);
  assert.equal(state.boundaries.unsupportedAssetsSelectable,false);
  assert.equal(state.boundaries.noTradeRemainsValid,true);
  assert.equal(state.boundaries.empiricalCalibrationPercentFabricated,false);
  assert.equal(state.completion.empiricalCalibrationPercent,null);
});

test('final audit records exact production performance and release gates',async()=>{
  const state=JSON.parse(await read('project-state/QELLY_POST_PR423_MASTER_PROMPT_FINAL_AUDIT_2026-09-30.json'));
  assert.equal(state.production.sourceRevision,state.runtimeAcceptanceAnchor);
  assert.equal(state.production.backendVersion,state.runtimeAcceptanceAnchor);
  assert.equal(state.production.status,'recorded');
  assert.equal(state.production.cloudflareDeploy,'PASS');
  assert.equal(state.production.canonicalStableSamples,2);
  assert.equal(state.production.openPrCount,0);
  for(const value of Object.values(state.production.pushGates))assert.equal(value,'PASS');
  assert.equal(state.browserAcceptance.expectedRenders,142);
  assert.equal(state.browserAcceptance.selectedRangeInteraction,'PASS');
  assert.equal(state.performance.maxFcpMs,972);
  assert.equal(state.performance.maxLcpMs,1128);
  assert.equal(state.performance.maxCls,0.00203);
  assert.equal(state.performance.maxInpMs,232);
  assert.equal(state.performance.maxRouteTransitionMs,238.9);
  assert.equal(state.performance.longTasksOver500,0);
});

test('final audit report contains the required truth-separated sections',async()=>{
  const report=await read('docs/validation/QELLY_POST_PR423_MASTER_PROMPT_FINAL_AUDIT_2026-09-30.md');
  for(const heading of ['## START / reconciliation','## WAVES — exact tested heads and merge SHAs','## RANGE INTELLIGENCE','## UI / UX','## ASSETS / PROVIDERS','## FIND SETUP NOW','## MODELS / FORMULAS / SMC','## PROBABILITY / NEXT MOVE','## PERFORMANCE — exact runtime anchor evidence','## SECURITY','## PRODUCTION','## LIMITATIONS','## COMPLETION','## Final acceptance'])assert.ok(report.includes(heading),heading);
  for(const phrase of ['ENGINEERING_ACCEPTED_PROVIDER_LIMITED_WITH_EXPLICIT_EXTERNAL_LIMITATIONS','1 / 10 categories — 10%','Leaked Password Protection Disabled','max FCP: **972 ms**','90%+ publication requires at least **200 independent resolved outcomes','Open PRs at runtime acceptance: **0**'])assert.ok(report.includes(phrase),phrase);
  assert.doesNotMatch(report,/universal live-market coverage.*100%/i);
  assert.doesNotMatch(report,/guaranteed profit/i);
});

test('final audit documentation is explicitly non-semantic',async()=>{
  const state=JSON.parse(await read('project-state/QELLY_POST_PR423_MASTER_PROMPT_FINAL_AUDIT_2026-09-30.json'));
  assert.equal(state.documentation.runtimeSemanticChange,false);
  assert.match(state.documentation.note,/runtime acceptance anchor remains the functional evidence reference/i);
});
