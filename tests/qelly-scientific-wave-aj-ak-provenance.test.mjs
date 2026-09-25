import test from 'node:test';
import assert from 'node:assert/strict';
import {buildDecisionQuantRisk} from '../functions/_lib/decision-quant-risk.js';
import {buildDecisionWalkForwardCalibration} from '../functions/_lib/decision-proven-graph.js';
import {initialObservationFromRecord,setupRecordFromDecision,__decisionOutcomeLedgerTest} from '../functions/_lib/decision-outcome-ledger.js';

const observedAt='2026-09-24T22:00:00.000Z';
const decision=()=>({
  schemaVersion:'qelly.decision-proven-graph/1.1.0',
  graphId:'dpg-btc-15m-provenance-test',
  generatedAt:'2026-09-24T22:00:01.000Z',
  observedAt,
  truthState:'LIVE',
  asset:'BTC',
  interval:'15m',
  horizon:'4h',
  market:{lastPrice:100,currentState:{trend:'uptrend',momentum:'positive momentum',regime:'TRENDING',volatilityRegime:'NORMAL'},candles:[{time:1,open:1,high:2,low:1,close:2,secret:'DO_NOT_ARCHIVE_CANDLE'}]},
  metrics:{rsi14:61,returnZScore:.4,atrPct:.8,trendPerBarPct:.02},
  quant:{
    schemaVersion:'qelly.decision-quant-risk/1.0.0',
    regime:'TRENDING',
    trend:{regime:'TREND_UP',adx14:31,efficiencyRatio:.52,roc14Pct:2.2},
    volatility:{regime:'NORMAL',expectedMovePct:1.4,percentile:.57},
    structure:{state:'HH_HL',bias:'UPSIDE',support:96,resistance:104},
    calibration:{schemaVersion:'qelly.decision-walk-forward-calibration/1.1.0',state:'CALIBRATED',eligible:true,sampleSize:80,brierScore:.19,reliabilityGap:.04,reliabilityBins:[]}
  },
  forecast:{paths:256,neutralThresholdPct:.3,probabilities:{bull:.58,base:.2,bear:.22}},
  qellyView:{action:'BUY',confidence:.72,evidenceGate:{qualityScore:.81},contradictions:['bounded contradiction']},
  multiTimeframe:{state:'live',agreement:{direction:'BUY',aligned:3,directional:3,total:4}},
  tradeResearch:{
    schemaVersion:'qelly.trade-research/1.2.0',
    setupId:'dpg-btc-15m-provenance-test-trade',
    status:'VALID',action:'BUY',createdAt:observedAt,expiryAt:'2026-09-25T00:00:00.000Z',
    lifecycle:{state:'TRIGGERED'},requestedRr:'auto',selected:{ratio:2,label:'1:2',target:110,feasibility:'FEASIBLE'},
    entry:{zone:[99,101],preferred:100,method:'NOW'},stop:{price:95,distance:5},invalidation:{price:{price:95}},
    targets:[{label:'1:1',price:105,ratio:1,feasibility:'FEASIBLE',source:'RR_PRESET'},{label:'1:2',price:110,ratio:2,feasibility:'FEASIBLE',source:'RR_PRESET'}]
  },
  evidence:{
    derivatives:{state:'live',fundingPct:.01,fundingChangeBps:.2,fundingPercentile:.7,openInterestNotionalUsd:123456,openInterestChangeState:'UNAVAILABLE',markOracleBasisBps:.4},
    liquidity:{state:'live',spreadBps:1.2,spreadState:'TIGHT',top5Imbalance:.2,top10Imbalance:.1,depthConsensus:'BID_HEAVY',micropriceBiasBps:.3},
    macro:{state:'available',level:'DAILY_REFERENCE',observedAt:'2026-09-24T16:00:00.000Z',fxReference:{usdInr:95.9}},
    crossAsset:{state:'available',benchmark:'ETH',correlation:.72,beta:1.1,relativeStrengthPct:.8},
    eventRisk:{state:'unavailable',level:'UNAVAILABLE'},
    news:{state:'live',provider:'GDELT',articles:[{title:'DO_NOT_ARCHIVE_NEWS_BODY',body:'PRIVATE_OR_LARGE_PAYLOAD'}]}
  },
  decisionSnapshot:{schemaVersion:'qelly.decision-snapshot/2.0.0'},
  evidenceGraph:{schemaVersion:'qelly.evidence-graph/2.0.0'},
  provenance:{
    provider:'Hyperliquid',sourceType:'public market data',dataFingerprint:'abc123fixedfingerprint',
    request:{type:'candleSnapshot',coin:'BTC',interval:'15m'},
    model:{id:'qelly-deterministic-block-bootstrap',version:'1.1.0'}
  }
});

test('Wave AJ versions quant and walk-forward calibration contracts in every low-data path',()=>{
  const quant=buildDecisionQuantRisk([],{intervalMs:900000,horizonBars:16});
  assert.equal(quant.schemaVersion,'qelly.decision-quant-risk/1.0.0');

  const unsupported=buildDecisionWalkForwardCalibration([],{interval:'2x',horizonBars:16});
  const insufficient=buildDecisionWalkForwardCalibration([],{interval:'15m',horizonBars:16});
  assert.equal(unsupported.schemaVersion,'qelly.decision-walk-forward-calibration/1.1.0');
  assert.equal(insufficient.schemaVersion,'qelly.decision-walk-forward-calibration/1.1.0');
});

test('Wave AJ/AK freezes model, quant, calibration, Decision, Evidence Graph and R:R versions with the setup',()=>{
  const prepared=setupRecordFromDecision(decision(),{workspaceId:'11111111-1111-4111-8111-111111111111',ownerId:'22222222-2222-4222-8222-222222222222'});
  assert.equal(prepared.trackable,true);
  const provenance=prepared.record.provenance;
  assert.equal(provenance.schemaVersion,'qelly.setup-provenance/1.0.0');
  assert.equal(provenance.ledgerVersion,'qelly.setup-outcome-ledger/1.1.0');
  assert.equal(provenance.sourceSetupId,'dpg-btc-15m-provenance-test-trade');
  assert.equal(provenance.sourceGraphId,'dpg-btc-15m-provenance-test');
  assert.equal(provenance.dataFingerprint,'abc123fixedfingerprint');
  assert.equal(provenance.modelId,'qelly-deterministic-block-bootstrap');
  assert.deepEqual(provenance.versions,{
    decision:'qelly.decision-proven-graph/1.1.0',
    quant:'qelly.decision-quant-risk/1.0.0',
    model:'1.1.0',
    scenario:'1.1.0',
    calibration:'qelly.decision-walk-forward-calibration/1.1.0',
    tradeResearch:'qelly.trade-research/1.2.0',
    decisionSnapshot:'qelly.decision-snapshot/2.0.0',
    evidenceGraph:'qelly.evidence-graph/2.0.0',
    rrEngine:'qelly.trade-research/1.2.0'
  });
  assert.deepEqual(provenance.pipeline.map(item=>item.stage),[
    'RAW_SOURCE','NORMALIZED_DATA','QUANT_STATE','EVIDENCE','REGIME','SCENARIO','QELLY_VIEW','SETUP','TARGET_INVALIDATION','OUTCOME'
  ]);
});

test('Wave AK persists bounded scientific component state without raw candles or news payloads',()=>{
  const prepared=setupRecordFromDecision(decision(),{workspaceId:'11111111-1111-4111-8111-111111111111',ownerId:'22222222-2222-4222-8222-222222222222'});
  const snapshot=prepared.record.evidence_snapshot;
  assert.equal(snapshot.schemaVersion,'qelly.setup-evidence-snapshot/1.0.0');
  assert.equal(snapshot.components.schemaVersion,'qelly.setup-component-snapshot/1.0.0');
  assert.equal(snapshot.components.structure.state,'HH_HL');
  assert.equal(snapshot.components.trend.adx14,31);
  assert.equal(snapshot.components.momentum.rsi14,61);
  assert.equal(snapshot.components.volatility.regime,'NORMAL');
  assert.equal(snapshot.components.multiTimeframe.direction,'BUY');
  assert.equal(snapshot.components.derivatives.openInterestNotionalUsd,123456);
  assert.equal(snapshot.components.liquidity.spreadBps,1.2);
  assert.equal(snapshot.components.crossAsset.benchmark,'ETH');
  assert.equal(snapshot.components.calibration.brierScore,.19);
  assert.equal(snapshot.components.scenario.bull,.58);

  const serialized=JSON.stringify(snapshot);
  assert.doesNotMatch(serialized,/DO_NOT_ARCHIVE_CANDLE/);
  assert.doesNotMatch(serialized,/DO_NOT_ARCHIVE_NEWS_BODY/);
  assert.doesNotMatch(serialized,/PRIVATE_OR_LARGE_PAYLOAD/);
});

test('Wave AK observations carry reconstructable provenance rather than a basis flag only',()=>{
  const d=decision();
  const prepared=setupRecordFromDecision(d,{workspaceId:'11111111-1111-4111-8111-111111111111',ownerId:'22222222-2222-4222-8222-222222222222'});
  const observation=initialObservationFromRecord(prepared.record,d);
  assert.equal(observation.provenance.basis,'server_live_decision');
  assert.equal(observation.provenance.backfilled,false);
  assert.equal(observation.provenance.versions.calibration,'qelly.decision-walk-forward-calibration/1.1.0');
  assert.equal(observation.provenance.pipeline.at(-1).stage,'OUTCOME');
});

test('provenance helper remains null-safe for legacy or partially versioned Decision objects',()=>{
  const result=__decisionOutcomeLedgerTest.provenanceSnapshot({asset:'BTC',interval:'15m',observedAt},{sourceSetupId:'legacy-source'});
  assert.equal(result.sourceSetupId,'legacy-source');
  assert.equal(result.asset,'BTC');
  assert.equal(result.versions.quant,null);
  assert.equal(result.execution,false);
});
