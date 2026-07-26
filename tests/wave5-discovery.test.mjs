import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { DiscoveryService, discoveryAssets, categories, venues, dexPairs, globalCharts, predictionMarkets, researchArticles } from '../src/discovery/discovery-service.mjs';
import { SavedDiscoveryStore } from '../src/discovery/saved-discovery-store.mjs';

const discovery = new DiscoveryService();

test('Wave 5 deterministic universe spans public cross-asset discovery classes',()=>{
  assert.equal(discoveryAssets.length,24);
  assert.ok(new Set(discoveryAssets.map(item=>item.assetClass)).size>=8);
  assert.equal(categories.length,10);
  assert.equal(venues.length,6);
  assert.equal(dexPairs.length,4);
  assert.equal(globalCharts.length,5);
  assert.ok(predictionMarkets.length>=3);
  assert.equal(researchArticles.length,3);
  assert.ok(discoveryAssets.every(item=>item.canonicalId.startsWith('QI-')&&item.observedAt&&item.freshnessClass));
});

test('discovery overview declares fixture truth and carries universal display metadata',()=>{
  const overview=discovery.overview();
  assert.equal(overview.mode,'deterministic-public-discovery-foundation');
  assert.match(overview.truthBoundary,/No external public or licensed provider call/i);
  assert.equal(overview.kpis.length,4);
  assert.ok(overview.kpis.every(item=>item.value.canonicalEntityId&&item.value.provider&&item.value.qualityFlags.length));
});

test('rankings support cross-asset filters sorting and cursor pagination',()=>{
  const crypto=discovery.rankings({assetClass:'crypto',sort:'change24h',direction:'desc',limit:2});
  assert.equal(crypto.items.length,2);
  assert.equal(crypto.items[0].symbol,'SOL');
  assert.ok(crypto.nextCursor);
  const second=discovery.rankings({assetClass:'crypto',sort:'change24h',direction:'desc',limit:2,cursor:crypto.nextCursor});
  assert.equal(second.items.length,2);
  assert.notEqual(second.items[0].canonicalId,crypto.items[0].canonicalId);
  assert.ok(second.items.every(item=>item.assetClass==='crypto'));
});

test('federated search weights exact symbols and supports type facets',()=>{
  const exact=discovery.search({q:'BTC'});
  assert.equal(exact.items[0].type,'asset');
  assert.equal(exact.items[0].entity.canonicalId,'QI-CRYPTO-BTC');
  assert.equal(exact.mode,'federated-local-search-foundation');
  assert.ok(exact.facets.types.some(item=>item.value==='asset'));
  const onlyResearch=discovery.search({q:'provider',types:['research']});
  assert.ok(onlyResearch.items.length>0);
  assert.ok(onlyResearch.items.every(item=>item.type==='research'));
});

test('search suggestions remain bounded and deep-linkable',()=>{
  const suggestions=discovery.suggestions('gold');
  assert.ok(suggestions.length>=1&&suggestions.length<=8);
  assert.ok(suggestions.every(item=>item.resultId&&item.type&&item.title&&item.route));
});

test('category venue and DEX detail preserve evidence and reject unknown records',()=>{
  const category=discovery.category('smart-contract-platforms');
  assert.ok(category.constituents.some(item=>item.canonicalId==='QI-CRYPTO-ETH'));
  assert.equal(category.risk.status,'fixture-candidate');
  const venue=discovery.venue('venue-binance-fixture');
  assert.equal(venue.incidents.length,1);
  assert.equal(venue.freshnessClass,'simulated');
  const pair=discovery.dexPair('dex-eth-usdc');
  assert.equal(pair.chart.length,72);
  assert.equal(pair.trades.length,12);
  assert.ok(pair.qualityFlags.includes('not-on-chain-live'));
  assert.throws(()=>discovery.category('missing'),error=>error.code==='category_not_found');
  assert.throws(()=>discovery.venue('missing'),error=>error.code==='venue_not_found');
  assert.throws(()=>discovery.dexPair('missing'),error=>error.code==='dex_pair_not_found');
});

test('global charts and prediction markets are methodology-bound and non-tradable',()=>{
  const charts=discovery.charts();
  assert.equal(charts.items.length,5);
  assert.ok(charts.items.every(item=>item.series.length===60&&item.methodologyVersion));
  const predictions=discovery.predictionMarkets({category:'Macro'});
  assert.equal(predictions.tradable,false);
  assert.ok(predictions.items.every(item=>item.category==='Macro'));
});

test('converter calculates transparent fee and slippage without execution claims',()=>{
  const conversion=discovery.converter({amount:2,from:'BTC',to:'ETH',feeBps:25,slippageBps:10});
  assert.equal(conversion.from.canonicalId,'QI-CRYPTO-BTC');
  assert.equal(conversion.to.canonicalId,'QI-CRYPTO-ETH');
  assert.equal(conversion.tradable,false);
  assert.ok(Number(conversion.to.netAmount)<Number(conversion.to.grossAmount));
  assert.ok(conversion.qualityFlags.includes('not-executable'));
  assert.throws(()=>discovery.converter({amount:-1,from:'BTC',to:'ETH'}),error=>error.code==='amount_invalid');
  assert.throws(()=>discovery.converter({amount:1,from:'UNKNOWN',to:'ETH'}),error=>error.code==='converter_asset_not_found');
});

test('news research methodology coverage and status preserve trust boundaries',()=>{
  const news=discovery.news({topic:'crypto'});
  assert.ok(news.items.length>=1);
  const research=discovery.research({q:'provider'});
  assert.equal(research.items[0].body,undefined);
  const article=discovery.article('research-provider-truth');
  assert.equal(article.exportEnabled,false);
  assert.equal(article.commentsEnabled,false);
  assert.ok(article.citations.length>=1);
  const methodology=discovery.methodology('freshness');
  assert.equal(methodology.status,'implemented-local');
  assert.equal(discovery.coverage().summary.externalProvidersEnabled,0);
  assert.equal(discovery.status().safety.liveTrading,false);
  assert.throws(()=>discovery.article('missing'),error=>error.code==='research_article_not_found');
  assert.throws(()=>discovery.methodology('missing'),error=>error.code==='methodology_not_found');
});

test('saved discovery state is tenant/workspace scoped atomic and audited',async()=>{
  const root=await mkdtemp(path.join(os.tmpdir(),'qelly-wave5-store-'));
  const events=[];
  const store=new SavedDiscoveryStore({filePath:path.join(root,'saved-discovery.json'),auditLedger:{append:async event=>events.push(event)}});
  try{
    const base={userId:'user-a',tenantId:'tenant-a',workspaceId:'workspace-a',correlationId:'corr-wave5'};
    const search=await store.saveSearch({...base,name:'Crypto momentum',query:'crypto',filters:{assetClass:'crypto'}});
    const screen=await store.saveScreen({...base,name:'Large cap screen',definition:{assetClass:'equity',sort:'marketCap'}});
    const tray=await store.updateCompareTray({...base,canonicalIds:['QI-CRYPTO-BTC','QI-CRYPTO-BTC','QI-CRYPTO-ETH']});
    assert.equal(tray.canonicalIds.length,2);
    const own=await store.read({userId:'user-a',workspaceId:'workspace-a'});
    const other=await store.read({userId:'user-b',workspaceId:'workspace-a'});
    assert.equal(own.savedSearches[0].savedSearchId,search.savedSearchId);
    assert.equal(own.savedScreens[0].savedScreenId,screen.savedScreenId);
    assert.equal(other.savedSearches.length,0);
    assert.equal(events.length,3);
    const persisted=JSON.parse(await readFile(path.join(root,'saved-discovery.json'),'utf8'));
    assert.equal(persisted.savedSearches.length,1);
    assert.equal(persisted.compareTray.length,1);
  }finally{await rm(root,{recursive:true,force:true});}
});
