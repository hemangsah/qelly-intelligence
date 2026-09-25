import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {buildDecisionDataQuality,applyDecisionDataQualityEligibility,buildDecisionModelHealth} from '../functions/_lib/decision-health-quality.js';
import {compactDecisionToolReceipt} from '../functions/_lib/qelly-chat-tools.js';

const read=(path)=>readFile(new URL('../'+path,import.meta.url),'utf8');

const graph=(overrides={})=>({
  observedAt:'2026-09-25T11:20:00.000Z',
  generatedAt:'2026-09-25T11:20:01.000Z',
  truthState:'LIVE',
  freshness:{state:'LIVE',ageMs:1_000},
  market:{points:240,lastPrice:100},
  quant:{
    state:'DERIVED',regime:'TRANSITION',
    calibration:{state:'UNCALIBRATED',eligible:false,sampleSize:23,minimumSampleGate:36,brierScore:.31,reliabilityGap:.17}
  },
  forecast:{probabilities:{bull:.42,base:.28,bear:.30}},
  qellyView:{action:'WAIT',confidence:.58,label:'No directional edge.',changesIf:'Fresh evidence aligns.',contradictions:[]},
  ...overrides
});

const mtf=(total=4)=>({
  state:total>=3?'live':'partial',
  agreement:{total,aligned:2,directional:2,direction:'MIXED'},
  views:Array.from({length:total},(_,i)=>({interval:['15m','1h','4h','1d'][i]||String(i)}))
});

const evidence=(overrides={})=>({
  liquidity:{state:'live'},derivatives:{state:'live'},news:{state:'no-matches'},
  crossAsset:{state:'available'},macro:{state:'available'},eventRisk:{state:'unavailable'},
  liquidations:{state:'unavailable'},options:{state:'unavailable'},onChain:{state:'unavailable'},
  ...overrides
});

const resilience=(overrides={})=>({
  observed:{
    liquidity:{state:'live'},derivatives:{state:'live'},news:{state:'no-matches'},macro:{state:'available'},
    ...overrides
  }
});

test('Waves BC/BD data quality separates critical readiness from optional contextual missingness',()=>{
  const quality=buildDecisionDataQuality({graph:graph(),multiTimeframe:mtf(),evidence:evidence(),providerResilience:resilience()});
  assert.equal(quality.eligibility.criticalReady,true);
  assert.equal(quality.eligibility.impact,'NO_ADDITIONAL_BLOCK');
  assert.ok(quality.score>=.7);
  assert.ok(quality.missingness.unavailableCapabilities.includes('eventRisk'));
  assert.ok(quality.missingness.unavailableCapabilities.includes('options'));
  assert.match(quality.missingness.scoringBoundary,/not double-counted/i);
  assert.match(quality.boundary,/separate from evidence confidence/i);
  assert.equal(quality.conflict.state,'NOT_SCORED_FROM_DIRECTIONAL_DISAGREEMENT');
});

test('Waves BC/BD optional provider absence lowers current provider health but does not invent a directional block',()=>{
  const quality=buildDecisionDataQuality({
    graph:graph(),multiTimeframe:mtf(),
    evidence:evidence({liquidity:{state:'unavailable'},news:{state:'unavailable'},macro:{state:'unavailable'}}),
    providerResilience:resilience({liquidity:{state:'unavailable'},news:{state:'unavailable'},macro:{state:'unavailable'}})
  });
  assert.equal(quality.eligibility.criticalReady,true);
  assert.equal(quality.eligibility.impact,'NO_ADDITIONAL_BLOCK');
  assert.ok(quality.components.providerHealth.score<1);
  assert.match(quality.eligibility.boundary,/optional contextual-provider absence does not create direction/i);
});

test('Waves BC/BD critical stale input fails closed before trade research',()=>{
  const stale=graph({
    truthState:'STALE',
    freshness:{state:'STALE',ageMs:9_000_000},
    qellyView:{action:'BUY',confidence:.8,label:'Directional view.',changesIf:'',contradictions:[]}
  });
  const quality=buildDecisionDataQuality({graph:stale,multiTimeframe:mtf(),evidence:evidence(),providerResilience:resilience()});
  assert.equal(quality.eligibility.criticalReady,false);
  assert.equal(quality.eligibility.impact,'FAIL_CLOSED');
  const gated=applyDecisionDataQualityEligibility(stale,quality);
  assert.equal(gated.qellyView.action,'NO TRADE');
  assert.equal(gated.qellyView.levels,null);
  assert.match(gated.qellyView.contradictions.join(' '),/critical data-quality checks/i);
});

test('Wave BC model drift remains UNMEASURED without a longitudinal baseline',()=>{
  const quality=buildDecisionDataQuality({graph:graph(),multiTimeframe:mtf(),evidence:evidence(),providerResilience:resilience()});
  const health=buildDecisionModelHealth({graph:graph(),dataQuality:quality,providerResilience:resilience()});
  assert.equal(health.driftReadiness.state,'BASELINE_UNAVAILABLE');
  assert.equal(health.driftReadiness.persistentDecisionTelemetryConnected,false);
  for(const item of Object.values(health.drift)){
    assert.equal(item.state,'UNMEASURED');
    assert.equal(item.value,null);
    assert.equal(item.baseline,null);
  }
  assert.match(health.driftReadiness.boundary,/single current snapshot cannot establish drift/i);
  assert.match(health.boundary,/never invents drift/i);
});

test('Wave BD consistency checks are about data integrity, not directional agreement',()=>{
  const mixed=buildDecisionDataQuality({graph:graph(),multiTimeframe:mtf(),evidence:evidence(),providerResilience:resilience()});
  assert.equal(mixed.components.consistency.checks.scenarioProbabilityMass,1);
  assert.equal(mixed.components.consistency.checks.timeframeIdentity,1);
  assert.equal(mixed.conflict.count,0);
  assert.match(mixed.conflict.boundary,/directional disagreement are evidence semantics, not data-integrity conflicts/i);
});

test('Waves BC/BD API builds health before trade research and keeps response objects explicit',async()=>{
  const source=await read('functions/api/v1/decision-proven-graph.js');
  const qualityIndex=source.indexOf('const dataQuality=buildDecisionDataQuality');
  const gateIndex=source.indexOf('graph=applyDecisionDataQualityEligibility');
  const healthIndex=source.indexOf('const modelHealth=buildDecisionModelHealth');
  const tradeIndex=source.indexOf("const tradeResearch=latency.measure('riskRewardResearch'");
  assert.ok(qualityIndex>0&&gateIndex>qualityIndex&&healthIndex>gateIndex&&tradeIndex>healthIndex);
  assert.match(source,/return \{\.\.\.graph,horizon:resolvedHorizon,multiTimeframe,tradeResearch,evidence,providerResilience,dataQuality,modelHealth/);
});

test('Waves BC/BD Evidence Graph exposes governance nodes without adding a second direction engine',async()=>{
  const context=await read('functions/_lib/decision-context.js');
  assert.match(context,/sourceNode\('data-quality'/);
  assert.match(context,/sourceNode\('model-health'/);
  assert.match(context,/qualifies input integrity/);
  assert.match(context,/fails closed on critical checks/);
  assert.match(context,/reports governance state/);
});

test('Waves BC/BD QELLY Chat carries authoritative health objects',()=>{
  const quality=buildDecisionDataQuality({graph:graph(),multiTimeframe:mtf(),evidence:evidence(),providerResilience:resilience()});
  const health=buildDecisionModelHealth({graph:graph(),dataQuality:quality,providerResilience:resilience()});
  const result={
    ...graph(),asset:'BTC',interval:'15m',horizon:'4h',
    dataQuality:quality,modelHealth:health,providerResilience:resilience(),
    confidence:{calibration:'Evidence confidence, not probability.',decomposition:{}},
    evidence:evidence(),tradeResearch:{status:'NO_TRADE',matrix:[],targets:[]},
    historicalAnalogs:{},contradictionAnalysis:{},pastPresentFuture:{},evidenceGraph:{nodes:[]},
    multiTimeframe:mtf()
  };
  const receipt=compactDecisionToolReceipt(result);
  assert.equal(receipt.data.dataQuality.schemaVersion,'qelly.decision-data-quality/1.0.0');
  assert.equal(receipt.data.modelHealth.schemaVersion,'qelly.decision-model-health/1.0.0');
  assert.equal(receipt.data.modelHealth.drift.calibration.state,'UNMEASURED');
});

test('Waves BC/BD UI keeps health in secondary expandable research detail',async()=>{
  const [route,css]=await Promise.all([
    read('apps/web/public/assets/routes/decision-proven-graph.mjs'),
    read('apps/web/public/assets/qelly-decision-proven-graph.css')
  ]);
  for(const phrase of [
    'Model / data health',
    'DATA QUALITY · NOT DIRECTION',
    'MODEL HEALTH · DRIFT READINESS',
    'Longitudinal drift',
    'Missing contextual capabilities'
  ])assert.ok(route.includes(phrase),phrase);
  assert.match(route,/<details class="q-dpg-health-quality">/);
  assert.match(css,/\.q-dpg-health-quality__grid/);
  assert.match(css,/@media\(max-width:720px\).*q-dpg-health-quality__grid\{grid-template-columns:1fr\}/s);
});
