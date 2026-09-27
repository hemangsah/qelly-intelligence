import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {buildDecisionSmcPriceAction,SMC_PRICE_ACTION_DEFINITIONS,__decisionSmcPriceActionTest} from '../functions/_lib/decision-smc-price-action.js';
import {buildDecisionFormulaGovernance} from '../functions/_lib/decision-formula-governance.js';

const candle=(i,o,h,l,c)=>({time:1_700_000_000_000+i*60_000,open:o,high:h,low:l,close:c,volume:100+i});
const trending=[];
for(let i=0;i<36;i++){
  const base=100+i*.5;
  trending.push(candle(i,base,base+1,base-.6,base+.55));
}
trending[33]=candle(33,116.3,117.1,115.8,116.0);
trending[34]=candle(34,116.0,117.0,115.7,116.2);
trending[35]=candle(35,116.1,119.4,115.9,119.0);

test('Wave CC publishes explicit deterministic definitions for the full SMC / price-action library',()=>{
  for(const key of ['swing','sequence','bos','choch','displacement','fvg','orderBlock','mitigation','liquiditySweep','equalHighLow','premiumDiscount','failedBreakout','rangeLiquidity','breakout','retest','rejection','engulfing','insideBar','outsideBar','pinBar','compressionExpansion','gap','trendContinuation','exhaustion','rangeBreakout']){
    assert.ok(SMC_PRICE_ACTION_DEFINITIONS[key],key);
  }
});

test('Wave CC displacement has an explicit body/range/close-location gate',()=>{
  const rows=[...Array.from({length:24},(_,i)=>candle(i,100+i*.05,100.6+i*.05,99.8+i*.05,100.2+i*.05)),candle(24,101.2,104.5,101.0,104.2)];
  const normalized=__decisionSmcPriceActionTest.normalize(rows);
  const displacement=__decisionSmcPriceActionTest.detectDisplacement(normalized);
  assert.equal(displacement.state,'DETECTED');
  assert.equal(displacement.direction,'BULLISH');
  assert.ok(displacement.bodyRatio>=1.6);
  assert.ok(displacement.bodyRangeRatio>=.6);
});

test('Wave CC detects deterministic FVG and later mitigation',()=>{
  const rows=[
    candle(0,100,101,99.5,100.5),
    candle(1,100.5,103,100.4,102.7),
    candle(2,103.2,104,102,103.7),
    candle(3,103.6,104,100.7,101.2)
  ];
  const normalized=__decisionSmcPriceActionTest.normalize(rows);
  const fvgs=__decisionSmcPriceActionTest.detectFvgs(normalized,.2);
  const bullish=fvgs.find(item=>item.direction==='BULLISH');
  assert.ok(bullish);
  assert.equal(bullish.mitigated,true);
});

test('Wave CC price-action rules detect engulfing, inside/outside bars and explicit ranges',()=>{
  const rows=[];
  for(let i=0;i<25;i++)rows.push(candle(i,100,101,99,100.2));
  rows[23]=candle(23,100.8,101,99.8,100.1);
  rows[24]=candle(24,99.9,101.4,99.7,101.2);
  const normalized=__decisionSmcPriceActionTest.normalize(rows);
  const pa=__decisionSmcPriceActionTest.priceAction(normalized,.1,'MIXED');
  assert.equal(pa.engulfing,'BULLISH');
  assert.equal(pa.state,'DERIVED');
  assert.ok(Number.isFinite(pa.directionalScore));
});

test('Wave CC full library is numerically bounded and exposes SMC plus price action',()=>{
  const result=buildDecisionSmcPriceAction(trending);
  assert.equal(result.state,'DERIVED');
  assert.ok(result.smc);
  assert.ok(result.priceAction);
  assert.ok(result.smc.directionalScore>=-1&&result.smc.directionalScore<=1);
  assert.ok(result.priceAction.directionalScore>=-1&&result.priceAction.directionalScore<=1);
  assert.ok(['PREMIUM','DISCOUNT','EQUILIBRIUM'].includes(result.smc.premiumDiscount.state));
});

test('Wave CC is wired into Decision quant, formula redundancy and Advanced UI',async()=>{
  const [dpg,gov,route,css]=await Promise.all([
    readFile(new URL('../functions/_lib/decision-proven-graph.js',import.meta.url),'utf8'),
    readFile(new URL('../functions/_lib/decision-formula-governance.js',import.meta.url),'utf8'),
    readFile(new URL('../apps/web/public/assets/routes/decision-proven-graph.mjs',import.meta.url),'utf8'),
    readFile(new URL('../apps/web/public/assets/qelly-decision-proven-graph.css',import.meta.url),'utf8')
  ]);
  assert.match(dpg,/buildDecisionSmcPriceAction/);
  assert.match(dpg,/smcPriceAction\.smc/);
  assert.match(gov,/smc-structure/);
  assert.match(gov,/price-action-state/);
  assert.match(gov,/redundancyGroup:'structure-direction'/);
  assert.match(route,/DETERMINISTIC SMC \/ PRICE ACTION/);
  assert.match(css,/q-dpg-smc-pa__grid/);
});


test('Wave CC standalone normalization rejects impossible or unsafe OHLCV rows',()=>{
  const rows=[
    candle(0,100,101,99,100.5),
    {time:1_700_000_060_000,open:100,high:99,low:98,close:100.5,volume:10},
    {time:1_700_000_120_000,open:100,high:101,low:100.2,close:100.1,volume:10},
    {time:1_700_000_180_000,open:100,high:101,low:99,close:100.5,volume:-1},
    candle(4,101,102,100,101.5)
  ];
  const normalized=__decisionSmcPriceActionTest.normalize(rows);
  assert.equal(normalized.length,2);
  assert.deepEqual(normalized.map(item=>item.index),[0,4]);
});

test('Wave CC SMC and market structure are redundancy-controlled while price action remains an independent governed family',()=>{
  const graph={
    truthState:'LIVE',
    horizonBars:16,
    qellyView:{action:'BUY'},
    metrics:{trendPerBarPct:0,rsi14:50,returnZScore:0},
    forecast:{probabilities:{bull:.60,bear:.20}},
    quant:{
      regime:'TREND',
      trend:{roc14Pct:0,adx14:24},
      structure:{bias:'UPSIDE',strengthState:'WEAK'},
      smc:{state:'DERIVED',directionalScore:.9,breakOfStructure:'BULLISH',changeOfCharacter:'NONE',liquiditySweep:'NONE'},
      priceAction:{state:'DERIVED',directionalScore:-.7,breakout:'BEARISH',retest:'NONE',engulfing:'NONE',pinBar:'NONE'},
      volatility:{regime:'NORMAL'}
    }
  };
  const governance=buildDecisionFormulaGovernance(graph,{multiTimeframe:{agreement:{total:0,aligned:0,direction:'MIXED'}}});
  const group=governance.redundancyGroups.find(item=>item.group==='structure-direction');
  assert.ok(group);
  assert.deepEqual(new Set(group.members),new Set(['market-structure','smc-structure']));
  assert.equal(group.primary,'smc-structure');
  assert.deepEqual(group.suppressed,['market-structure']);
  const smc=governance.features.find(item=>item.id==='smc-structure');
  const structure=governance.features.find(item=>item.id==='market-structure');
  const pa=governance.features.find(item=>item.id==='price-action-state');
  assert.equal(smc.suppressedBy,null);
  assert.equal(structure.suppressedBy,'smc-structure');
  assert.equal(structure.effectiveScore,0);
  assert.equal(pa.suppressedBy,null);
  assert.notEqual(pa.effectiveScore,0);
  assert.equal(governance.families.find(item=>item.family==='price_action').state,'ACTIVE');
  assert.ok(governance.topContributors.some(item=>item.id==='smc-structure'));
  assert.ok(governance.topContributors.some(item=>item.id==='price-action-state'));
});
