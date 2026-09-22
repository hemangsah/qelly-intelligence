import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {buildTradeResearch} from '../functions/_lib/decision-trade-research.js';

const graphFor=(overrides={})=>({
  generatedAt:'2026-09-23T00:00:00.000Z',
  observedAt:'2026-09-23T00:00:00.000Z',
  horizonBars:16,
  truthState:'LIVE',
  freshness:{intervalMs:900_000},
  market:{lastPrice:100},
  metrics:{atrPct:2},
  forecast:{fan:[{p05:88,p25:94,p50:100,p75:108,p95:116}]},
  quant:{
    regime:'TRENDING',
    volatility:{regime:'NORMAL',expectedMovePct:6},
    structure:{state:'HH_HL',support:96,resistance:106,breakout:'NONE'},
    calibration:{state:'CALIBRATED',eligible:true,sampleSize:80,brierScore:.24,reliabilityBins:[]}
  },
  qellyView:{
    action:'BUY',
    confidence:.8,
    evidenceGate:{qualityScore:.82,calibrationState:'CALIBRATED',calibrationEligible:true},
    levels:{entryZone:[99,101],invalidation:96},
    contradictions:[],
    changesIf:'Multi-timeframe direction flips or price breaks structural support.'
  },
  ...overrides
});

test('Auto R:R can select a validated structural ratio instead of forcing a preset target',()=>{
  const result=buildTradeResearch(graphFor(),{requestedRr:'auto'});
  assert.equal(result.status,'VALID');
  assert.equal(result.selected.source,'STRUCTURE');
  assert.equal(result.selected.ratio,1.5);
  assert.equal(result.selected.target,106);
  assert.equal(result.selected.label,'1:1.5 structural');
  assert.equal(result.selected.netRatio,null);
  assert.equal(result.selected.costState,'UNAVAILABLE');
  assert.ok(result.matrix.find(item=>item.label==='1:2'));
  assert.ok(['LOW','NOT FEASIBLE'].includes(result.matrix.find(item=>item.label==='1:2').feasibility));
});

test('trade setup exposes current lifecycle and all invalidation classes without invented history',()=>{
  const result=buildTradeResearch(graphFor(),{requestedRr:'1'});
  assert.equal(result.status,'VALID');
  assert.equal(result.lifecycle.state,'TRIGGERED');
  assert.deepEqual(result.lifecycle.history,[]);
  assert.match(result.lifecycle.note,/does not manufacture backfilled transitions/i);
  assert.equal(result.invalidations.price.state,'AVAILABLE');
  assert.equal(result.invalidations.structural.state,'AVAILABLE');
  assert.equal(result.invalidations.evidence.state,'AVAILABLE');
  assert.equal(result.invalidations.time.state,'AVAILABLE');
  assert.equal(result.invalidations.event.state,'UNAVAILABLE');
  assert.match(result.invalidations.event.reason,/not inferred/i);
  assert.equal(result.invalidations.regime.state,'AVAILABLE');
  assert.match(result.entry.trigger,/inside the validated entry zone/i);
  assert.match(result.stop.why,/validated invalidation level/i);
});

test('expired setup fails closed even when the requested target was otherwise feasible',()=>{
  const result=buildTradeResearch(graphFor(),{
    requestedRr:'1',
    now:Date.parse('2026-09-24T00:00:00.000Z')
  });
  assert.equal(result.status,'NO_TRADE');
  assert.equal(result.lifecycle.state,'EXPIRED');
  assert.match(result.reason,/expired/i);
});

test('breakout structure produces a retest entry plan instead of chasing price',()=>{
  const graph=graphFor({
    market:{lastPrice:108},
    quant:{
      regime:'TRENDING',
      volatility:{regime:'NORMAL',expectedMovePct:8},
      structure:{state:'HH_HL',support:96,resistance:106,breakout:'UPSIDE'},
      calibration:{state:'CALIBRATED',eligible:true,sampleSize:80,brierScore:.24,reliabilityBins:[]}
    }
  });
  const result=buildTradeResearch(graph,{requestedRr:'1'});
  assert.equal(result.entry.method,'RETEST');
  assert.match(result.entry.trigger,/retest/i);
});

test('Decision UI renders lifecycle, supported target ladder, invalidation map and explicit cost boundary',async()=>{
  const route=await readFile(new URL('../apps/web/public/assets/routes/decision-proven-graph.mjs',import.meta.url),'utf8');
  const css=await readFile(new URL('../apps/web/public/assets/qelly-decision-proven-graph.css',import.meta.url),'utf8');
  for(const phrase of ['Lifecycle','STRUCTURALLY SUPPORTED TARGETS','INVALIDATION MAP','Presets are tests, not forced targets','Net R:R:'])assert.match(route,new RegExp(phrase));
  assert.match(css,/\.q-dpg-target-ladder\{/);
  assert.match(css,/\.q-dpg-invalidation-grid\{/);
  assert.match(css,/@media\(max-width:520px\).*q-dpg-target-ladder/s);
});
