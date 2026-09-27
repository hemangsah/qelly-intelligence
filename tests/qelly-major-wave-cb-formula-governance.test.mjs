import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {buildDecisionFormulaGovernance,FORMULA_CATALOG} from '../functions/_lib/decision-formula-governance.js';

const graph=(action='BUY')=>({
  truthState:'LIVE',horizonBars:16,
  qellyView:{action},
  metrics:{trendPerBarPct:.035,rsi14:62,returnZScore:1.4},
  quant:{regime:'TRENDING',trend:{roc14Pct:3.2,adx14:31},structure:{bias:'UPSIDE',strengthState:'STRONG'},volatility:{regime:'NORMAL'}},
  forecast:{probabilities:{bull:.61,base:.22,bear:.17}}
});
const mtf={agreement:{direction:'BUY',aligned:3,total:4,directional:3}};

test('Wave CB catalog declares formula family, role and redundancy group for governed features',()=>{
  assert.ok(FORMULA_CATALOG.length>=12);
  assert.ok(FORMULA_CATALOG.every(item=>item.id&&item.family&&item.role&&item.redundancyGroup&&item.definition));
  assert.ok(FORMULA_CATALOG.some(item=>item.role==='context_only'));
  assert.ok(FORMULA_CATALOG.some(item=>item.role==='risk_context'));
});

test('Wave CB redundancy control suppresses correlated trend and momentum duplicates',()=>{
  const result=buildDecisionFormulaGovernance(graph(),{multiTimeframe:mtf});
  assert.equal(result.state,'GOVERNED');
  assert.ok(result.activeDirectionalFamilies>=4);
  assert.ok(result.suppressedFeatureCount>=2);
  const trend=result.redundancyGroups.find(item=>item.group==='trend-direction');
  const momentum=result.redundancyGroups.find(item=>item.group==='momentum-direction');
  assert.equal(trend.members.length,2);
  assert.equal(momentum.members.length,2);
  assert.equal(trend.suppressed.length,1);
  assert.equal(momentum.suppressed.length,1);
  assert.ok(result.netDirectionalScore>0);
  assert.ok(result.baseActionSupport>0);
});

test('Wave CB context-only market data cannot become an independent directional vote',()=>{
  const result=buildDecisionFormulaGovernance(graph(),{
    multiTimeframe:mtf,
    liquidity:{state:'live',top5Imbalance:-.99,depthConsensus:'ASK_HEAVY_CONSENSUS',spreadBps:2},
    derivatives:{state:'live',fundingPct:-.04},
    crossAsset:{state:'available',relativeStrengthPct:-9,benchmark:'ETH'}
  });
  for(const id of ['liquidity-depth','funding-carry','cross-asset-relative']){
    const item=result.features.find(feature=>feature.id===id);
    assert.ok(item);
    assert.equal(item.contribution,0);
  }
  assert.ok(result.netDirectionalScore>0);
});

test('Wave CB can veto a severe governed contradiction but does not create direction itself',()=>{
  const value=graph('BUY');
  value.metrics={trendPerBarPct:-.05,rsi14:34,returnZScore:-2};
  value.quant={...value.quant,trend:{roc14Pct:-5,adx14:35},structure:{bias:'DOWNSIDE',strengthState:'STRONG'}};
  value.forecast={probabilities:{bull:.12,base:.18,bear:.70}};
  const result=buildDecisionFormulaGovernance(value,{multiTimeframe:{agreement:{direction:'SELL',aligned:4,total:4,directional:4}}});
  assert.equal(result.severeContradiction,true);
  assert.ok(result.baseActionSupport<=-.35);
  const neutral=buildDecisionFormulaGovernance({...value,qellyView:{action:'NO TRADE'}},{multiTimeframe:null});
  assert.equal(neutral.severeContradiction,false);
});

test('Wave CB is integrated into Decision API and the practitioner UI',async()=>{
  const [api,route,css]=await Promise.all([
    readFile(new URL('../functions/api/v1/decision-proven-graph.js',import.meta.url),'utf8'),
    readFile(new URL('../apps/web/public/assets/routes/decision-proven-graph.mjs',import.meta.url),'utf8'),
    readFile(new URL('../apps/web/public/assets/qelly-decision-proven-graph.css',import.meta.url),'utf8')
  ]);
  assert.match(api,/buildDecisionFormulaGovernance/);
  assert.match(api,/formulaSevereContradiction/);
  assert.match(api,/Governed formula families materially contradict/);
  assert.match(route,/FORMULA GOVERNANCE · ENSEMBLE ATTRIBUTION/);
  assert.match(route,/REDUNDANCY-SUPPRESSED BY/);
  assert.match(css,/q-dpg-formula-governance__contributors/);
});
