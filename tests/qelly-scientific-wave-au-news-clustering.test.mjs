import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {buildDecisionNewsClusters,titleTokenJaccard,tokenizeNewsTitle} from '../functions/_lib/decision-news.js';
import {compactDecisionToolReceipt} from '../functions/_lib/qelly-chat-tools.js';

const read=(path)=>readFile(new URL('../'+path,import.meta.url),'utf8');

const article=(title,source,url,publishedAt='20260925T070000Z')=>({title,source,url,publishedAt});

test('Wave AU clusters lexical duplicate reporting while preserving source diversity and raw counts',()=>{
  const articles=[
    article('Bitcoin ETF inflows rise as BlackRock fund grows','alpha.example','https://alpha.example/a'),
    article('BlackRock Bitcoin ETF inflows rise as fund grows','beta.example','https://beta.example/b'),
    article('Federal Reserve leaves interest rates unchanged','macro.example','https://macro.example/c')
  ];
  const result=buildDecisionNewsClusters(articles,{asset:'BTC'});
  assert.equal(result.state,'AVAILABLE');
  assert.equal(result.articleCount,3);
  assert.equal(result.clusterCount,2);
  assert.equal(result.duplicateCount,1);
  const first=result.clusters[0];
  assert.equal(first.articleCount,2);
  assert.equal(first.duplicateCount,1);
  assert.equal(first.sourceCount,2);
  assert.deepEqual(first.sources,['alpha.example','beta.example']);
  assert.equal(first.relevanceState,'DIRECT_ASSET_MENTION');
  assert.ok(first.topicHints.includes('ETF_INSTITUTIONAL'));
  assert.ok(first.meanTitleSimilarity>=.72);
  const second=result.clusters[1];
  assert.ok(second.topicHints.includes('MACRO_RATES'));
  assert.equal(second.relevanceState,'QUERY_CONTEXT_ONLY');
});

test('Wave AU lexical similarity is deterministic and does not pretend semantic equivalence',()=>{
  const a=tokenizeNewsTitle('Bitcoin ETF inflows rise as BlackRock fund grows');
  const b=tokenizeNewsTitle('BlackRock Bitcoin ETF inflows rise as fund grows');
  const c=tokenizeNewsTitle('Institutional demand for digital assets increases');
  assert.ok(titleTokenJaccard(a,b)>.9);
  assert.ok(titleTokenJaccard(a,c)<.5);
  const result=buildDecisionNewsClusters([
    article('Bitcoin ETF inflows rise as BlackRock fund grows','one.example','https://one.example/a'),
    article('Institutional demand for digital assets increases','two.example','https://two.example/b')
  ],{asset:'BTC'});
  assert.equal(result.clusterCount,2);
  assert.match(result.method,/lexical, not semantic/i);
  assert.match(result.boundary,/do not establish factual equivalence/i);
});

test('Wave AU emits topic/relevance hints only and never fabricates sentiment or market-impact direction',()=>{
  const result=buildDecisionNewsClusters([
    article('Bitcoin exchange hack prompts regulator review','example.com','https://example.com/a')
  ],{asset:'BTC'});
  const serialized=JSON.stringify(result);
  assert.ok(result.clusters[0].topicHints.includes('REGULATION_POLICY'));
  assert.ok(result.clusters[0].topicHints.includes('SECURITY_INCIDENT'));
  assert.equal(result.clusters[0].relevanceState,'DIRECT_ASSET_MENTION');
  assert.doesNotMatch(serialized,/"sentiment"/i);
  assert.doesNotMatch(serialized,/"impactDirection"/i);
  assert.match(result.boundary,/market impact/i);
  assert.match(result.boundary,/BUY\/SELL eligibility/i);
});

test('Wave AU empty news remains explicit and does not manufacture topics',()=>{
  const result=buildDecisionNewsClusters([],{asset:'ETH'});
  assert.equal(result.state,'NO_ARTICLES');
  assert.equal(result.articleCount,0);
  assert.equal(result.clusterCount,0);
  assert.deepEqual(result.clusters,[]);
  assert.match(result.boundary,/No topic, sentiment, market impact, causality or directional trade inference/i);
});

test('Wave AU preserves existing GDELT fetch/cache contract and attaches clusters only after normalization',async()=>{
  const source=await read('functions/api/v1/decision-proven-graph.js');
  assert.match(source,/news:\{state:newsState,provider:includeNews\?'GDELT':null,articles\}/);
  assert.match(source,/const newsClusters=buildDecisionNewsClusters\(articles,\{asset:resolvedAsset\}\)/);
  assert.match(source,/evidence\.news=\{\.\.\.evidence\.news,clusters:newsClusters\.clusters,clustering:newsClusters/);
  assert.match(source,/cacheOnly:true/);
  assert.match(source,/News is contextual evidence only/);
  assert.doesNotMatch(source,/newsClusters[^\n]{0,180}directionalEligible|clustering[^\n]{0,180}calibrationEligible/);
});

test('Wave AU deferred news endpoint exposes clusters but keeps the established zero-eligibility boundary',async()=>{
  const endpoint=await read('functions/api/v1/decision-news-context.js');
  assert.match(endpoint,/qelly\.decision-news-context\/1\.1\.0/);
  assert.match(endpoint,/buildDecisionNewsClusters\(result\.articles,\{asset\}\)/);
  assert.match(endpoint,/clusters:clustering\.clusters/);
  assert.match(endpoint,/eligibilityImpact:'none'/);
  assert.match(endpoint,/cannot change QELLY VIEW, entry, invalidation, targets, R:R feasibility, calibration, or NO TRADE eligibility/);
});

test('Wave AU Decision Trace labels headline clusters as contextual audit metadata only',async()=>{
  const context=await read('functions/_lib/decision-context.js');
  assert.match(context,/Deterministic lexical clusters may summarize duplicate reporting without changing raw articles/);
  assert.match(context,/lexical audit metadata only/);
  assert.match(context,/do not establish semantic equivalence, sentiment, market impact or institutional intent/);
});

test('Wave AU renders a responsive deduplicated news view with explicit lexical boundary',async()=>{
  const [route,css]=await Promise.all([
    read('apps/web/public/assets/routes/decision-proven-graph.mjs'),
    read('apps/web/public/assets/qelly-decision-proven-graph.css')
  ]);
  for(const phrase of ['NEWS CONTEXT · DEDUPLICATED VIEW','NO ELIGIBILITY IMPACT','mean lexical similarity','Lexical threshold','Context enrichment pending'])assert.ok(route.includes(phrase),phrase);
  assert.match(route,/newsResearchContext\(data,escapeHtml\)/);
  assert.match(css,/\.q-dpg-news__grid/);
  assert.match(css,/@media\(max-width:720px\).*q-dpg-news__grid\{grid-template-columns:1fr\}/s);
});

test('Wave AU QELLY Chat receipt carries cluster counts, topics and methodology without a second news engine',()=>{
  const clustering=buildDecisionNewsClusters([
    article('Bitcoin ETF inflows rise as BlackRock fund grows','alpha.example','https://alpha.example/a'),
    article('BlackRock Bitcoin ETF inflows rise as fund grows','beta.example','https://beta.example/b')
  ],{asset:'BTC'});
  const receipt=compactDecisionToolReceipt({
    asset:'BTC',interval:'15m',horizon:'4h',truthState:'LIVE',observedAt:'2026-09-25T08:20:00.000Z',
    qellyView:{action:'WAIT',confidence:.6,evidenceGate:{}},quant:{calibration:{}},
    evidence:{news:{state:'live',provider:'GDELT',articles:[
      article('Bitcoin ETF inflows rise as BlackRock fund grows','alpha.example','https://alpha.example/a'),
      article('BlackRock Bitcoin ETF inflows rise as fund grows','beta.example','https://beta.example/b')
    ],clusters:clustering.clusters,clustering},liquidity:{},derivatives:{},macro:{},eventRisk:{},crossAsset:{}},
    tradeResearch:{status:'NO_TRADE',matrix:[],targets:[]},historicalAnalogs:{},contradictionAnalysis:{},
    pastPresentFuture:{},evidenceGraph:{nodes:[]}
  });
  assert.equal(receipt.data.news.articleCount,2);
  assert.equal(receipt.data.news.clusterCount,1);
  assert.equal(receipt.data.news.duplicateCount,1);
  assert.equal(receipt.data.news.clusters[0].sourceCount,2);
  assert.ok(receipt.data.news.clusters[0].topicHints.includes('ETF_INSTITUTIONAL'));
  assert.match(receipt.data.news.clusteringBoundary,/contextual audit metadata only/i);
});
