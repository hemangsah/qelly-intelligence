import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=(path)=>readFile(new URL('../'+path,import.meta.url),'utf8');

test('Wave CL candidate reconciles every planned post-PR423 implementation wave',async()=>{
  const state=JSON.parse(await read('project-state/QELLY_POST_PR423_DECISION_REINVENTION_CL_2026-09-29.json'));
  const planned=['BR','BS','BT','BU','BV','BW','BX','BY','BZ','CA','CB','CC','CD','CE','CF','CG','CH','CI','CJ','CK'];
  assert.equal(state.masterPromptBaseline,'11ff35cdd934c357c800db4c8e1195a63247d291');
  assert.equal(state.clStartingProduction,'454b481943a7ad5745256859df4bb6000424cfba');
  assert.equal(state.overallState,'READY_FOR_CL_EXACT_HEAD_GATES');
  for(const wave of planned){
    assert.equal(Number.isInteger(state.waves[wave].pr),true,wave);
    assert.match(state.waves[wave].mergeSha,/^[0-9a-f]{40}$/i,wave);
  }
  assert.equal(state.waves.CL.state,'THIS_PR_EXACT_HEAD_GATES_REQUIRED');
  assert.equal(state.completion.plannedWaves,21);
  assert.equal(state.completion.mergedBeforeCl,20);
  assert.equal(state.completion.mergedBeforeClPercent,95.2);
});

test('Wave CL production identity is exact and does not pre-claim the CL merge',async()=>{
  const state=JSON.parse(await read('project-state/QELLY_POST_PR423_DECISION_REINVENTION_CL_2026-09-29.json'));
  const identity=state.productionIdentityAtClStart;
  assert.equal(identity.environment,'production');
  assert.equal(identity.sourceRevision,state.clStartingProduction);
  assert.equal(identity.backendVersion,state.clStartingProduction);
  assert.equal(identity.status,'recorded');
  assert.equal(identity.publicSiteUrl,'https://terminal.qellyintelligence.com');
  assert.equal(state.completion.clProductionAcceptance,'PENDING_EXACT_HEAD_GATES_AND_POST_MERGE_RELEASE_IDENTITY');
});

test('Wave CL preserves research, provider-truth and probability safety boundaries',async()=>{
  const state=JSON.parse(await read('project-state/QELLY_POST_PR423_DECISION_REINVENTION_CL_2026-09-29.json'));
  assert.equal(state.boundaries.researchOnly,true);
  assert.equal(state.boundaries.tradeExecution,false);
  assert.equal(state.boundaries.fabricatedProviderTruthAllowed,false);
  assert.equal(state.boundaries.noTradeRemainsValid,true);
  assert.equal(state.boundaries.probability90PlusRequiresIndependentCalibration,true);
  assert.equal(state.boundaries.unsupportedAssetsMustRemainUnavailable,true);
  assert.equal(state.completion.scientificProbability,'SAMPLE_DEPENDENT_NO_FABRICATED_PERCENT');
});

test('Wave CL report contains the master-prompt final-report sections and exact closure rule',async()=>{
  const report=await read('docs/validation/QELLY_WAVE_CL_FINAL_PRODUCTION_ACCEPTANCE.md');
  for(const heading of [
    '## START','## WAVES','## RANGE','## UI / UX','## ASSETS','## FIND SETUP','## MODELS',
    '## PROBABILITY','## PERFORMANCE','## SECURITY','## PRODUCTION','## LIMITATIONS','## COMPLETION',
    '## CL exact-head closure rule'
  ])assert.ok(report.includes(heading),heading);
  for(const phrase of [
    'READY_FOR_CL_EXACT_HEAD_GATES',
    'Aggressive Discovery does not override',
    'NO TRADE remains valid',
    '90%+ is not permitted merely because a model score is high',
    'No documentation change can convert an unavailable feed',
    'the merged release is recorded as the new production source revision'
  ])assert.ok(report.includes(phrase),phrase);
});

test('Wave CL candidate does not fabricate final production closure',async()=>{
  const report=await read('docs/validation/QELLY_WAVE_CL_FINAL_PRODUCTION_ACCEPTANCE.md');
  assert.match(report,/CL finalization is not complete merely because this report exists/);
  assert.match(report,/exact CL PR head to pass the full repository gate matrix/);
  assert.doesNotMatch(report,/CL production acceptance: \*\*PASS\*\*/);
});
