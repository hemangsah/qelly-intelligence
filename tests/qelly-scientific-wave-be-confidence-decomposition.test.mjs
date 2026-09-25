import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {calibrateDecisionEvidence} from '../functions/api/v1/decision-proven-graph.js';
import {__decisionScanTest} from '../functions/api/v1/decision-scan.js';
import {compactDecisionToolReceipt} from '../functions/_lib/qelly-chat-tools.js';

const read=(path)=>readFile(new URL('../'+path,import.meta.url),'utf8');

const baseGraph=(preliminaryConfidence=.4,calibration={state:'UNCALIBRATED',eligible:false})=>({
  schemaVersion:'qelly.decision-proven-graph/1.1.0',
  graphId:'dpg-test',
  asset:'BTC',interval:'15m',horizonBars:16,horizon:'4h',
  observedAt:'2026-09-25T09:30:00.000Z',generatedAt:'2026-09-25T09:30:01.000Z',
  truthState:'LIVE',
  freshness:{state:'LIVE',ageMs:1_000,intervalMs:900_000},
  market:{points:240,lastPrice:100,currentState:{trend:'range',regime:'TRANSITION'}},
  metrics:{atrPct:1,rsi14:50},
  quant:{state:'DERIVED',regime:'TRANSITION',volatility:{regime:'NORMAL',expectedMovePct:2},structure:{state:'EXPANDING_RANGE',bias:'MIXED'},calibration},
  forecast:{probabilities:{bull:.55,base:.20,bear:.25}},
  qellyView:{action:'WAIT',confidence:preliminaryConfidence,why:[],label:'No directional edge clears the evidence threshold.',changesIf:'Fresh evidence aligns.',levels:null},
  confidence:{score:preliminaryConfidence,calibration:'preliminary'},
  graph:{nodes:[{id:'decision',label:'QELLY VIEW WAIT'}],edges:[]}
});

const mtf=(total=4,aligned=2,directional=2)=>({state:'live',agreement:{total,aligned,directional,direction:aligned?'BUY':'MIXED'},views:[]});

test('Wave BE final evidence confidence is invariant to preliminary model confidence',()=>{
  const low=calibrateDecisionEvidence(baseGraph(.31),mtf(4,2,2),{state:'unavailable'},{state:'unavailable'});
  const high=calibrateDecisionEvidence(baseGraph(.91),mtf(4,2,2),{state:'unavailable'},{state:'unavailable'});
  assert.equal(low.qellyView.confidence,high.qellyView.confidence);
  assert.equal(low.qellyView.confidence,.88);
  assert.equal(low.confidence.decomposition.preliminaryModelConfidence,.31);
  assert.equal(high.confidence.decomposition.preliminaryModelConfidence,.91);
  assert.equal(low.confidence.decomposition.preliminaryModelConfidenceReused,false);
  assert.equal(high.confidence.decomposition.preliminaryModelConfidenceReused,false);
  assert.equal(low.confidence.decomposition.primitiveReuse,false);
});

test('Wave BE confidence weights sum to one and contributions reconcile to quality score',()=>{
  const result=calibrateDecisionEvidence(baseGraph(.77),mtf(4,2,2),{state:'unavailable'},{state:'unavailable'});
  const d=result.confidence.decomposition;
  const weightSum=Object.values(d.weights).reduce((sum,value)=>sum+value,0);
  const contributionSum=Object.values(d.components).reduce((sum,item)=>sum+item.contribution,0);
  assert.ok(Math.abs(weightSum-1)<1e-12);
  assert.ok(Math.abs(contributionSum-d.qualityScore)<.0011);
  assert.equal(d.weights.freshness,.30);
  assert.equal(d.weights.sampleDepth,.20);
  assert.equal(d.weights.scenarioSeparation,.25);
  assert.equal(d.weights.timeframeEvidence,.25);
  assert.equal(result.qellyView.confidence,Math.round(d.qualityScore*100)/100);
  assert.match(d.boundary,/each enter the final score exactly once/i);
});

test('Wave BE multi-timeframe contribution is coverage adjusted rather than treating partial coverage as full evidence',()=>{
  const full=calibrateDecisionEvidence(baseGraph(.5),mtf(4,4,4),{state:'unavailable'},{state:'unavailable'});
  const partial=calibrateDecisionEvidence(baseGraph(.5),mtf(2,2,2),{state:'unavailable'},{state:'unavailable'});
  assert.equal(full.qellyView.evidenceGate.timeframeAgreement,1);
  assert.equal(full.qellyView.evidenceGate.timeframeCoverage,1);
  assert.equal(full.qellyView.evidenceGate.timeframeEvidence,1);
  assert.equal(partial.qellyView.evidenceGate.timeframeAgreement,1);
  assert.equal(partial.qellyView.evidenceGate.timeframeCoverage,.5);
  assert.equal(partial.qellyView.evidenceGate.timeframeEvidence,.5);
  assert.ok(partial.qellyView.confidence<full.qellyView.confidence);
});

test('Wave BE source removes the previous second confidence multiplier',async()=>{
  const source=await read('functions/api/v1/decision-proven-graph.js');
  assert.doesNotMatch(source,/baseConfidence\*\(\.7\+\.3\*qualityScore\)/);
  assert.doesNotMatch(source,/preliminaryModelConfidence\*\(/);
  assert.match(source,/preliminaryModelConfidenceReused:false/);
  assert.match(source,/primitiveReuse:false/);
  assert.match(source,/confidence:evidenceConfidence/);
  assert.match(source,/qelly\.decision-evidence-confidence\/1\.0\.0/);
});

test('Wave BE QELLY Chat carries the authoritative confidence decomposition',()=>{
  const result=calibrateDecisionEvidence(baseGraph(.43),mtf(4,2,2),{state:'unavailable'},{state:'unavailable'});
  const receipt=compactDecisionToolReceipt({
    ...result,horizon:'4h',
    evidence:{news:{},liquidity:{},derivatives:{},macro:{},eventRisk:{},crossAsset:{}},
    providerResilience:{},contradictionAnalysis:{},tradeResearch:{status:'NO_TRADE',matrix:[],targets:[]},
    historicalAnalogs:{},pastPresentFuture:{},evidenceGraph:{nodes:[]}
  });
  assert.equal(receipt.data.confidence,result.qellyView.confidence);
  assert.equal(receipt.data.confidenceDecomposition.schemaVersion,'qelly.decision-evidence-confidence/1.0.0');
  assert.equal(receipt.data.confidenceDecomposition.preliminaryModelConfidenceReused,false);
  assert.equal(receipt.data.confidenceDecomposition.primitiveReuse,false);
  assert.match(receipt.data.confidenceMeaning,/Each primitive enters once/i);
});

test('Wave BE scanner uses calibration-gated evidence confidence and retains legacy JSON/query compatibility',()=>{
  const result=calibrateDecisionEvidence(
    baseGraph(.9,{state:'CALIBRATED',eligible:true,sampleSize:50,brierScore:.2,skillScore:.2,reliabilityGap:.05}),
    mtf(4,2,2),{state:'unavailable'},{state:'unavailable'}
  );
  const enriched={...result,asset:'BTC',interval:'15m',horizon:'4h',observedAt:'2026-09-25T09:30:00.000Z',
    tradeResearch:{status:'NO_TRADE',selected:null},eventRisk:{state:'unavailable'}};
  const candidate=__decisionScanTest.compactCandidate(enriched,{filters:__decisionScanTest.normalizeFilters(),now:Date.parse('2026-09-25T09:31:00.000Z')});
  assert.equal(candidate.evidence.calibrationGatedEvidenceConfidence,result.qellyView.confidence);
  assert.equal(candidate.evidence.calibratedConfidence,result.qellyView.confidence);
  assert.match(candidate.evidence.confidenceMeaning,/not a success probability/i);
  const source=__decisionScanTest.normalizeFilters({minCalibratedConfidence:.5});
  assert.equal(source.minCalibratedConfidence,.5);
});

test('Wave BE UI discloses weighted components, audit-only preliminary confidence and scanner semantics',async()=>{
  const route=await read('apps/web/public/assets/routes/decision-proven-graph.mjs');
  for(const phrase of [
    'Freshness','History depth','Scenario separation','MTF evidence',
    'Preliminary model confidence','AUDIT ONLY · NOT REUSED',
    'each enter once','not a success probability',
    'Min calibration-gated evidence','gated evidence conf'
  ])assert.ok(route.includes(phrase),phrase);
  assert.ok(route.includes('data-dpg-scan-filter="minCalibratedConfidence"'));
});

test('Wave BE Decision snapshot and Evidence Graph expose the no-reuse contract',async()=>{
  const context=await read('functions/_lib/decision-context.js');
  assert.match(context,/confidenceSchemaVersion/);
  assert.match(context,/confidencePrimitiveReuse/);
  assert.match(context,/preliminaryModelConfidenceReused/);
  assert.match(context,/Each primitive enters confidence once/);
  assert.match(context,/preliminary model confidence is not reused/i);
});
