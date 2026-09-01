import test from 'node:test';
import assert from 'node:assert/strict';
import {buildPublicFundamentalsEstimates,__test} from '../functions/_lib/public-fundamentals-estimates.js';

test('public fundamentals contract separates unavailable issuer evidence from user-assumption math',()=>{
  const result=buildPublicFundamentalsEstimates('QI-EQUITY-AAPL');
  assert.equal(result.selected.symbol,'AAPL');
  assert.equal(result.coverage.statementPeriods,0);
  assert.equal(result.coverage.estimateObservations,0);
  assert.equal(result.coverage.analystCount,0);
  assert.equal(result.boundaries.fixtureFinancials,false);
  assert.equal(result.boundaries.reportedFacts,false);
  assert.equal(result.boundaries.consensus,false);
  assert.equal(result.boundaries.userAssumptions,true);
  assert.equal(result.readiness.scenarioComputable,true);
  assert.equal(result.readiness.reportedAnalysisReady,false);
  assert.equal(result.qualityGates.length,7);
  assert.equal(result.definitions.length,6);
});

test('scenario engine returns reproducible backend math and three mechanical sensitivities',()=>{
  const result=buildPublicFundamentalsEstimates('MSFT',{baseRevenue:2000,revenueGrowthPct:10,operatingMarginPct:25,taxRatePct:20,dilutedShares:100,earningsMultiple:18});
  assert.equal(result.selected.id,'QI-EQUITY-MSFT');
  assert.deepEqual(result.scenario.outputs,{revenue:2200,operatingIncome:550,modeledNetIncome:440,modeledEps:4.4,indicatedValue:79.2});
  assert.deepEqual(result.scenario.sensitivity.map((row)=>row.id),['lower','base','higher']);
  assert.equal(result.scenario.sensitivity[1].indicatedValue,79.2);
  assert.match(result.scenario.receipt,/user-declared model/);
});

test('scenario inputs clamp at declared safety bounds and unknown issuers fail to a canonical identity',()=>{
  const result=buildPublicFundamentalsEstimates('UNKNOWN',{baseRevenue:-5,revenueGrowthPct:999,operatingMarginPct:-500,taxRatePct:150,dilutedShares:0,earningsMultiple:900});
  assert.equal(result.selected.id,'QI-EQUITY-AAPL');
  assert.deepEqual(result.scenario.assumptions,{baseRevenue:1,revenueGrowthPct:500,operatingMarginPct:-100,taxRatePct:100,dilutedShares:.01,earningsMultiple:500});
  assert.equal(__test.ISSUERS.length,3);
});
