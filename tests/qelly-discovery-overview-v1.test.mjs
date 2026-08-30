import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {buildDiscoveryOverview,buildNetworkDiagnostics} from '../functions/_lib/market-network.js';

const read=(relative)=>readFile(new URL(`../${relative}`,import.meta.url),'utf8');
const sources=()=>({
  'alternative-me':{label:'Alternative.me',attribution:'Alternative.me',truthState:'live',observedAt:'2026-08-30T00:00:00Z',data:{assets:[{symbol:'BTC',change24hPct:2.5},{symbol:'ETH',change24hPct:-1.2},{symbol:'SOL',change24hPct:0}],sentiment:{value:61,classification:'Greed',timestamp:'2026-08-30T00:00:00Z'}}},
  hyperliquid:{label:'Hyperliquid',attribution:'Hyperliquid public API',truthState:'cached',observedAt:'2026-08-30T00:01:00Z',data:[{symbol:'BTC',mid:65000},{symbol:'ETH',mid:2500}]},
  ecb:{label:'ECB',attribution:'European Central Bank',truthState:'delayed',observedAt:'2026-08-29T16:00:00Z',data:{rates:{USD:1.2,INR:100,GBP:.86}}},
  'world-bank':{label:'World Bank',attribution:'World Bank Indicators API',truthState:'delayed',data:[{countryId:'IND',year:'2025',gdpGrowthPct:6.8},{countryId:'USA',year:'2025',gdpGrowthPct:2.1},{countryId:'CHN',year:'2025',gdpGrowthPct:4.7}]},
  imf:{label:'IMF',attribution:'International Monetary Fund',truthState:'delayed',data:[{countryId:'IND',year:'2026',growthPct:6.4,estimateOrProjection:true},{countryId:'USA',year:'2026',growthPct:2.0,estimateOrProjection:true}]}
});

test('Discovery Overview derives four distinct source-backed lenses without ranking or execution',()=>{
  const fixture=sources();
  const result=buildDiscoveryOverview(fixture,buildNetworkDiagnostics(fixture));
  assert.equal(result.version,'governed-theme-framing-v1');
  assert.equal(result.lenses.length,4);
  assert.equal(result.lenses.every((lens)=>lens.ready),true);
  assert.deepEqual(result.lenses.map((lens)=>lens.id),['risk-appetite','crypto-breadth','currency-conditions','growth-divergence']);
  const risk=result.lenses.find((lens)=>lens.id==='risk-appetite');
  assert.equal(risk.observations.find((item)=>item.label==='Advancing assets in source sample').value,1);
  assert.equal(risk.observations.find((item)=>item.label==='Declining assets in source sample').value,1);
  const currency=result.lenses.find((lens)=>lens.id==='currency-conditions');
  assert.equal(currency.observations.find((item)=>item.label==='USD / INR derived cross-reference').value,100/1.2);
  assert.deepEqual(result.boundaries,{ranking:false,search:false,singleAssetAnalysis:false,execution:false,fabricatedFallback:false});
  assert.equal(result.readiness.availableLenses,4);
  assert.equal(result.sourceLedger.length,5);
});

test('Discovery Overview fails closed when governed observations are unavailable',()=>{
  const degraded=Object.fromEntries(Object.keys(sources()).map((id)=>[id,{label:id,truthState:'unavailable',data:null}]));
  const result=buildDiscoveryOverview(degraded,buildNetworkDiagnostics(degraded));
  assert.equal(result.readiness.availableLenses,0);
  assert.equal(result.lenses.every((lens)=>lens.ready===false),true);
  assert.equal(result.readiness.sourceCounts.unavailable,5);
  assert.equal(result.boundaries.fabricatedFallback,false);
});

test('Discovery Overview production renderer owns theme framing and working brief interactions',async()=>{
  const [route,handler,finalizer]=await Promise.all([
    read('apps/web/public/assets/routes/discovery-overview.mjs'),
    read('functions/api/v1/[[path]].js'),
    read('scripts/finalize-governed-discovery.mjs')
  ]);
  for(const phrase of ['Unique job · theme framing','Choose the theme lens','Build a discovery brief','Cross-lens map','Evidence ledger','Purpose boundary'])assert.match(route,new RegExp(phrase));
  for(const marker of ['data-lens','data-evidence-id','data-brief-horizon','data-action="generate-brief"','data-source-toggle','data-map-lens'])assert.match(route,new RegExp(marker));
  for(const distinction of ['Global Market Network','Asset Rankings','Universal Search','Asset Intelligence'])assert.match(route,new RegExp(distinction));
  assert.match(route,/up to five observations/);
  assert.match(route,/active=next;\s*selected\.clear\(\);/);
  assert.match(route,/Evidence re-scoped to this lens/);
  assert.match(route,/const chosen=\(active\?\.observations\|\|\[\]\)\.filter/);
  assert.doesNotMatch(route,/const chosen=lenses\.flatMap/);
  assert.match(route,/does not rank assets, duplicate universal search, publish a thesis or execute a trade/);
  assert.match(handler,/discoveryOverview:buildDiscoveryOverview\(sources,networkDiagnostics\)/);
  assert.match(finalizer,/renderDiscoveryOverview/);
  assert.doesNotMatch(finalizer,/renderGovernedUnavailable\(main,\{api,pageHead,stateBanner,escapeHtml,navigate,toast,state\},'discovery-hub'\)/);
});

test('Discovery Overview is container-responsive and offline packaged',async()=>{
  const [route,css,worker]=await Promise.all([
    read('apps/web/public/assets/routes/discovery-overview.mjs'),
    read('apps/web/public/assets/routes/discovery-overview.css'),
    read('apps/web/public/qelly-service-worker.js')
  ]);
  assert.match(route,/data-discovery-experience="theme-framing-v1"/);
  assert.match(route,/discovery-overview\.css\?v=20260830-discovery1/);
  assert.match(css,/container-type:inline-size/);
  assert.match(css,/@container \(max-width:1000px\)/);
  assert.match(css,/@container \(max-width:680px\)/);
  assert.match(css,/@container \(max-width:420px\)/);
  assert.match(css,/repeat\(auto-fit,minmax\(150px,1fr\)\)/);
  assert.doesNotMatch(css,/visibility\s*:\s*hidden/);
  assert.match(worker,/assets\/routes\/discovery-overview\.css/);
  assert.match(worker,/assets\/routes\/discovery-overview\.mjs/);
});
