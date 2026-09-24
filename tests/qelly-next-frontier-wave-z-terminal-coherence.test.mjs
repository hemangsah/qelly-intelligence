import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {
  DECISION_CONTEXT_KEY,RESEARCH_CONTEXT_KEY,
  storeDecisionContext,consumeDecisionContext,storeResearchContext,peekResearchContext,clearResearchContext,
  __decisionContextBridgeTest
} from '../apps/web/public/assets/decision-context-bridge.mjs';
import {buildUniversalSearch} from '../functions/_lib/public-search.js';

const read=(path)=>readFile(new URL(`../${path}`,import.meta.url),'utf8');

const withSessionStorage=async(fn)=>{
  const original=globalThis.sessionStorage;
  const data=new Map();
  const storage={
    getItem:key=>data.has(String(key))?data.get(String(key)):null,
    setItem:(key,value)=>{data.set(String(key),String(value));},
    removeItem:key=>{data.delete(String(key));},
    clear:()=>data.clear()
  };
  Object.defineProperty(globalThis,'sessionStorage',{value:storage,configurable:true,writable:true});
  try{return await fn({data,storage});}
  finally{
    if(original===undefined)delete globalThis.sessionStorage;
    else Object.defineProperty(globalThis,'sessionStorage',{value:original,configurable:true,writable:true});
  }
};

test('Wave Z shared research context sanitizes asset timeframe source and registered formula IDs',async()=>{
  await withSessionStorage(async()=>{
    assert.equal(storeResearchContext({asset:'QI-CRYPTO-BTC',timeframe:'15m',source:'Decision Intelligence / Formula',formulaId:'momentum_quality'}),true);
    const context=peekResearchContext();
    assert.deepEqual(context,{
      asset:'BTC',
      timeframe:'15m',
      source:'Decision-Intelligence-Formula',
      formulaId:'momentum_quality'
    });
    assert.equal(__decisionContextBridgeTest.normalizeFormulaId('risk-reward'),'risk-reward');
    assert.equal(__decisionContextBridgeTest.normalizeFormulaId('momentum_quality'),'momentum_quality');
    assert.equal(__decisionContextBridgeTest.normalizeFormulaId('../../bad'),null);
    clearResearchContext();
    assert.equal(peekResearchContext().asset,null);
  });
});

test('Wave Z Decision handoff also establishes durable research-flow context without changing one-shot Decision consumption',async()=>{
  await withSessionStorage(async({data})=>{
    assert.equal(storeDecisionContext({asset:'ETH',timeframe:'1h',source:'asset-dossier'}),true);
    assert.ok(data.has(DECISION_CONTEXT_KEY));
    assert.ok(data.has(RESEARCH_CONTEXT_KEY));
    assert.deepEqual(consumeDecisionContext(),{asset:'ETH',interval:'1h'});
    assert.equal(data.has(DECISION_CONTEXT_KEY),false);
    assert.equal(data.has(RESEARCH_CONTEXT_KEY),true);
    assert.deepEqual(peekResearchContext(),{asset:'ETH',timeframe:'1h',source:'asset-dossier',formulaId:null});
  });
});

test('Wave Z Universal Search already deep-links supported assets into the canonical Asset Dossier',()=>{
  const result=buildUniversalSearch({q:'BTC',types:'asset',limit:10});
  const btc=result.items.find(item=>item.id==='QI-CRYPTO-BTC');
  assert.ok(btc);
  assert.equal(btc.route,'asset/QI-CRYPTO-BTC');
  assert.equal(btc.type,'asset');
  assert.match(btc.purpose,/asset dossier/i);
});

test('Wave Z research-flow source contract connects Dossier to Decision to Formula to Chat with one shared bounded context',async()=>{
  const [app,decision,formula,chat,bridge,css]=await Promise.all([
    read('apps/web/public/assets/app.js'),
    read('apps/web/public/assets/routes/decision-proven-graph.mjs'),
    read('apps/web/public/assets/routes/formula-screener.mjs'),
    read('apps/web/public/assets/routes/qelly-chat-workspace.mjs'),
    read('apps/web/public/assets/decision-context-bridge.mjs'),
    read('apps/web/public/assets/qelly-chat-workspace.css')
  ]);

  for(const phrase of [
    'data-action="asset-decision"',
    'data-action="asset-formula"',
    "storeResearchContext({asset:data.symbol,timeframe:'1h',source:'asset-dossier'})",
    "navigate('formula-screener')",
    'Research flow: dossier → Decision Intelligence → formula evidence → Qelly Chat'
  ])assert.ok(app.includes(phrase),phrase);

  for(const phrase of [
    'data-dpg-formula-evidence',
    "storeResearchContext({asset:state.asset,timeframe:state.interval,source:'decision-intelligence'})",
    "navigate?.('formula-screener')"
  ])assert.ok(decision.includes(phrase),phrase);

  for(const phrase of [
    'peekResearchContext()',
    'contextTimeframe',
    'data-action="open-chat"',
    "storeDecisionContext({asset,timeframe:contextTimeframe,source:'formula-screener'})",
    "storeResearchContext({asset,timeframe:contextTimeframe,source:'formula-screener',formulaId:choice.value})",
    "navigate?.('news-research')"
  ])assert.ok(formula.includes(phrase),phrase);

  for(const phrase of [
    'peekResearchContext()',
    'research context',
    'data-route="asset"',
    'data-route="decision-provenance"',
    'data-route="formula-screener"',
    'asset:contextAsset||undefined',
    'timeframe:contextTimeframe'
  ])assert.ok(chat.includes(phrase),phrase);

  assert.doesNotMatch(bridge,/\bfetch\s*\(|\bapi\s*\(/);
  assert.match(css,/\.q-chat-handoff\{display:grid;grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);
  assert.match(css,/@media\(max-width:980px\)\{[^}]*\}\.q-chat-mode-grid,.q-chat-dataset-grid,.q-chat-handoff\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/s);
  assert.match(css,/@media\(max-width:640px\)\{\.q-chat-mode-grid,.q-chat-dataset-grid,.q-chat-handoff\{grid-template-columns:1fr\}/s);
});

test('Wave Z Formula handoff uses research timeframe without changing Formula Screener sampling interval or adding a new endpoint',async()=>{
  const formula=await read('apps/web/public/assets/routes/formula-screener.mjs');
  assert.match(formula,/const ENDPOINT='\/api\/v1\/formula-screener'/);
  assert.match(formula,/Formula Screener still uses its declared/);
  assert.match(formula,/timeframe:contextTimeframe/);
  assert.doesNotMatch(formula,/decision-proven-graph\?/');
  assert.equal((formula.match(/const ENDPOINT=/g)||[]).length,1);
});

test('Wave Z removes only the proven unreachable Intelligence Terminal runtime binding and retains its test-owned module',async()=>{
  const [app,testSource,moduleSource,classification]=await Promise.all([
    read('apps/web/public/assets/app.js'),
    read('tests/intelligence-terminal-public.test.mjs'),
    read('apps/web/public/assets/routes/intelligence-terminal.mjs'),
    read('artifacts/QELLY_WAVE_Z_CODE_CLASSIFICATION.json')
  ]);
  assert.doesNotMatch(app,/renderIntelligenceTerminal|routes\/intelligence-terminal\.mjs/);
  assert.match(testSource,/__intelligenceTerminalTest/);
  assert.match(moduleSource,/export const __intelligenceTerminalTest/);
  const manifest=JSON.parse(classification);
  const dead=manifest.items.find(item=>item.path==='apps/web/public/assets/app.js::renderIntelligenceTerminal lazy binding');
  const testOwned=manifest.items.find(item=>item.path==='apps/web/public/assets/routes/intelligence-terminal.mjs');
  assert.equal(dead?.classification,'DEAD');
  assert.equal(testOwned?.classification,'TEST');
  assert.equal(manifest.policy.massDeletion,false);
});

test('Wave Z classification preserves build-time finalizers and compatibility owners instead of mass deletion',async()=>{
  const manifest=JSON.parse(await read('artifacts/QELLY_WAVE_Z_CODE_CLASSIFICATION.json'));
  const byPath=new Map(manifest.items.map(item=>[item.path,item.classification]));
  assert.equal(byPath.get('scripts/finalize-governed-discovery.mjs'),'BUILD_TIME');
  assert.equal(byPath.get('scripts/finalize-public-runtime.mjs'),'BUILD_TIME');
  assert.equal(byPath.get('apps/web/public/assets/routes/decision-provenance.mjs'),'COMPATIBILITY');
  assert.equal(byPath.get('apps/web/public/assets/qelly-shell-compat.js'),'COMPATIBILITY');
  assert.equal(byPath.get('route:rankings'),'COMPATIBILITY');
  assert.deepEqual(manifest.researchFlow.order,['search','asset','decision-provenance','formula-screener','news-research']);
});


test('Wave Z page-by-page audit covers every required product surface and the canonical research flow',async()=>{
  const audit=JSON.parse(await read('artifacts/QELLY_WAVE_Z_PRODUCT_COHERENCE.json'));
  const routes=new Set(audit.pages.map(item=>item.route));
  for(const route of [
    'market','decision-provenance','formula-screener','asset','news-research','search','india-finance',
    'alert-center','notification-center','qelly-verify','calculator-center','calculator-detail/:id'
  ])assert.ok(routes.has(route),route);
  assert.equal(audit.defaultHomeRoute,'market');
  assert.deepEqual(audit.flow.canonical,['Universal Search','Asset Dossier','Decision Intelligence','Formula Screener','Qelly Chat']);
  assert.match(audit.flow.evidenceBoundary,/navigation context only/i);
  assert.match(audit.flow.evidenceBoundary,/destination's own evidence\/tool contract/i);
});
