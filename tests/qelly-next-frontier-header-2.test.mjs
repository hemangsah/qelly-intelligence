import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {buildPublicComparisonLab} from '../functions/_lib/public-comparison-lab.js';

const read=(path)=>readFile(new URL(`../${path}`,import.meta.url),'utf8');

test('Header 2.0 exposes complete live Decision identity and action semantics',async()=>{
  const route=await read('apps/web/public/assets/routes/decision-proven-graph.mjs');
  for(const phrase of [
    'QELLY Decision Intelligence',
    'Observed ',
    'Evidence quality',
    'Calibrated confidence',
    'MTF agreement',
    'Regime',
    'Volatility',
    'Timeframe',
    'Find Trade Now',
    'Explain This Move',
    'Explain Candle',
    'Compare Timeframes',
    'Compare Asset',
    'Ask QELLY',
    'Sources / Methodology'
  ])assert.ok(route.includes(phrase),`missing Header 2.0 phrase: ${phrase}`);
  assert.match(route,/data-dpg-explain-candle/);
  assert.match(route,/data-dpg-compare-asset/);
  assert.match(route,/canonicalDecisionAsset/);
  assert.match(route,/navigate\('comparison-lab',assetId\)/);
  assert.match(route,/state\.selection=state\.draft;load\(\)/);
});

test('Header 2.0 Compare Asset hands every governed Decision crypto into the comparison contract',()=>{
  for(const symbol of ['BTC','ETH','SOL','HYPE','XRP','DOGE']){
    const model=buildPublicComparisonLab({candidateA:`QI-CRYPTO-${symbol}`});
    assert.equal(model.candidateA.symbol,symbol);
    assert.equal(model.candidateA.assetClass,'Crypto asset');
    assert.equal(model.candidateB.assetClass,'Crypto asset');
    assert.notEqual(model.candidateA.id,model.candidateB.id);
    assert.equal(model.compatible,true);
    assert.equal(model.boundaries.recommendation,false);
    assert.equal(model.boundaries.execution,false);
  }
});

test('Comparison Lab consumes route asset context without inventing comparison values',async()=>{
  const route=await read('apps/web/public/assets/routes/comparison-lab.mjs');
  const backend=await read('functions/_lib/public-comparison-lab.js');
  assert.match(route,/asset:contextAsset/);
  assert.match(route,/initialParams\.set\('candidateA',String\(contextAsset\)\)/);
  for(const symbol of ['BTC','ETH','SOL','HYPE','XRP','DOGE'])assert.match(backend,new RegExp(`QI-CRYPTO-${symbol}`));
  assert.match(backend,/compatibleFallback/);
  const sol=buildPublicComparisonLab({candidateA:'QI-CRYPTO-SOL'});
  assert.equal(sol.coverage.connectedSnapshots,0);
  assert.equal(sol.receipt.state,'draft');
  assert.equal(sol.receipt.scoreA,null);
  assert.equal(sol.boundaries.userDeclaredValues,true);
});

test('Header 2.0 action density remains responsive instead of hiding actions',async()=>{
  const css=await read('apps/web/public/assets/qelly-decision-proven-graph.css');
  assert.ok(css.includes('.q-dpg-hero__actions{display:grid'));
  assert.ok(css.includes('@media(max-width:1040px){.q-dpg-hero{grid-template-columns:1fr 1.25fr}.q-dpg-hero__actions{grid-column:1/-1;grid-template-columns:repeat(4,minmax(0,1fr))}'));
  assert.ok(css.includes('@media(max-width:760px){.q-dpg-hero{grid-template-columns:1fr}.q-dpg-hero__view{border:0;border-top:1px solid var(--border);border-bottom:1px solid var(--border);padding:12px 0}.q-dpg-hero__actions{grid-column:auto;grid-template-columns:repeat(2,minmax(0,1fr))}'));
  assert.ok(css.includes('@media(max-width:480px){.q-dpg-hero__selects,.q-dpg-hero__actions,.q-dpg-hero__metrics{grid-template-columns:1fr}'));
});
