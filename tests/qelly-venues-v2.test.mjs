import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {buildPublicVenues} from '../functions/_lib/public-venues.js';

const read=(path)=>readFile(new URL(`../${path}`,import.meta.url),'utf8');

const directory=[
  {id:'hyperliquid-exchange',name:'Hyperliquid Exchange',category:'exchange',integration:'broker-or-exchange',url:'https://hyperliquid.xyz',source:'provider-directory',note:'Official destination only.'},
  {id:'binance',name:'Binance',category:'exchange',integration:'broker-or-exchange',url:'https://binance.com',source:'provider-directory',note:'Official destination only.'},
  {id:'coinbase',name:'Coinbase',category:'exchange',integration:'broker-or-exchange',url:'https://coinbase.com',source:'provider-directory',note:'Official destination only.'},
  {id:'interactive-brokers',name:'Interactive Brokers',category:'broker',integration:'broker-or-exchange',url:'https://interactivebrokers.com',source:'provider-directory',note:'Official destination only.'},
  {id:'irrelevant',name:'Not a venue',category:'data',integration:'reference',url:'https://example.com',source:'provider-directory',note:'Excluded.'}
];

const providerPolicies=[
  {id:'binance',enabled:false,capabilities:['market-data'],termsState:'rights-review',reason:'Display approval required.',termsUrl:'https://binance.com/terms'},
  {id:'coinbase',enabled:false,capabilities:['market-data'],termsState:'rights-review',reason:'Display approval required.',termsUrl:'https://coinbase.com/legal'}
];

const sources={hyperliquid:{label:'Hyperliquid public API',truthState:'live',observedAt:'2026-08-31T10:00:00.000Z',usage:'Read-only public observations.',docsUrl:'https://hyperliquid.gitbook.io',data:[{symbol:'BTC'},{symbol:'ETH'},{symbol:'BTC'}]}};

test('venue intelligence classifies governed integration truth without scoring venues',()=>{
  const result=buildPublicVenues({directory,providerPolicies,sources});
  assert.equal(result.version,'governed-venue-intelligence-v1');
  assert.equal(result.state,'available');
  assert.equal(result.summary.total,4);
  assert.deepEqual(result.summary.byType,{exchange:3,broker:1});
  assert.equal(result.summary.observationReady,1);
  assert.equal(result.summary.rightsReview,2);
  assert.equal(result.summary.directoryOnly,1);
  assert.equal(result.boundaries.noVenueRanking,true);
  assert.equal(result.boundaries.noExecution,true);
  assert.equal(result.boundaries.fabricatedFallback,false);

  const hyperliquid=result.venues.find((venue)=>venue.id==='hyperliquid-exchange');
  assert.equal(hyperliquid.stage.id,'read-only-observation');
  assert.deepEqual(hyperliquid.observation.symbols,['BTC','ETH']);
  assert.equal(hyperliquid.capabilities.customerDisplay,true);
  assert.equal(hyperliquid.capabilities.execution,false);

  const binance=result.venues.find((venue)=>venue.id==='binance');
  assert.equal(binance.stage.id,'rights-review');
  assert.equal(binance.policy.enabled,false);
  assert.ok(binance.missingEvidence.includes('Written end-user display permission'));

  const broker=result.venues.find((venue)=>venue.id==='interactive-brokers');
  assert.equal(broker.stage.id,'directory-only');
  assert.match(broker.useCase,/broker coverage/i);
  assert.equal(result.permissionMatrix.every((row)=>row.execution===false&&row.account===false),true);
});

test('venue intelligence fails closed when the observation source is unavailable',()=>{
  const result=buildPublicVenues({directory,providerPolicies,sources:{hyperliquid:{truthState:'unavailable',data:null}}});
  const venue=result.venues.find((item)=>item.id==='hyperliquid-exchange');
  assert.equal(venue.stage.id,'directory-only');
  assert.equal(venue.observation.count,0);
  assert.equal(venue.capabilities.readOnlyObservations,false);
  assert.equal(result.summary.observationReady,0);
  assert.equal(result.permissionMatrix.find((row)=>row.id==='hyperliquid').display,false);
});

test('public Venues API and route are wired through the production boundary',async()=>{
  const [handler,policy,app,registry,finalizer,worker,openapi]=await Promise.all([
    read('functions/api/v1/[[path]].js'),read('src/server/api-access-policy.mjs'),read('apps/web/public/assets/app.js'),read('apps/web/public/assets/route-registry.mjs'),read('scripts/finalize-governed-discovery.mjs'),read('apps/web/public/qelly-service-worker.js'),read('packages/openapi/qelly.openapi.json')
  ]);
  assert.match(handler,/path==='discovery\/venues'&&readMethod\(method\)/);
  assert.match(handler,/buildPublicVenues/);
  assert.match(policy,/'\/api\/v1\/discovery\/venues'/);
  assert.match(app,/renderVenuesWorkspace=lazyRoute\('\.\/routes\/venues\.mjs','renderVenues'\)/);
  assert.match(app,/case 'venues': await renderVenuesWorkspace/);
  assert.match(registry,/route:'venues'.*public:true/);
  assert.doesNotMatch(finalizer,/unavailable\('venues'\)/);
  assert.match(worker,/\.\/assets\/routes\/venues\.mjs/);
  assert.match(worker,/\.\/assets\/routes\/venues-v2\.css/);
  const contract=JSON.parse(openapi).paths['/api/v1/discovery/venues'].get.responses;
  assert.deepEqual(Object.keys(contract).sort(),['200','429']);
});

test('Venues UI states its unique job and retains responsive, fail-closed behavior',async()=>{
  const [source,css]=await Promise.all([read('apps/web/public/assets/routes/venues.mjs'),read('apps/web/public/assets/routes/venues-v2.css')]);
  assert.match(source,/data-venues-experience="market-access-intelligence-v1"/);
  assert.match(source,/Unique job · market-access intelligence/);
  assert.match(source,/Capability comparison—not a venue leaderboard/);
  assert.match(source,/No venue rankings, liquidity claims, or fixture scores were substituted/);
  assert.match(source,/account, routing, execution and custody disabled/);
  assert.match(source,/data-venue-search/);
  assert.match(source,/data-venue-compare/);
  assert.match(source,/Evidence still required/);
  assert.match(css,/@container \(max-width:1180px\)/);
  assert.match(css,/@container \(max-width:680px\)/);
  assert.match(css,/@container \(max-width:460px\)/);
  assert.match(css,/@media\(max-width:680px\)/);
  assert.doesNotMatch(css,/visibility\s*:\s*hidden/);
});
