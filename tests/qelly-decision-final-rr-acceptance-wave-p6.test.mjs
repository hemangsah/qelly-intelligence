import test from 'node:test';
import assert from 'node:assert/strict';
import {buildTradeResearch} from '../functions/_lib/decision-trade-research.js';

const directionalGraph=()=>({
  graphId:'dpg-btc-15m-final-rr-acceptance',
  generatedAt:'2026-09-23T20:00:00.000Z',
  observedAt:'2026-09-23T20:00:00.000Z',
  truthState:'LIVE',
  horizonBars:16,
  freshness:{intervalMs:900_000},
  market:{lastPrice:100,currentState:{regime:'TRENDING'}},
  metrics:{atrPct:1.2},
  forecast:{fan:[{p05:70,p25:85,p50:105,p75:130,p95:150}]},
  quant:{
    regime:'TRENDING',
    volatility:{regime:'NORMAL',expectedMovePct:50},
    structure:{state:'HH_HL',support:92,resistance:140,breakout:'NONE'},
    calibration:{state:'CALIBRATED',eligible:true,sampleSize:120,brierScore:.18,reliabilityGap:.04,reliabilityBins:[]}
  },
  qellyView:{
    action:'BUY',
    confidence:.84,
    evidenceGate:{qualityScore:.9,calibrationEligible:true},
    levels:{entryZone:[99,101],invalidation:95},
    contradictions:[],
    changesIf:'Structure fails or evidence alignment deteriorates.'
  }
});

for(const ratio of [1,2,3,4]){
  test(`final acceptance: preset 1:${ratio} selects the requested feasible R:R`,()=>{
    const result=buildTradeResearch(directionalGraph(),{requestedRr:`1:${ratio}`});
    assert.equal(result.requestedRr,`1:${ratio}`);
    assert.equal(result.customRr,null);
    assert.equal(result.status,'VALID');
    assert.equal(result.selected.ratio,ratio);
    assert.equal(result.selected.label,`1:${ratio}`);
    assert.ok(['HIGH','MEDIUM'].includes(result.selected.feasibility));
    assert.ok(result.targets.some(item=>item.ratio===ratio));
    assert.equal(result.execution,false);
    assert.equal(result.researchOnly,true);
  });
}

test('final acceptance: Auto selects the highest evidence-feasible target without inventing probability',()=>{
  const result=buildTradeResearch(directionalGraph(),{requestedRr:'auto'});
  assert.equal(result.requestedRr,'auto');
  assert.equal(result.status,'VALID');
  assert.ok(result.selected);
  assert.ok(['HIGH','MEDIUM'].includes(result.selected.feasibility));
  assert.equal(result.selected.targetTouchProbability,null);
  assert.equal(result.selected.expectedValue,null);
});

test('final acceptance: valid Custom R:R is represented and selected exactly',()=>{
  const result=buildTradeResearch(directionalGraph(),{requestedRr:'custom',customRr:2.5});
  assert.equal(result.requestedRr,'custom');
  assert.equal(result.customRr,2.5);
  assert.equal(result.status,'VALID');
  assert.equal(result.selected.ratio,2.5);
  assert.equal(result.selected.label,'1:2.5');
  assert.ok(result.matrix.some(item=>item.ratio===2.5));
});

test('final acceptance: invalid Custom R:R fails closed instead of silently substituting a preset',()=>{
  const result=buildTradeResearch(directionalGraph(),{requestedRr:'custom',customRr:99});
  assert.equal(result.requestedRr,'custom');
  assert.equal(result.customRr,null);
  assert.equal(result.selected,null);
  assert.equal(result.status,'NO_TRADE');
  assert.match(result.reason,/cannot be validated/i);
});

test('final acceptance: infeasible preset remains NO_TRADE even with a directional evidence gate',()=>{
  const graph=directionalGraph();
  graph.forecast={fan:[{p05:92,p25:96,p50:100,p75:105,p95:108}]};
  graph.quant.structure={state:'HH_HL',support:92,resistance:106,breakout:'NONE'};
  graph.quant.volatility.expectedMovePct=8;
  const result=buildTradeResearch(graph,{requestedRr:'1:4'});
  assert.equal(result.requestedRr,'1:4');
  assert.equal(result.selected.ratio,4);
  assert.ok(['LOW','NOT FEASIBLE'].includes(result.selected.feasibility));
  assert.equal(result.status,'NO_TRADE');
});
