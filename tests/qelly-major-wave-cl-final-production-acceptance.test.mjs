import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=(path)=>readFile(new URL('../'+path,import.meta.url),'utf8');

test('Wave CL closes all planned post-PR423 engineering waves',async()=>{
  const state=JSON.parse(await read('project-state/QELLY_POST_PR423_DECISION_REINVENTION_CL_2026-09-29.json'));
  const planned=['BR','BS','BT','BU','BV','BW','BX','BY','BZ','CA','CB','CC','CD','CE','CF','CG','CH','CI','CJ','CK','CL'];
  assert.equal(state.masterPromptBaseline,'11ff35cdd934c357c800db4c8e1195a63247d291');
  assert.equal(state.overallState,'PRODUCTION_ACCEPTED_WITH_EXPLICIT_EXTERNAL_LIMITATIONS');
  for(const wave of planned){
    assert.equal(Number.isInteger(state.waves[wave].pr),true,wave);
    assert.match(state.waves[wave].mergeSha,/^[0-9a-f]{40}$/i,wave);
  }
  assert.equal(state.completion.plannedWaves,21);
  assert.equal(state.completion.completedWaves,21);
  assert.equal(state.completion.completedPercent,100);
  assert.equal(state.completion.clProductionAcceptance,'PASS_EXACT_HEAD_AND_PRODUCTION_IDENTITY');
});

test('Wave CL exact tested head and production release identity are locked',async()=>{
  const state=JSON.parse(await read('project-state/QELLY_POST_PR423_DECISION_REINVENTION_CL_2026-09-29.json'));
  const cl=state.waves.CL;
  const production=state.acceptedRuntimeProduction;
  assert.equal(cl.pr,449);
  assert.equal(cl.exactHead,'8ae10a4e518b4e84c1976dc2614e564abee770dd');
  assert.equal(cl.mergeSha,'70438b7c2627be9f2dc3a0e5949e104110cde9f8');
  assert.equal(cl.exactHeadGateMatrix,'PASS_10_OF_10');
  assert.equal(cl.expectedHeadMergeGuard,true);
  assert.equal(cl.productionIdentity,'PASS');
  assert.equal(production.environment,'production');
  assert.equal(production.sourceRevision,cl.mergeSha);
  assert.equal(production.backendVersion,cl.mergeSha);
  assert.equal(production.status,'recorded');
  assert.equal(production.publicSiteUrl,'https://terminal.qellyintelligence.com');
  assert.equal(production.mode,'cloudflare-pages-public-runtime');
  assert.equal(production.verification,'AUTHENTICATED_FAIL_CLOSED_RELEASE_SYNC');
});

test('Wave CL records the complete exact-head gate matrix and browser acceptance surface',async()=>{
  const state=JSON.parse(await read('project-state/QELLY_POST_PR423_DECISION_REINVENTION_CL_2026-09-29.json'));
  assert.equal(Object.keys(state.exactHeadGates).length,10);
  for(const value of Object.values(state.exactHeadGates))assert.equal(value,'PASS');
  assert.equal(state.browserAcceptance.exactProductionArtifact,'PASS');
  assert.equal(state.browserAcceptance.firstPaintColdWarm,'PASS');
  assert.equal(state.browserAcceptance.registeredRoutes,71);
  assert.equal(state.browserAcceptance.expectedRenders,142);
  assert.equal(state.browserAcceptance.desktopMobileCapture,'PASS');
  assert.equal(state.browserAcceptance.accessibilityResponsive,'PASS');
  assert.equal(state.browserAcceptance.screenshotArchive,'PASS');
  assert.equal(state.browserAcceptance.decisionSelectedRangeInteraction,'PASS');
});

test('Wave CL preserves research, provider-truth, causal and probability boundaries',async()=>{
  const state=JSON.parse(await read('project-state/QELLY_POST_PR423_DECISION_REINVENTION_CL_2026-09-29.json'));
  assert.equal(state.boundaries.researchOnly,true);
  assert.equal(state.boundaries.tradeExecution,false);
  assert.equal(state.boundaries.fabricatedProviderTruthAllowed,false);
  assert.equal(state.boundaries.noTradeRemainsValid,true);
  assert.equal(state.boundaries.probability90PlusRequiresIndependentCalibration,true);
  assert.equal(state.boundaries.unsupportedAssetsMustRemainUnavailable,true);
  assert.equal(state.boundaries.profitabilityGuarantee,false);
  assert.equal(state.boundaries.causalProofFromAssociation,false);
  assert.equal(state.completion.scientificProbability,'SAMPLE_DEPENDENT_NO_FABRICATED_PERCENT');
});

test('Wave CL keeps the external Supabase security warning explicit',async()=>{
  const state=JSON.parse(await read('project-state/QELLY_POST_PR423_DECISION_REINVENTION_CL_2026-09-29.json'));
  assert.equal(state.securityAdvisors.security.state,'WARN');
  assert.equal(state.securityAdvisors.security.finding,'Leaked Password Protection Disabled');
  assert.equal(state.securityAdvisors.security.scope,'EXTERNAL_AUTH_CONFIGURATION');
  assert.equal(state.securityAdvisors.security.clDisposition,'EXPLICIT_UNRESOLVED_LIMITATION');
  assert.match(state.securityAdvisors.security.remediation,/supabase\.com\/docs\/guides\/auth\/password-security/);
  assert.equal(state.securityAdvisors.performance.clDisposition,'NO_BLIND_INDEX_DELETION');
});

test('Wave CL final report contains the required master-prompt closure sections and limitations',async()=>{
  const report=await read('docs/validation/QELLY_WAVE_CL_FINAL_PRODUCTION_ACCEPTANCE.md');
  for(const heading of [
    '## START','## WAVES','## RANGE','## UI / UX','## ASSETS','## FIND SETUP','## MODELS',
    '## PROBABILITY','## PERFORMANCE','## SECURITY','## PRODUCTION','## LIMITATIONS',
    '## COMPLETION','## Final acceptance'
  ])assert.ok(report.includes(heading),heading);
  for(const phrase of [
    '21 / 21 (100%)',
    'PASS 10 / 10',
    'NO TRADE remains a valid output',
    '90%+ is not permitted merely because a model score is high',
    'Leaked Password Protection Disabled',
    'PRODUCTION_ACCEPTED_WITH_EXPLICIT_EXTERNAL_LIMITATIONS',
    'does not claim profitable trading performance'
  ])assert.ok(report.includes(phrase),phrase);
  assert.doesNotMatch(report,/empirically validated as profitable/i);
});

test('Wave CL closure documentation does not introduce runtime semantics',async()=>{
  const state=JSON.parse(await read('project-state/QELLY_POST_PR423_DECISION_REINVENTION_CL_2026-09-29.json'));
  assert.equal(state.closureDocumentation.runtimeSemanticChange,false);
  assert.match(state.closureDocumentation.purpose,/already-proven CL runtime acceptance/);
});
