import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {storeDecisionContext,consumeDecisionContext,DECISION_CONTEXT_KEY} from '../apps/web/public/assets/decision-context-bridge.mjs';
import {compactDecisionToolReceipt} from '../functions/_lib/qelly-chat-tools.js';
import {buildUniversalSearch} from '../functions/_lib/public-search.js';

test('shared Decision bridge preserves supported asset/timeframe and consumes once',()=>{
  const original=globalThis.sessionStorage;
  const values=new Map();
  globalThis.sessionStorage={
    getItem:key=>values.has(key)?values.get(key):null,
    setItem:(key,value)=>values.set(key,String(value)),
    removeItem:key=>values.delete(key)
  };
  try{
    assert.equal(storeDecisionContext({asset:'QI-CRYPTO-BTC',timeframe:'1h',source:'asset-dossier'}),true);
    assert.equal(values.has(DECISION_CONTEXT_KEY),true);
    assert.deepEqual(consumeDecisionContext(),{asset:'BTC',interval:'1h'});
    assert.equal(values.has(DECISION_CONTEXT_KEY),false);
    assert.deepEqual(consumeDecisionContext(),{asset:'BTC',interval:'15m'});
    assert.equal(storeDecisionContext({asset:'INVALID',timeframe:'1h'}),false);
  }finally{
    if(original===undefined)delete globalThis.sessionStorage;else globalThis.sessionStorage=original;
  }
});

test('QELLY Chat compact Decision receipt carries Wave J context without changing eligibility',()=>{
  const result={
    truthState:'LIVE',
    observedAt:'2026-09-23T08:00:00.000Z',
    freshness:{state:'LIVE'},
    asset:'BTC',interval:'15m',horizon:'4h',
    market:{lastPrice:100,currentState:{label:'range'}},
    provenance:{provider:'Hyperliquid',model:{limitations:['single venue']}},
    qellyView:{
      action:'NO TRADE',confidence:.62,changesIf:'Wait for alignment.',
      evidenceGate:{directionalEligible:false,qualityScore:.72},
      contradictions:['Timeframes conflict.'],
      riskState:{label:'NORMAL'},scenario:{bull:.4,base:.3,bear:.3}
    },
    quant:{calibration:{state:'WEAK_CALIBRATION',eligible:false,sampleSize:46,brierScore:.34,reliabilityGap:.12,skillScore:-.02}},
    tradeResearch:{status:'NO_TRADE',lifecycle:{state:'NO_TRADE'},entry:null,stop:null,invalidation:null,selected:null,targets:[],expiryAt:null,reason:'Evidence gate did not clear.'},
    historicalAnalogs:{state:'AVAILABLE',summary:{count:5},eligibilityImpact:'none'},
    contradictionAnalysis:{state:'CONFLICT',score:.5,strongestSupport:'Price stable',strongestContradiction:'MTF conflict',unresolved:true},
    decisionSnapshot:{asset:'BTC',interval:'15m',action:'NO TRADE'},
    decisionTrace:{eligibilityImpact:'none',boundary:'explanatory only',nodes:[{id:'price',kind:'observation',label:'Price',freshness:'LIVE',role:'observation',reliability:'VENUE_OBSERVED',source:'Hyperliquid'}]},
    multiTimeframe:{agreement:{direction:'MIXED',aligned:0,total:4}},
    evidence:{derivatives:{state:'live',fundingPct:.01,openInterestNotionalUsd:1_000_000},news:{state:'no-matches',provider:'GDELT',articles:[]}},
    confidence:{calibration:'not a success probability'}
  };
  const receipt=compactDecisionToolReceipt(result);
  assert.equal(receipt.data.action,'NO TRADE');
  assert.equal(receipt.data.tradeResearch.status,'NO_TRADE');
  assert.equal(receipt.data.calibration.state,'WEAK_CALIBRATION');
  assert.equal(receipt.data.historicalAnalogs.eligibilityImpact,'none');
  assert.equal(receipt.data.decisionTrace.eligibilityImpact,'none');
  assert.equal(receipt.data.decisionTrace.nodes.length,1);
  assert.equal(receipt.data.contradictionAnalysis.strongestContradiction,'MTF conflict');
  assert.match(receipt.limitations.join(' '),/explanatory only/i);
});

test('Universal Search discovers Decision methodology and asset research intents',()=>{
  const decision=buildUniversalSearch({q:'decision evidence methodology'}).items;
  assert.ok(decision.some(item=>item.id==='decision-provenance'));
  const assets=buildUniversalSearch({
    q:'BTC decision',
    assetRankings:{version:'test',candidates:[{id:'QI-CRYPTO-BTC',symbol:'BTC',name:'Bitcoin',rank:1,provider:'Hyperliquid',truthState:'live',observedAt:'2026-09-23T08:00:00Z',priceUsd:100,change24hPct:1,scores:{balanced:.8}}]}
  }).items;
  assert.ok(assets.some(item=>item.id==='QI-CRYPTO-BTC'));
});

test('Formula Screener remains supporting evidence and uses bounded metric compute',async()=>{
  const [api,route,app,decisionRoute,chat]=await Promise.all([
    readFile(new URL('../functions/api/v1/formula-screener.js',import.meta.url),'utf8'),
    readFile(new URL('../apps/web/public/assets/routes/formula-screener.mjs',import.meta.url),'utf8'),
    readFile(new URL('../apps/web/public/assets/app.js',import.meta.url),'utf8'),
    readFile(new URL('../apps/web/public/assets/routes/decision-proven-graph.mjs',import.meta.url),'utf8'),
    readFile(new URL('../apps/web/public/assets/ai/qelly-chat.mjs',import.meta.url),'utf8')
  ]);
  assert.match(api,/scenarioPaths:32/);
  assert.match(api,/supporting_evidence_only/);
  assert.match(api,/eligibility:false/);
  assert.match(route,/Open in Decision Intelligence/);
  assert.match(route,/storeDecisionContext/);
  assert.match(app,/source:'asset-dossier'/);
  assert.match(app,/source:'asset-dossier-unavailable'/);
  assert.match(decisionRoute,/data-dpg-open-chat/);
  assert.match(decisionRoute,/mode:'decision'/);
  assert.match(decisionRoute,/timeframe:state\.interval/);
  assert.match(chat,/storeDecisionContext/);
});
