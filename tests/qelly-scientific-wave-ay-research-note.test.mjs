import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {buildDecisionResearchNote,decisionResearchNoteMarkdown,researchNoteFilename} from '../apps/web/public/assets/decision-research-note.mjs';

const read=(path)=>readFile(new URL('../'+path,import.meta.url),'utf8');
const fixture=()=>({
  graphId:'g1',asset:'BTC',interval:'15m',horizon:'4h',observedAt:'2026-09-25T20:00:00Z',truthState:'LIVE',
  provenance:{provider:'Hyperliquid',documentation:'https://example.test/docs',model:{limitations:['One venue observed.']}},
  qellyView:{action:'NO TRADE',label:'Evidence withheld.',confidence:.62,evidenceGate:{qualityScore:.7,directionalEligible:false},why:['Trend mixed'],contradictions:['Calibration gate not passed'],changesIf:'Fresh evidence aligns.'},
  contradictionAnalysis:{state:'CONFLICT',score:.25,support:['Trend mixed'],contradictions:['Calibration gate not passed'],strongestSupport:'Trend mixed',strongestContradiction:'Calibration gate not passed'},
  tradeResearch:{status:'NO_TRADE',reason:'Requested R:R not validated',entry:null,stop:null,invalidation:null,expiryAt:null,targets:[],matrix:[{label:'1:2',ratio:2,target:105,feasibility:'NOT_FEASIBLE',feasibilityReason:'barrier',grossRiskReward:2,netRiskReward:null,costState:'UNAVAILABLE'}],selected:null},
  quant:{calibration:{state:'UNCALIBRATED',eligible:false,sampleSize:25,minimumSampleGate:36,brierScore:.3508,skillScore:-.0525,reliabilityGap:.1872,diagnosticMetricsOnly:true,reason:'Below sample gate.'}},
  forecast:{probabilities:{bull:.3,base:.4,bear:.3},terminal:{p05:90,p50:100,p95:110}},
  evidence:{eventRisk:{state:'unavailable',level:'UNAVAILABLE',reason:'No feed.'},liquidations:{state:'unavailable',message:'No liquidation feed.'},options:{state:'unavailable',message:'No options feed.'},onChain:{state:'unavailable',message:'No on-chain feed.'}},
  evidenceGraph:{nodes:[{label:'Raw provider observation',source:'Hyperliquid',freshness:'LIVE',directness:'DIRECT',reliability:'VENUE_OBSERVED'}]}
});

test('AY note includes every required research section without inventing a setup',()=>{
  const note=buildDecisionResearchNote(fixture(),{requestedRr:'2'});
  assert.equal(note.schemaVersion,'qelly.decision-research-note/1.0.0');
  assert.equal(note.snapshot.asset,'BTC');
  assert.equal(note.snapshot.timeframe,'15m');
  assert.equal(note.qellyView.action,'NO TRADE');
  assert.ok(note.thesis);
  assert.equal(note.evidence.strongestContradiction,'Calibration gate not passed');
  assert.equal(note.setup.entry,null);
  assert.equal(note.setup.targets.length,0);
  assert.equal(note.riskReward.requested,'2');
  assert.equal(note.calibration.state,'UNCALIBRATED');
  assert.equal(note.calibration.targetTouch.state,'UNAVAILABLE');
  assert.equal(note.scenarios.base,.4);
  assert.equal(note.eventRisk.state,'unavailable');
  assert.equal(note.sources.inventory[0].source,'Hyperliquid');
  assert.ok(note.limitations.some(item=>/Research-only output/i.test(item)));
});

test('AY note does not promote diagnostics into target probability or net R:R',()=>{
  const note=buildDecisionResearchNote(fixture(),{requestedRr:'2'});
  assert.equal(note.calibration.eligible,false);
  assert.equal(note.calibration.diagnosticMetricsOnly,true);
  assert.equal(note.riskReward.selected,null);
  assert.equal(note.riskReward.matrix[0].grossRr,2);
  assert.equal(note.riskReward.matrix[0].netRr,null);
  assert.equal('targetTouchProbability' in note.calibration,false);
  assert.match(note.calibration.targetTouch.boundary,/not inferred from scenarios, analogs or candle depth/i);
});

test('AY markdown is a durable research-only artifact with required headings',()=>{
  const note=buildDecisionResearchNote(fixture(),{requestedRr:'2'});
  const markdown=decisionResearchNoteMarkdown(note);
  for(const heading of ['## Thesis','## QELLY VIEW','## Evidence','## Entry / Invalidation / Targets','## Risk / Reward','## Calibration','## Scenarios','## Event Risk','## Sources','## Limitations'])assert.ok(markdown.includes(heading),heading);
  assert.match(markdown,/Not investment advice, a trade instruction, execution authorization, or a guaranteed outcome/i);
  assert.equal(researchNoteFilename(note),'qelly-decision-research-note-btc-15m.md');
});

test('AY formatter remains local and provider-neutral',async()=>{
  const source=await read('apps/web/public/assets/decision-research-note.mjs');
  assert.doesNotMatch(source,/\bfetch\s*\(/);
  assert.doesNotMatch(source,/localStorage|sessionStorage|document\.cookie/);
  assert.doesNotMatch(source,/Authorization|service_role|SUPABASE_SERVICE_ROLE_KEY/);
});

test('AY Decision route exposes one canonical research-note action',async()=>{
  const route=await read('apps/web/public/assets/routes/decision-proven-graph.mjs');
  assert.match(route,/from '\.\.\/decision-research-note\.mjs'/);
  assert.match(route,/data-dpg-research-note/);
  assert.match(route,/buildDecisionResearchNote\(state\.data/);
  assert.match(route,/downloadDecisionResearchNote\(note\)/);
  assert.doesNotMatch(route,/fetch\(.*research-note/);
});
