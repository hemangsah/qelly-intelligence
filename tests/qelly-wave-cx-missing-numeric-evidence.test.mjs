import test from 'node:test';
import assert from 'node:assert/strict';
import {isFiniteDecisionEvidence,formatDecisionProbability} from '../apps/web/public/assets/decision-numeric-evidence.mjs';
import {buildDecisionScenarioUx} from '../apps/web/public/assets/decision-scenario-ux.mjs';

test('unavailable evidence cannot coerce into a zero probability; genuine numeric zero is preserved',()=>{
 for(const value of [null,undefined,'','  ',false,true,[],{},NaN,Infinity,'NaN']){
  assert.equal(isFiniteDecisionEvidence(value),false);
  assert.equal(formatDecisionProbability(value),'UNCALIBRATED');
 }
 for(const value of [0,'0',' 0 ']){assert.equal(isFiniteDecisionEvidence(value),true);assert.equal(formatDecisionProbability(value),'0.0%');}
 assert.equal(formatDecisionProbability(.25),'25.0%');
});
test('missing setup levels, obstruction and probability remain missing throughout the retail view model',()=>{
 const ux=buildDecisionScenarioUx({tradeResearch:{action:'NO TRADE',status:'NO_TRADE',stop:{price:null},selected:{targetTouchProbability:null},matrix:[{ratio:1,target:null,structuralBarrier:null}]},confidence:{probabilityCalibration:{eligible:false,state:'UNCALIBRATED'}}});
 assert.equal(ux.setup.stop,null);assert.equal(ux.setup.probability,null);assert.equal(formatDecisionProbability(ux.setup.probability),'UNCALIBRATED');
 assert.equal(ux.setup.targets[0].target,null);assert.equal(ux.setup.targets[0].structuralObstruction,null);
 assert.ok(ux.scenarios.every(item=>item.publishedProbability===null));
 assert.ok(ux.rrLadder.every(item=>item.target===null));
});
