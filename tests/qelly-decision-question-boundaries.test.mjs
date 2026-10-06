import test from 'node:test';
import assert from 'node:assert/strict';
import {runGroundedFinanceInference,__financeIntelligenceTest as finance} from '../functions/_lib/finance-intelligence.js';

const context={tools:[{id:'decision-intelligence',truthState:'live',freshness:'LIVE',data:{asset:'BTC',interval:'15m',action:'WAIT',confidence:.7,tradeResearch:{entry:{preferred:null},stop:{price:null},status:'NO_TRADE'},contradictionAnalysis:{strongestSupport:'Observed support'},calibration:{state:'INSUFFICIENT_SAMPLE',eligible:false},scenarios:{probabilities:{bull:null,base:null,bear:null}}}}]};

test('ordinary double-r words do not hijack entry, evidence or calibration questions',()=>{
  for(const question of ['Explain the current BTC entry and stop.','Explain the current invalidation.','What is the current stop?']){
    const answer=finance.decisionFallbackAnswer(question,context);
    assert.match(answer,/Stop: unavailable/);assert.doesNotMatch(answer,/Requested R:R/);
  }
  const support=finance.decisionFallbackAnswer('What is the current strongest support?',context);
  assert.match(support,/Contradiction state:/);assert.doesNotMatch(support,/Requested R:R/);
  const calibration=finance.decisionFallbackAnswer('Explain current calibration and scenarios',context);
  assert.match(calibration,/Calibration:/);assert.doesNotMatch(calibration,/Requested R:R/);
});

test('explicit risk/reward spellings and target questions retain their authoritative branch',()=>{
  for(const question of ['Explain R:R','Explain R/R','Explain RR','Explain r r','Explain risk reward','Explain risk/reward','Explain risk-reward','Is this feasible?','Explain feasibility','Is this infeasible?','Explain the current target','Explain targets']){
    assert.match(finance.decisionFallbackAnswer(question,context),/Requested R:R: auto/);
  }
});

test('model failure preserves the user entry/stop question rather than a substring-selected answer',async()=>{
  const result=await runGroundedFinanceInference({AI:{async run(){throw Error('busy');}}},{message:'Explain the current BTC entry and stop.',mode:'decision',financeContext:context});
  assert.equal(result.state,'model_unavailable_fallback');
  assert.match(result.answer,/Entry: defined · preferred unavailable/);assert.match(result.answer,/Stop: unavailable/);assert.doesNotMatch(result.answer,/Requested R:R/);
});
