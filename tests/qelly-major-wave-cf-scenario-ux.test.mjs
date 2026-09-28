import test from 'node:test';
import assert from 'node:assert/strict';
import {buildDecisionScenarioUx,__decisionScenarioUxTest} from '../apps/web/public/assets/decision-scenario-ux.mjs';

const fixture=({prob=.61,eligible=false,strict=false}={})=>({
  qellyView:{action:'BUY',changesIf:'Reassess if structure or evidence changes.'},
  pastPresentFuture:{future:{
    scenarioDetails:{
      bull:{probability:prob,targetRange:{low:105,high:110},trigger:'Close above resistance.',invalidation:'Lose support.',whatChanges:'More upside evidence.'},
      base:{probability:.25,targetRange:{low:98,high:104},trigger:'Remain balanced.',invalidation:'Directional break.',whatChanges:'Stay contained.'},
      bear:{probability:.14,targetRange:{low:90,high:97},trigger:'Close below support.',invalidation:'Recover resistance.',whatChanges:'More downside evidence.'}
    },
    probabilityCalibration:{eligible,state:eligible?'CALIBRATED':'UNCALIBRATED',sampleSize:eligible?240:18,minimumSampleGate:200,highProbabilityEligible:strict},
    tail:{state:'MODELLED_TAIL_BOUNDS',lower:88,upper:112,trigger:'Modelled p05/p95 bounds only.',invalidation:'Recompute.',boundary:'Not a discrete event forecast.'}
  }},
  evidence:{derivatives:{state:'available',fundingState:'POSITIVE_CARRY',openInterestChangeState:'UNAVAILABLE'},crossAsset:{state:'available',benchmark:'ETH',divergenceState:'ALIGNED'},eventRisk:{state:'unavailable',level:'UNAVAILABLE'}},
  tradeResearch:{
    status:'VALID',action:'BUY',requestedRr:'auto',reason:'Evidence-qualified setup.',lifecycle:{state:'FORMING',historyAvailable:false},
    entry:{method:'PULLBACK',preferred:100,zone:[99,101],trigger:'Return to zone.',confirmationCondition:'Hold structure.'},
    stop:{price:96},
    expiryAt:'2026-09-29T00:00:00.000Z',
    calibration:'Target-touch probability is not independently calibrated.',
    calibrationState:{state:'UNCALIBRATED'},
    riskContext:{eventRisk:{state:'unavailable',level:'UNAVAILABLE',reason:'No scheduled feed.'}},
    matrix:[1,2,3,4].map(ratio=>({ratio,label:'1:'+ratio,target:100+4*ratio,feasibility:ratio<4?'FEASIBLE':'LOW FEASIBILITY',feasibilityReason:'Fixture geometry.',structuralBarrier:ratio===4?114:null,targetTouchProbability:null,targetCongestion:ratio===4?'BEFORE_TARGET':'CLEAR'})),
    selected:{ratio:2,label:'1:2',target:108,feasibility:'FEASIBLE',feasibilityReason:'Fixture selected.',targetTouchProbability:null,targetCongestion:'CLEAR'},
    targets:[]
  }
});

test('Wave CF adapter reshapes existing Decision evidence without becoming a second engine',()=>{
  const ux=buildDecisionScenarioUx(fixture(),{requestedRr:'auto',customRr:'2.5'});
  assert.equal(ux.schemaVersion,'qelly.decision-scenario-ux/1.0.0');
  assert.equal(ux.boundaries.derivedOnly,true);
  assert.equal(ux.boundaries.secondDecisionEngine,false);
  assert.equal(ux.scenarios.length,4);
  assert.equal(ux.watchNext.length>=3&&ux.watchNext.length<=5,true);
  assert.equal(ux.setup.direction,'BUY');
  assert.equal(ux.setup.status,'FORMING');
  assert.equal(ux.setup.targets.length,4);
  assert.equal(ux.setup.probability,null);
  assert.equal(ux.setup.probabilityState,'UNCALIBRATED');
  assert.equal(ux.rrLadder.length,6);
  assert.deepEqual(ux.rrLadder.map(item=>item.id),['1','2','3','4','auto','custom']);
  assert.ok(ux.lifecycle.some(item=>item.id==='FORMING'&&item.current&&item.icon));
  assert.ok(ux.lifecycle.filter(item=>/^T[1-4]$/.test(item.id)).every(item=>item.state==='NOT_OBSERVED'));
});

test('Wave CF does not publish uncalibrated scenario model shares as calibrated probabilities',()=>{
  const ux=buildDecisionScenarioUx(fixture({prob:.72,eligible:false}));
  const bull=ux.scenarios.find(item=>item.id==='bull');
  assert.equal(bull.modelScenarioShare,.72);
  assert.equal(bull.publishedProbability,null);
  assert.equal(bull.probabilityState,'UNCALIBRATED');
});

test('Wave CF withholds 90% class probabilities unless a strict high-probability gate exists',()=>{
  const ordinary=__decisionScenarioUxTest.scenarioProbability(.91,{eligible:true,state:'CALIBRATED',sampleSize:500});
  assert.equal(ordinary.published,null);
  assert.equal(ordinary.state,'HIGH_PROBABILITY_WITHHELD');
  const strict=__decisionScenarioUxTest.scenarioProbability(.91,{eligible:true,state:'CALIBRATED',sampleSize:500,highProbabilityEligible:true});
  assert.equal(strict.published,.91);
  assert.equal(strict.state,'STRICT_CALIBRATION_GATE_PASSED');
});

test('Wave CF R:R ladder preserves target feasibility and structural obstruction receipts',()=>{
  const ux=buildDecisionScenarioUx(fixture(),{requestedRr:'4'});
  const rr4=ux.rrLadder.find(item=>item.id==='4');
  assert.equal(rr4.active,true);
  assert.equal(rr4.target,116);
  assert.equal(rr4.feasibility,'LOW FEASIBILITY');
  assert.equal(rr4.structuralObstruction,114);
  assert.equal(rr4.probabilityState,'UNCALIBRATED');
});
