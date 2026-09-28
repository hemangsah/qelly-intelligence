import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {buildDecisionFormulaGovernance} from '../functions/_lib/decision-formula-governance.js';
import {buildDecisionAssetClassEvidence,decisionAssetClassEvidencePolicy,resolveEvidenceHorizonBand} from '../functions/_lib/decision-asset-class-evidence.js';

const cryptoProfile=(states={})=>({
  profileId:'crypto',
  modules:[
    ['market-structure','structure','CORE','existing-engine-only'],
    ['volume-volatility','market','CORE','existing-engine-only'],
    ['multi-timeframe','multiTimeframe','CORE','existing-engine-only'],
    ['derivatives','derivatives','RELEVANT','none'],
    ['liquidity','liquidity','RELEVANT','none'],
    ['news-events','news','RELEVANT','none'],
    ['event-risk','eventRisk','RELEVANT','none'],
    ['cross-asset','crossAsset','RELEVANT','none'],
    ['on-chain','onChain','OPTIONAL','none'],
    ['exchange-flow','institutionalFlow','OPTIONAL','none'],
    ['macro','macro','CONTEXT','none'],
    ['options','options','OPTIONAL','none'],
    ['fundamentals','fundamentals','OPTIONAL','none']
  ].map(([id,sourceKey,applicability,eligibilityImpact])=>({id,label:id,sourceKey,applicability,eligibilityImpact,state:states[id]||'UNAVAILABLE',sourceRequirement:id+' source'}))
});

test('Wave CD resolves evidence horizon using the longer timeframe/research horizon',()=>{
  assert.equal(resolveEvidenceHorizonBand('1m','1h'),'SCALP');
  assert.equal(resolveEvidenceHorizonBand('15m','4h'),'INTRADAY');
  assert.equal(resolveEvidenceHorizonBand('15m','3d'),'SWING');
  assert.equal(resolveEvidenceHorizonBand('4h','7d'),'POSITION');
  assert.equal(resolveEvidenceHorizonBand('1d','1h'),'POSITION');
});

test('Wave CD makes macro and fundamentals more relevant at long horizons while short horizons emphasize flow/events',()=>{
  const policy=decisionAssetClassEvidencePolicy('crypto');
  const byId=new Map(policy.map(item=>[item.id,item]));
  assert.ok(byId.get('liquidity').weights.SCALP>byId.get('fundamentals').weights.SCALP);
  assert.ok(byId.get('event-risk').weights.SCALP>byId.get('macro').weights.SCALP);
  assert.ok(byId.get('fundamentals').weights.POSITION>byId.get('fundamentals').weights.SCALP);
  assert.ok(byId.get('macro').weights.POSITION>byId.get('macro').weights.SCALP);
  assert.ok(byId.get('fundamentals').weights.POSITION>byId.get('liquidity').weights.POSITION);
});

test('Wave CD unavailable evidence has zero effective relevance and reference macro never gains directional weight',()=>{
  const profile=cryptoProfile({
    'market-structure':'AVAILABLE','volume-volatility':'AVAILABLE','multi-timeframe':'AVAILABLE',
    derivatives:'AVAILABLE',liquidity:'AVAILABLE','news-events':'PARTIAL','event-risk':'UNAVAILABLE',
    'cross-asset':'AVAILABLE',macro:'AVAILABLE',fundamentals:'UNAVAILABLE'
  });
  const result=buildDecisionAssetClassEvidence({
    assetClass:'crypto',interval:'15m',horizon:'7d',profile,
    evidence:{macro:{state:'available',referenceOnly:true,eligibilityImpact:'none'},fundamentals:{state:'unavailable'}}
  });
  const macro=result.modules.find(item=>item.id==='macro');
  const fundamentals=result.modules.find(item=>item.id==='fundamentals');
  assert.equal(result.band,'POSITION');
  assert.ok(macro.effectiveRelevanceWeight>0);
  assert.equal(macro.directionalWeight,0);
  assert.equal(macro.decisionRole,'CONTEXT_ONLY');
  assert.equal(macro.referenceOnly,true);
  assert.equal(fundamentals.effectiveRelevanceWeight,0);
  assert.equal(fundamentals.directionalWeight,0);
  assert.ok(result.missingHighRelevance.some(item=>item.id==='fundamentals'));
  assert.match(result.boundary,/not directional votes/i);
});

test('Wave CD does not double count modules already consumed by the core Decision engine',()=>{
  const profile=cryptoProfile({'market-structure':'AVAILABLE','volume-volatility':'AVAILABLE','multi-timeframe':'AVAILABLE'});
  const result=buildDecisionAssetClassEvidence({assetClass:'crypto',interval:'5m',horizon:'1h',profile,evidence:{}});
  for(const id of ['market-structure','volume-volatility','multi-timeframe']){
    const item=result.modules.find(module=>module.id===id);
    assert.equal(item.decisionRole,'ALREADY_IN_CORE_ENGINE');
    assert.equal(item.directionalWeight,0);
    assert.match(item.boundary,/does not re-score/i);
  }
});

test('Wave CD encodes distinct evidence priorities for FX equities indices commodities rates and ETFs',()=>{
  const requirements=[
    ['fx',['central-banks','rates-yields','inflation','employment','growth']],
    ['indian-equities',['results','corporate-actions','exchange-disclosures','rbi','domestic-macro']],
    ['global-equities',['earnings','filings','sector-index','rates-macro']],
    ['indices',['breadth','sector-contribution','macro-rates','flows']],
    ['metals-commodities',['usd-yields','inventories','futures-positioning','geopolitics','agency-reports']],
    ['rates-bonds',['central-banks','inflation-growth','curve','auctions']],
    ['etfs',['flows','holdings','tracking','macro']]
  ];
  for(const [assetClass,ids] of requirements){
    const policy=decisionAssetClassEvidencePolicy(assetClass);
    const actual=new Set(policy.map(item=>item.id));
    for(const id of ids)assert.ok(actual.has(id),assetClass+' '+id);
  }
});


const governanceGraph=()=>({
  truthState:'LIVE',horizonBars:16,qellyView:{action:'BUY'},
  metrics:{trendPerBarPct:.035,rsi14:62,returnZScore:1.4},
  quant:{regime:'TRENDING',trend:{roc14Pct:3.2,adx14:31},structure:{bias:'UPSIDE',strengthState:'STRONG'},smc:{state:'DERIVED',directionalScore:.6},priceAction:{state:'DERIVED',directionalScore:.4},volatility:{regime:'NORMAL'}},
  forecast:{probabilities:{bull:.61,base:.22,bear:.17}}
});
const governanceMtf={agreement:{direction:'BUY',aligned:3,total:4,directional:3}};

test('Wave CD macro/fundamental receipts are actually integrated but cannot manufacture direction',()=>{
  const profile=cryptoProfile({'market-structure':'AVAILABLE','volume-volatility':'AVAILABLE','multi-timeframe':'AVAILABLE',macro:'AVAILABLE',fundamentals:'AVAILABLE'});
  const policy=buildDecisionAssetClassEvidence({assetClass:'crypto',interval:'15m',horizon:'7d',profile,evidence:{macro:{state:'available',referenceOnly:true,eligibilityImpact:'none'},fundamentals:{state:'available'}}});
  const base=buildDecisionFormulaGovernance(governanceGraph(),{multiTimeframe:governanceMtf});
  const contextual=buildDecisionFormulaGovernance(governanceGraph(),{multiTimeframe:governanceMtf,macro:{state:'available',referenceOnly:true,eligibilityImpact:'none',provider:'ECB',level:'DAILY_REFERENCE'},fundamentals:{state:'available',provider:'governed-fixture'},assetClassEvidence:policy});
  assert.equal(contextual.netDirectionalScore,base.netDirectionalScore);
  assert.equal(contextual.severeContradiction,base.severeContradiction);
  const macro=contextual.features.find(item=>item.id==='macro-context');
  const fundamentals=contextual.features.find(item=>item.id==='fundamental-context');
  assert.equal(macro.role,'context_only');
  assert.equal(fundamentals.role,'context_only');
  assert.equal(macro.contribution,0);
  assert.equal(fundamentals.contribution,0);
  assert.ok(macro.relevance>0);
  assert.ok(fundamentals.relevance>0);
  assert.match(contextual.boundary,/zero-directional|zero directional|cannot become independent directional/i);
});

test('Wave CD Decision API carries policy into formula receipts and setup risk context',async()=>{
  const [api,trade,route,css]=await Promise.all([
    readFile(new URL('../functions/api/v1/decision-proven-graph.js',import.meta.url),'utf8'),
    readFile(new URL('../functions/_lib/decision-trade-research.js',import.meta.url),'utf8'),
    readFile(new URL('../apps/web/public/assets/routes/decision-proven-graph.mjs',import.meta.url),'utf8'),
    readFile(new URL('../apps/web/public/assets/qelly-decision-proven-graph.css',import.meta.url),'utf8')
  ]);
  assert.match(api,/buildDecisionAssetClassEvidence/);
  assert.match(api,/evidence\.assetClassWeighting=assetClassEvidence/);
  assert.match(api,/macro,fundamentals:evidence\.fundamentals,assetClassEvidence/);
  assert.match(api,/assetClassEvidenceBand/);
  assert.match(trade,/assetClassEvidence/);
  assert.match(trade,/fundamentals:/);
  assert.match(route,/ASSET-CLASS FUNDAMENTAL \/ MACRO WEIGHTING/);
  assert.match(route,/Directional re-vote/);
  assert.match(css,/q-dpg-asset-class-weighting__modules/);
});
