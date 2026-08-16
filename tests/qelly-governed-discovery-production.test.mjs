import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {rewriteGovernedDiscovery} from '../scripts/finalize-governed-discovery.mjs';

const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');

const legacyCases=[
  "case 'discovery-hub': await renderDiscoveryHub(main); break;",
  "case 'search': await renderSearch(main); break;",
  "case 'categories': await renderCategories(main); break;",
  "case 'category-detail': await renderCategoryDetail(main); break;",
  "case 'venues': await renderVenues(main); break;",
  "case 'venue-detail': await renderVenueDetail(main); break;",
  "case 'dex-discovery': await renderDexDiscovery(main); break;",
  "case 'global-charts': await renderGlobalCharts(main); break;",
  "case 'news-research': await renderNewsResearch(main); break;",
  "case 'research-article': await renderResearchArticle(main); break;",
  "case 'asset': await renderAsset(main); break;",
  "case 'rankings': await renderLegacyRankings(main); break;",
  "case 'converter': await renderConverter(main); break;",
  "case 'trust-center': await renderTrustCenter(main); break;"
];

const unavailableRoutes=['discovery-hub','search','categories','category-detail','venues','venue-detail','dex-discovery','global-charts','news-research','research-article','asset','rankings'];

test('production finalizer replaces every finance-shaped fixture route owner',async()=>{
  const source=await read('apps/web/public/assets/app.js');
  const output=rewriteGovernedDiscovery(source);
  for(const legacy of legacyCases)assert.equal(output.includes(legacy),false,`legacy production route remains: ${legacy}`);
  for(const route of unavailableRoutes){
    assert.ok(output.includes(`renderGovernedUnavailable(main,{api,pageHead,stateBanner,escapeHtml,navigate,toast,state},'${route}')`),`governed replacement missing for ${route}`);
  }
  assert.match(output,/renderGovernedConverterV2/);
  assert.match(output,/renderGovernedTrustCenterV2/);
  assert.match(output,/\.\/routes\/governed-utility-v2\.mjs/);
});

test('governed discovery module never generates market facts for unavailable capabilities',async()=>{
  const source=await read('apps/web/public/assets/routes/governed-discovery.mjs');
  assert.match(source,/No production market facts are substituted/);
  assert.match(source,/Fabricated observations<\/span><strong>0/);
  assert.match(source,/No production-safe sourced discovery universe is configured/);
  assert.match(source,/No production on-chain provider is configured/);
  assert.match(source,/No licensed global aggregate or prediction-market feed is configured/);
  assert.match(source,/No licensed news or external research corpus is configured/);
  assert.doesNotMatch(source,/Math\.sin|Math\.cos|demonstrationRows|fixture universe|qelly-fixture|simulated-demo/);
});

test('V2 converter derives only from governed ECB observations and fails closed without them',async()=>{
  const source=await read('apps/web/public/assets/routes/governed-utility-v2.mjs');
  assert.match(source,/\/api\/v1\/providers\/ecb\?capability=fx-reference-rates&symbol=EUR/);
  assert.match(source,/amount ÷ source-per-EUR × target-per-EUR/);
  assert.match(source,/\(input\/sourceRate\)\*targetRate/);
  assert.match(source,/Fabricated rate<\/span><strong>OFF/);
  assert.match(source,/Tradable<\/dt><dd>No/);
  assert.match(source,/No rate was generated/);
  assert.match(source,/unavailable-no-fabrication/);
  assert.doesNotMatch(source,/83\.12|151\.4|\.91|\.78/);
});

test('V2 Trust Center consumes the actual capability inventory shape',async()=>{
  const source=await read('apps/web/public/assets/routes/governed-utility-v2.mjs');
  assert.match(source,/Array\.isArray\(capabilities\.items\)\?capabilities\.items:\[\]/);
  assert.match(source,/capabilities\.unavailableCount\?\?unavailable\.length/);
  assert.match(source,/capabilities\.canonicalRuntime\|\|'cloudflare-pages-functions'/);
  assert.doesNotMatch(source,/capabilities\.unavailable\)/);
});

test('frontend build runs governed discovery finalization after canonical runtime finalization',async()=>{
  const pkg=JSON.parse(await read('package.json'));
  const command=pkg.scripts['build:frontend'];
  assert.ok(command.indexOf('finalize-public-runtime.mjs')<command.indexOf('finalize-governed-discovery.mjs'));
  assert.ok(command.indexOf('finalize-governed-discovery.mjs')<command.indexOf('finalize-public-seo.mjs'));
});