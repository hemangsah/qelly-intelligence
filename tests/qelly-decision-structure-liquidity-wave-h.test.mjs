import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {normalizeDecisionLiquidity} from '../functions/_lib/decision-liquidity.js';
import {buildDecisionQuantRisk} from '../functions/_lib/decision-quant-risk.js';
import {calibrateDecisionEvidence} from '../functions/api/v1/decision-proven-graph.js';

function candles(count=160){
  const rows=[];
  let close=100;
  const start=1_790_000_000_000;
  for(let i=0;i<count;i++){
    const drift=i<70?.0012:i<120?-.00065:.00045;
    const cycle=Math.sin(i/6)*.0018;
    const open=close;
    close=Math.max(1,open*Math.exp(drift+cycle));
    const width=.0022+Math.abs(Math.sin(i/9))*.0014;
    rows.push({
      time:start+i*900_000,
      open,
      high:Math.max(open,close)*(1+width),
      low:Math.min(open,close)*(1-width*.9),
      close,
      volume:1000+(i%21)*37,
      trades:120+i%50
    });
  }
  return rows;
}

test('verified L2 snapshot derives bounded current spread and top-five imbalance',()=>{
  const payload={
    coin:'BTC',
    time:1_790_100_000_000,
    levels:[
      [
        {px:'100.00',sz:'4',n:2},
        {px:'99.95',sz:'3',n:1},
        {px:'99.90',sz:'2',n:1},
        {px:'99.85',sz:'2',n:1},
        {px:'99.80',sz:'1',n:1}
      ],
      [
        {px:'100.05',sz:'2',n:1},
        {px:'100.10',sz:'2',n:1},
        {px:'100.15',sz:'1',n:1},
        {px:'100.20',sz:'1',n:1},
        {px:'100.25',sz:'1',n:1}
      ]
    ]
  };
  const result=normalizeDecisionLiquidity(payload,{asset:'BTC'});
  assert.equal(result.state,'live');
  assert.equal(result.currentOnly,true);
  assert.equal(result.bestBid,100);
  assert.equal(result.bestAsk,100.05);
  assert.ok(result.spreadBps>0&&result.spreadBps<15);
  assert.equal(Number.isFinite(result.top5BidDepthUsd),true);
  assert.equal(Number.isFinite(result.top5AskDepthUsd),true);
  assert.equal(Number.isFinite(result.top5Imbalance),true);
  assert.ok(['BID_HEAVY','ASK_HEAVY','BALANCED'].includes(result.imbalanceState));
  assert.match(result.method,/L2 snapshot/i);
  assert.ok(result.unavailableMetrics.includes('CVD'));
});

test('missing or crossed book fails closed instead of inventing liquidity',()=>{
  const missing=normalizeDecisionLiquidity({levels:[[],[]]},{asset:'BTC'});
  assert.equal(missing.state,'unavailable');
  assert.equal(missing.spreadBps,null);
  assert.equal(missing.top5Imbalance,null);

  const crossed=normalizeDecisionLiquidity({levels:[[{px:'101',sz:'1'}],[{px:'100',sz:'1'}]]},{asset:'BTC'});
  assert.equal(crossed.state,'unavailable');
  assert.match(crossed.reason,/crossed|invalid/i);
});

test('market structure exposes confirmed swings, BOS/CHOCH and compression contract',()=>{
  const quant=buildDecisionQuantRisk(candles(),{intervalMs:900_000,horizonBars:16});
  assert.equal(quant.state,'DERIVED');
  const structure=quant.structure;
  assert.ok(['HH_HL','LH_LL','EXPANDING_RANGE','CONTRACTING_RANGE','MIXED'].includes(structure.state));
  assert.ok(['UPSIDE','DOWNSIDE','NONE'].includes(structure.breakOfStructure));
  assert.ok(['UPSIDE','DOWNSIDE','NONE'].includes(structure.changeOfCharacter));
  assert.ok(['UPSIDE_FAILED','DOWNSIDE_FAILED','NONE'].includes(structure.failedBreakout));
  assert.ok(['BREAKOUT','FAILED_BREAKOUT','CONSOLIDATION','TREND_CONTINUATION','RANGE'].includes(structure.phase));
  assert.ok(['COMPRESSION','EXPANSION','NORMAL','UNAVAILABLE'].includes(structure.compressionState));
  assert.ok(Array.isArray(structure.swings.highs));
  assert.ok(Array.isArray(structure.swings.lows));
  assert.ok(structure.swings.highs.length<=4);
  assert.ok(structure.swings.lows.length<=4);
});

const directionalGraph=()=>({
  truthState:'LIVE',
  market:{points:500},
  metrics:{atrPct:.7},
  quant:{
    state:'DERIVED',
    volatility:{regime:'NORMAL',expectedMovePct:2},
    structure:{state:'HH_HL',support:97,resistance:106,breakOfStructure:'NONE'},
    calibration:{state:'CALIBRATED',eligible:true,sampleSize:80,brierScore:.2,skillScore:.2,reliabilityGap:.05,reliabilityBins:[]}
  },
  forecast:{probabilities:{bull:.67,base:.16,bear:.17}},
  confidence:{score:.82,calibration:'base'},
  qellyView:{
    action:'BUY',
    confidence:.82,
    levels:{entryZone:[99,101],invalidation:97,targets:[102,104,106],riskReward:[1,2,3]},
    why:['Base directional evidence.'],
    label:'Research signal only.',
    changesIf:'Structure or evidence invalidates.'
  },
  graph:{nodes:[{id:'decision',label:'QELLY VIEW BUY'}],edges:[]}
});

test('verified wide spread suppresses an otherwise eligible directional view',()=>{
  const liquidity={state:'live',spreadBps:18,spreadState:'WIDE',top5Imbalance:.05,imbalanceState:'BALANCED'};
  const result=calibrateDecisionEvidence(
    directionalGraph(),
    {state:'live',agreement:{direction:'BUY',aligned:4,directional:4,total:4}},
    {state:'live'},
    liquidity
  );
  assert.equal(result.qellyView.action,'NO TRADE');
  assert.equal(result.qellyView.evidenceGate.liquidityCoverage,'live');
  assert.equal(result.qellyView.evidenceGate.liquiditySpreadBps,18);
  assert.match(result.qellyView.contradictions.join(' '),/spread/i);
});

test('severe adverse L2 imbalance is risk gating, not a fabricated signal',()=>{
  const liquidity={state:'live',spreadBps:2,spreadState:'TIGHT',top5Imbalance:-.72,imbalanceState:'ASK_HEAVY'};
  const result=calibrateDecisionEvidence(
    directionalGraph(),
    {state:'live',agreement:{direction:'BUY',aligned:4,directional:4,total:4}},
    {state:'live'},
    liquidity
  );
  assert.equal(result.qellyView.action,'NO TRADE');
  assert.match(result.qellyView.contradictions.join(' '),/imbalanced/i);
  assert.match(result.qellyView.why.join(' '),/risk context, not a directional signal/i);
});

test('Decision UI exposes structure, L2 and explicit event-risk boundaries responsively',async()=>{
  const route=await readFile(new URL('../apps/web/public/assets/routes/decision-proven-graph.mjs',import.meta.url),'utf8');
  const css=await readFile(new URL('../apps/web/public/assets/qelly-decision-proven-graph.css',import.meta.url),'utf8');
  for(const phrase of [
    'MARKET STRUCTURE · OBSERVED',
    'Break of structure',
    'Change of character',
    'LIQUIDITY / L2 · CURRENT',
    'Top-5 bid depth',
    'Book imbalance',
    'EVENT RISK',
    'scheduled-event feed',
    'CVD'
  ])assert.match(route,new RegExp(phrase));
  assert.match(route,/marketStructureContext\(data,escapeHtml\)/);
  assert.match(route,/liquidityContext\(data,escapeHtml\)/);
  assert.match(route,/eventRiskContext\(data,escapeHtml\)/);
  assert.match(css,/\.q-dpg-structure/);
  assert.match(css,/\.q-dpg-liquidity/);
  assert.match(css,/@media\(max-width:480px\).*q-dpg-structure__grid/s);
});

test('Decision endpoint requests official Hyperliquid l2Book and keeps event calendar explicit',async()=>{
  const endpoint=await readFile(new URL('../functions/api/v1/decision-proven-graph.js',import.meta.url),'utf8');
  assert.match(endpoint,/type:'l2Book',coin:asset/);
  assert.match(endpoint,/scheduledFeedConnected:false/);
  assert.match(endpoint,/Recent news is evidence only and is not converted into a scheduled event-risk score/);
  assert.match(endpoint,/liquidityCoverage/);
});
