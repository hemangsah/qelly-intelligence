import test from 'node:test';
import assert from 'node:assert/strict';
import {runDecisionScan,__decisionScanTest} from '../functions/api/v1/decision-scan.js';

const fixture=(asset,{
  interval='15m',action='BUY',calibrated=true,quality=.72,truthState='LIVE',eventState='unavailable',eventLevel='UNAVAILABLE',
  tradeStatus='VALID',lifecycle='TRIGGERED',selectedFeasibility='FEASIBLE',selectedRatio=2
}={})=>({
  asset,interval,horizon:'4h',observedAt:'2026-09-27T10:00:00.000Z',truthState,
  market:{lastPrice:100,currentState:{regime:'trending'}},
  quant:{regime:'trending',structure:{state:'HH_HL'},volatility:{regime:'NORMAL',expectedMovePct:2}},
  qellyView:{
    action,label:'Fixture research view',contradictions:calibrated?[]:['Calibration unavailable'],
    evidenceGate:{qualityScore:quality,scenarioSeparation:.3,timeframeAgreement:.75,freshness:truthState==='LIVE'?1:.4,timeframeDirection:action,calibrationState:calibrated?'CALIBRATED':'UNCALIBRATED',calibrationEligible:calibrated,quantCoverage:'derived'}
  },
  eventRisk:{state:eventState,level:eventLevel},
  liquidity:{state:'live',spreadState:'TIGHT',spreadBps:2},
  tradeResearch:{
    status:tradeStatus,requestedRr:'1:'+selectedRatio,reason:tradeStatus==='VALID'?'Evidence-qualified setup':'Requested R:R is not validated.',
    lifecycle:{state:lifecycle},
    entry:{preferred:100,method:lifecycle==='FORMING'?'PULLBACK':'NOW',trigger:'Verified entry trigger',confirmationCondition:'Evidence remains eligible.'},
    stop:{price:98},
    selected:selectedRatio?{label:'1:'+selectedRatio,ratio:selectedRatio,feasibility:selectedFeasibility,target:100+2*selectedRatio,targetCongestion:'CLEAR',selectionScore:selectedRatio===2?84:20}:null,
    matrix:[1,2,3,4].map(ratio=>({label:'1:'+ratio,ratio,target:100+2*ratio,feasibility:ratio<=2?'FEASIBLE':'LOW FEASIBILITY',targetCongestion:ratio<=2?'CLEAR':'BEFORE_TARGET',selectionScore:ratio===2?84:72})),
    structuralTargets:[],
    expiryAt:'2026-09-27T14:00:00.000Z'
  }
});

test('Wave BZ exposes validated/aggressive modes and bounded adjacent-timeframe search',()=>{
  assert.equal(__decisionScanTest.DISCOVERY_MODES.has('validated'),true);
  assert.equal(__decisionScanTest.DISCOVERY_MODES.has('aggressive'),true);
  assert.equal(__decisionScanTest.RANKING_PREFERENCES.has('highest_quality'),true);
  assert.equal(__decisionScanTest.RANKING_PREFERENCES.has('lowest_event_risk'),true);
  assert.equal(__decisionScanTest.RANKING_PREFERENCES.has('closest_candidate'),true);
  assert.equal(__decisionScanTest.RANKING_PREFERENCES.has('fastest_setup'),true);
  assert.equal(__decisionScanTest.RANKING_PREFERENCES.has('lowest_risk'),true);
  assert.deepEqual(__decisionScanTest.aggressiveIntervals('15m','4h'),['15m','30m']);
  assert.equal(__decisionScanTest.searchVariants(['BTC','ETH'],{mode:'aggressive',interval:'15m',horizon:'4h'}).length,4);
});

test('Wave BZ validated mode applies preference filters strictly',async()=>{
  const scan=await runDecisionScan({},{
    mode:'validated',minEvidenceQuality:.85,assets:'BTC',now:Date.parse('2026-09-27T10:00:00.000Z'),
    build:async(_env,{asset,interval})=>fixture(asset,{interval,quality:.7})
  });
  assert.equal(scan.eligibleCount,0);
  assert.equal(scan.closestCandidate.validated,false);
  assert.ok(scan.closestCandidate.missingConditions.includes('evidence_quality_below_minimum'));
  assert.equal(scan.boundaries.closestCandidateIsValidated,false);
});

test('Wave BZ aggressive discovery relaxes only noncritical preferences',async()=>{
  const scan=await runDecisionScan({},{
    mode:'aggressive',assets:'BTC',minEvidenceQuality:.9,minMtfAgreement:1,now:Date.parse('2026-09-27T10:00:00.000Z'),
    build:async(_env,{asset,interval})=>fixture(asset,{interval,quality:.65})
  });
  assert.equal(scan.eligibleCount>0,true);
  assert.equal(scan.validatedSetup.discoveryMode,'aggressive');
  assert.ok(scan.validatedSetup.relaxedPreferences.includes('evidence_quality_below_minimum'));
  assert.ok(scan.validatedSetup.relaxedPreferences.includes('mtf_agreement_below_minimum'));
  assert.equal(scan.boundaries.aggressiveCanFabricateValidSetup,false);
});

test('Wave BZ aggressive discovery never bypasses calibration or explicit event-risk requirements',async()=>{
  const uncalibrated=await runDecisionScan({},{
    mode:'aggressive',assets:'BTC',now:Date.parse('2026-09-27T10:00:00.000Z'),
    build:async(_env,{asset,interval})=>fixture(asset,{interval,calibrated:false})
  });
  assert.equal(uncalibrated.eligibleCount,0);
  assert.ok(uncalibrated.closestCandidate.missingConditions.includes('calibration_gate_not_passed'));
  assert.equal(uncalibrated.closestCandidate.calibratedProbability,null);

  const strictEvent=await runDecisionScan({},{
    mode:'aggressive',assets:'BTC',eventRiskTolerance:'low',now:Date.parse('2026-09-27T10:00:00.000Z'),
    build:async(_env,{asset,interval})=>fixture(asset,{interval,eventState:'unavailable'})
  });
  assert.equal(strictEvent.eligibleCount,0);
  assert.ok(strictEvent.closestCandidate.missingConditions.includes('event_risk_unavailable'));
});

test('Wave BZ aggressive discovery searches adjacent timeframes and existing R:R matrix without fabricating a target',async()=>{
  const calls=[];
  const scan=await runDecisionScan({},{
    mode:'aggressive',assets:'BTC',requestedRr:'4',now:Date.parse('2026-09-27T10:00:00.000Z'),
    build:async(_env,args)=>{
      calls.push(args.interval);
      return fixture(args.asset,{interval:args.interval,tradeStatus:'NO_TRADE',selectedFeasibility:'LOW FEASIBILITY',selectedRatio:4});
    }
  });
  assert.deepEqual([...new Set(calls)],['15m','30m']);
  assert.equal(scan.eligibleCount>0,true);
  assert.equal(scan.validatedSetup.trade.rr,'1:2');
  assert.equal(scan.validatedSetup.trade.rrRelaxed,true);
  assert.deepEqual(scan.validatedSetup.trade.searchedRiskRewards,['1:1','1:2','1:3','1:4']);
  assert.equal(scan.boundaries.fabricatedFallback,false);
});

test('Wave BZ stale data and verified extreme event risk remain hard blockers',async()=>{
  const stale=await runDecisionScan({},{
    mode:'aggressive',assets:'BTC',freshness:'any',now:Date.parse('2026-09-27T10:00:00.000Z'),
    build:async(_env,{asset,interval})=>fixture(asset,{interval,truthState:'STALE'})
  });
  assert.equal(stale.eligibleCount,0);
  assert.ok(stale.closestCandidate.missingConditions.includes('freshness_below_core_requirement'));

  const extreme=await runDecisionScan({},{
    mode:'aggressive',assets:'BTC',now:Date.parse('2026-09-27T10:00:00.000Z'),
    build:async(_env,{asset,interval})=>fixture(asset,{interval,eventState:'available',eventLevel:'EXTREME'})
  });
  assert.equal(extreme.eligibleCount,0);
  assert.ok(extreme.closestCandidate.missingConditions.includes('critical_event_risk'));
});

test('Post-CL scanner can rank fastest validated setups and lowest research risk without using probability as a proxy',async()=>{
  const now=Date.parse('2026-09-27T10:00:00.000Z');
  const fastest=await runDecisionScan({},{
    mode:'validated',ranking:'fastest_setup',assets:'BTC,ETH',now,
    build:async(_env,{asset,interval})=>fixture(asset,{interval,selectedRatio:asset==='BTC'?1:2})
  });
  assert.equal(fastest.candidates[0].asset,'BTC');
  assert.equal(fastest.candidates[0].trade.expectedResolutionState,'HEURISTIC');
  assert.match(fastest.candidates[0].trade.expectedResolutionBoundary,/research heuristic/i);

  const lowRisk=await runDecisionScan({},{
    mode:'validated',ranking:'lowest_risk',assets:'BTC,ETH',now,
    build:async(_env,{asset,interval})=>{
      const item=fixture(asset,{interval});
      if(asset==='ETH'){item.tradeResearch.stop.price=90;item.quant.volatility.regime='HIGH';item.eventRisk={state:'available',level:'HIGH'};item.liquidity={state:'live',spreadState:'WIDE',spreadBps:30};}
      return item;
    }
  });
  assert.equal(lowRisk.candidates[0].asset,'BTC');
  assert.ok(lowRisk.candidates[0].researchRisk.score>lowRisk.candidates[1].researchRisk.score);
  assert.match(lowRisk.candidates[0].researchRisk.boundary,/not personalized financial risk/i);
});

test('Wave BZ closest candidate is explicitly unvalidated with missing conditions and probability boundary',async()=>{
  const scan=await runDecisionScan({},{
    mode:'aggressive',ranking:'closest_candidate',assets:'BTC',now:Date.parse('2026-09-27T10:00:00.000Z'),
    build:async(_env,{asset,interval})=>fixture(asset,{interval,calibrated:false,lifecycle:'FORMING'})
  });
  assert.notEqual(scan.state,'VALID_SETUP');
  assert.equal(scan.closestCandidate.label,'CLOSEST CANDIDATE — NOT YET VALIDATED');
  assert.equal(scan.closestCandidate.validated,false);
  assert.equal(scan.closestCandidate.possibleTrigger,'Verified entry trigger');
  assert.ok(scan.closestCandidate.whatMustHappen.length>=1);
  assert.equal(scan.closestCandidate.probabilityState,'UNCALIBRATED');
  assert.equal(scan.closestCandidate.calibratedProbability,null);
  assert.match(scan.closestCandidate.boundary,/not a valid setup/i);
});
