import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {__watchlistTest,watchlistItemToUi,watchlistToUi} from '../functions/_lib/watchlists.js';
import {__watchlistRouteTest} from '../functions/api/v1/workspace/watchlists/[[route]].js';
import {matchUnavailableCapability} from '../functions/_lib/capability-registry.js';

const {safeInstrumentRef,instrumentDescriptor,quoteUnavailable}=__watchlistTest;

test('watchlist canonical instrument validation remains bounded and deterministic',()=>{
  assert.equal(safeInstrumentRef('qi-crypto-btc'),'QI-CRYPTO-BTC');
  assert.throws(()=>safeInstrumentRef('BTC'),/invalid/);
  assert.throws(()=>safeInstrumentRef('../secret'),/invalid/);
  assert.deepEqual(instrumentDescriptor('QI-CRYPTO-BTC'),{symbol:'BTC',name:'Bitcoin',assetClass:'crypto'});
  assert.deepEqual(instrumentDescriptor('QI-FX-USDINR'),{symbol:'USDINR',name:'USD / INR',assetClass:'fx'});
});

test('watchlist UI mapping separates real cloud persistence from unavailable quote truth',()=>{
  const item=watchlistItemToUi({id:'22222222-2222-4222-8222-222222222222',instrument_ref:'QI-EQUITY-AAPL',instrument_type:'equity',notes:'Earnings review',tags:['earnings'],rationale:{},metadata:{group:'Research queue'},created_at:'2026-08-16T00:00:00Z',updated_at:'2026-08-16T00:00:00Z'});
  assert.equal(item.symbol,'AAPL');
  assert.equal(item.truthState,'CLOUD RLS');
  assert.equal(item.quote.truthState,'UNAVAILABLE');
  assert.equal(item.quote.price,null);
  assert.equal(item.quote.provider,null);
  assert.match(item.quote.attribution,/No rights-approved quote observation/);
  const mapped=watchlistToUi({id:'11111111-1111-4111-8111-111111111111',name:'Research',description:'Desk list',settings:{},created_at:'2026-08-16T00:00:00Z',updated_at:'2026-08-16T00:30:00Z'},[{
    id:'22222222-2222-4222-8222-222222222222',instrument_ref:'QI-EQUITY-AAPL',notes:'Earnings review',tags:[],rationale:{},metadata:{},created_at:'2026-08-16T00:00:00Z',updated_at:'2026-08-16T00:00:00Z'
  }]);
  assert.equal(mapped.persistence,'CLOUD RLS');
  assert.equal(mapped.cloudSync,true);
  assert.equal(mapped.quoteTruthState,'UNAVAILABLE');
  assert.equal(mapped.items.length,1);
});

test('unavailable quote envelope never contains simulated market values',()=>{
  const quote=quoteUnavailable();
  assert.equal(quote.price,null);
  assert.equal(quote.change24h,null);
  assert.equal(quote.observedAt,null);
  assert.equal(quote.truthState,'UNAVAILABLE');
});

test('nested Cloudflare watchlist route preserves exact path segments',()=>{
  assert.equal(__watchlistRouteTest.routePath({params:{route:'11111111-1111-4111-8111-111111111111'}}),'11111111-1111-4111-8111-111111111111');
  assert.equal(__watchlistRouteTest.routePath({params:{route:['11111111-1111-4111-8111-111111111111','items','QI-CRYPTO-BTC']}}),'11111111-1111-4111-8111-111111111111/items/QI-CRYPTO-BTC');
  assert.equal(__watchlistRouteTest.routePath({request:new Request('https://qelly.test/api/v1/workspace/watchlists'),params:{route:['watchlists']}}),'');
});

test('Cloudflare watchlist implementation uses authenticated user-token RLS and mutation protections',async()=>{
  const [service,rootRoute,nestedRoute,ui]=await Promise.all([
    readFile(new URL('../functions/_lib/watchlists.js',import.meta.url),'utf8'),
    readFile(new URL('../functions/api/v1/workspace/watchlists.js',import.meta.url),'utf8'),
    readFile(new URL('../functions/api/v1/workspace/watchlists/[[route]].js',import.meta.url),'utf8'),
    readFile(new URL('../apps/web/public/assets/routes/workspace-watchlist.mjs',import.meta.url),'utf8')
  ]);
  assert.match(service,/qelly_watchlists/);
  assert.match(service,/qelly_watchlist_items/);
  assert.match(service,/restRequest\(env,session\.accessToken/);
  assert.match(service,/requireCsrf\(request\)/);
  assert.doesNotMatch(service,/service[_ -]?role|SUPABASE_SERVICE/i);
  assert.match(rootRoute,/requireOrigin\(request,env\)/);
  assert.match(nestedRoute,/requireOrigin\(request,env\)/);
  assert.match(ui,/data-watchlist-persistence="CLOUD RLS"/);
  assert.match(ui,/data-watchlist-quote-truth="UNAVAILABLE"/);
  assert.match(ui,/Prices and daily changes will appear only when an approved market-data source is connected/i);
  assert.match(ui,/SECURE CLOUD/);
  assert.doesNotMatch(ui,/local JSON|Watchlist created locally|fixture quotes/i);
  assert.equal(matchUnavailableCapability('workspace/watchlists'),null);
});
