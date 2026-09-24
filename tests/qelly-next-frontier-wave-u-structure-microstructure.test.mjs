import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {buildDecisionQuantRisk,__decisionQuantRiskTest} from '../functions/_lib/decision-quant-risk.js';
import {normalizeDecisionLiquidity} from '../functions/_lib/decision-liquidity.js';
import {calibrateDecisionEvidence} from '../functions/api/v1/decision-proven-graph.js';
import {__decisionContextTest} from '../functions/_lib/decision-context.js';

const read=(path)=>readFile(new URL(`../${path}`,import.meta.url),'utf8');

const candles=Array.from({length:90},(_,i)=>{
  const center=100+i*.12+Math.sin(i*Math.PI/2)*1.8;
  const open=center-.18,close=center+.18;
  return {time:Date.parse('2026-09-01T00:00:00.000Z')+i*900000,open,high:Math.max(open,close)+.45,low:Math.min(open,close)-.45,close,volume:100+i};
});

test('Wave U structure exposes bounded pivots, bias, strength, retest/rejection and distance context without NaN',()=>{
  const result=buildDecisionQuantRisk(candles,{intervalMs:900000,horizonBars:16});
  const structure=result.structure;
  assert.notEqual(structure.state,'UNAVAILABLE');
  assert.ok(['UPSIDE','DOWNSIDE','MIXED'].includes(structure.bias));
  assert.ok(['STRONG','MODERATE','DEVELOPING','WEAK'].includes(structure.strengthState));
  assert.ok(Number.isFinite(structure.strengthScore));
  assert.ok(['NONE','UPSIDE_HOLD','DOWNSIDE_HOLD','UPSIDE_FAILED','DOWNSIDE_FAILED'].includes(structure.retestState));
  assert.equal(typeof structure.continuationState,'string');
  assert.equal(typeof structure.rejectionState,'string');
  assert.equal(typeof structure.exhaustionState,'string');
  assert.ok(Number.isFinite(structure.distanceToSupportPct));
  assert.ok(Number.isFinite(structure.distanceToResistancePct));
  assert.ok(Number.isFinite(structure.rangePosition));
  assert.ok(structure.rangePosition>=0&&structure.rangePosition<=1);
  assert.match(structure.methodology,/descriptive heuristic/i);
  assert.ok(Array.isArray(structure.swings.highs));
  assert.ok(Array.isArray(structure.swings.lows));
  assert.equal(JSON.stringify(structure).includes('NaN'),false);
  assert.equal(JSON.stringify(structure).includes('Infinity'),false);
});

test('Wave U L2 computes top-1/top-5/top-10 depth, microprice and multi-depth consensus from one verified snapshot',()=>{
  const bids=Array.from({length:10},(_,i)=>({px:String(100-i*.1),sz:String(10-i*.2),n:2+i}));
  const asks=Array.from({length:10},(_,i)=>({px:String(100.1+i*.1),sz:String(1+i*.05),n:1+i}));
  const result=normalizeDecisionLiquidity({time:Date.parse('2026-09-24T09:00:00.000Z'),levels:[bids,asks]},{asset:'BTC'});
  assert.equal(result.state,'live');
  assert.equal(result.spreadState,'NORMAL');
  assert.equal(result.depthConsensus,'BID_HEAVY_CONSENSUS');
  assert.ok(result.top1Imbalance>.7);
  assert.ok(result.top5Imbalance>.7);
  assert.ok(result.top10Imbalance>.7);
  assert.ok(result.microprice>result.mid);
  assert.ok(result.micropriceBiasBps>0);
  assert.ok(result.top10BidDepthUsd>result.top5BidDepthUsd);
  assert.ok(result.top10AskDepthUsd>result.top5AskDepthUsd);
  assert.ok(result.depthConcentrationTop1>0&&result.depthConcentrationTop1<1);
  for(const unavailable of ['trade imbalance','aggressive buy/sell volume','volume delta','CVD','historical book depth','liquidation flow'])assert.ok(result.unavailableMetrics.includes(unavailable));
  assert.match(result.limitations.join(' '),/not evidence of institutional intent/i);
});

const evidenceGraph=({structure,calibration={state:'CALIBRATED',eligible:true},action='BUY'}={})=>({
  truthState:'LIVE',
  market:{points:300},
  metrics:{atrPct:1},
  forecast:{probabilities:{bull:.65,base:.15,bear:.2}},
  qellyView:{action,confidence:.8,why:['Base evidence'],levels:{entryZone:[99,101],invalidation:95,targets:[105]},label:'Directional research state',changesIf:'Evidence changes.'},
  quant:{state:'DERIVED',volatility:{regime:'NORMAL',expectedMovePct:1.2},structure,calibration},
  graph:{nodes:[],edges:[]},
  confidence:{score:.8}
});
const mtf={agreement:{direction:'BUY',aligned:4,directional:4,total:4}};
const balancedLiquidity={state:'live',spreadBps:2,spreadState:'TIGHT',top5Imbalance:0,top10Imbalance:0,imbalanceState:'BALANCED',depthConsensus:'BALANCED',micropriceBiasBps:0};

test('strong observed structure conflict materially suppresses an otherwise eligible directional view',()=>{
  const graph=evidenceGraph({structure:{bias:'DOWNSIDE',strengthState:'STRONG',retestState:'NONE'}});
  const result=calibrateDecisionEvidence(graph,mtf,{state:'unavailable'},balancedLiquidity,null);
  assert.equal(result.qellyView.action,'NO TRADE');
  assert.ok(result.qellyView.contradictions.some(item=>/market structure conflicts/i.test(item)));
  assert.equal(result.qellyView.evidenceGate.structureBias,'DOWNSIDE');
  assert.equal(result.qellyView.evidenceGate.structureStrength,'STRONG');
});

test('severe L2 veto requires both top-five and top-ten confirmation, not one depth slice alone',()=>{
  const aligned=evidenceGraph({structure:{bias:'UPSIDE',strengthState:'STRONG',retestState:'UPSIDE_HOLD'}});
  const oneSlice=calibrateDecisionEvidence(aligned,mtf,{state:'unavailable'},{...balancedLiquidity,top5Imbalance:-.75,top10Imbalance:-.2,imbalanceState:'ASK_HEAVY',depthConsensus:'MIXED'},null);
  assert.equal(oneSlice.qellyView.action,'BUY');
  const confirmed=calibrateDecisionEvidence(aligned,mtf,{state:'unavailable'},{...balancedLiquidity,top5Imbalance:-.75,top10Imbalance:-.65,imbalanceState:'ASK_HEAVY',depthConsensus:'ASK_HEAVY_CONSENSUS'},null);
  assert.equal(confirmed.qellyView.action,'NO TRADE');
  assert.ok(confirmed.qellyView.contradictions.some(item=>/top-five and top-ten/i.test(item)));
  assert.equal(confirmed.qellyView.evidenceGate.liquidityTop10Imbalance,-.65);
});

test('Wave U keeps one L2 provider request and does not add recent-trades fan-out',async()=>{
  const api=await read('functions/api/v1/decision-proven-graph.js');
  assert.equal((api.match(/type:'l2Book'/g)||[]).length,1);
  assert.equal((api.match(/recentTrades/g)||[]).length,0);
  assert.match(api,/top10Imbalance/);
  assert.match(api,/micropriceBiasBps/);
  assert.match(api,/structureStrength/);
});

test('Wave U reuses authoritative Decision panels and discloses unavailable flow truthfully',async()=>{
  const route=await read('apps/web/public/assets/routes/decision-proven-graph.mjs');
  assert.equal((route.match(/const marketStructureContext=/g)||[]).length,1);
  assert.equal((route.match(/const liquidityContext=/g)||[]).length,1);
  for(const phrase of ['MARKET STRUCTURE 2.0','Structural strength','LIQUIDITY / MICROSTRUCTURE','Top-10 imbalance','Microprice','NOT INFERRED','not evidence of whales, institutions or smart money'])assert.ok(route.includes(phrase),phrase);
});

test('structure helper keeps unavailable state explicit on insufficient observations',()=>{
  const value=__decisionQuantRiskTest.structure(candles.slice(0,10));
  assert.equal(value.state,'UNAVAILABLE');
  assert.equal(value.strengthState,'UNAVAILABLE');
  assert.equal(value.distanceToSupportPct,null);
  assert.equal(value.retestState,'NONE');
});


test('Wave U preserves unavailable numerics as null instead of false zero in Decision snapshots',()=>{
  const snap=__decisionContextTest.snapshot({
    graphId:'g',observedAt:'2026-09-24T09:00:00.000Z',asset:'BTC',interval:'15m',
    qellyView:{action:'WAIT',confidence:null,evidenceGate:{}},quant:{},market:{currentState:{}}
  },{multiTimeframe:null,tradeResearch:{status:'NO_TRADE',stop:{price:null}}});
  assert.equal(snap.confidence,null);
  assert.equal(snap.invalidationPrice,null);
});
