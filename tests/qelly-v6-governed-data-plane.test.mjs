import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {__marketDataSnapshotTest} from '../functions/_lib/market-data-snapshot.js';
import {matchUnavailableCapability} from '../functions/_lib/capability-registry.js';

const read=(path)=>readFile(new URL(`../${path}`,import.meta.url),'utf8');

test('market snapshot helpers clamp reads and filter normalized instruments deterministically',()=>{
  const {snapshotLimit,filterSnapshotItems}=__marketDataSnapshotTest;
  assert.equal(snapshotLimit(0),100);
  assert.equal(snapshotLimit(999),200);
  assert.equal(snapshotLimit(25),25);
  const rows=[
    {symbol:'EURUSD',canonicalKey:'fx:eur:usd',displayName:'Euro / USD',assetClass:'fx',baseAsset:'EUR',quoteAsset:'USD',venue:'ECB'},
    {symbol:'BTCUSD',canonicalKey:'crypto:btc:usd',displayName:'Bitcoin',assetClass:'crypto',baseAsset:'BTC',quoteAsset:'USD',venue:'Example'}
  ];
  assert.deepEqual(filterSnapshotItems(rows,{assetClass:'fx'}).map(item=>item.symbol),['EURUSD']);
  assert.deepEqual(filterSnapshotItems(rows,{symbol:'eurusd'}).map(item=>item.symbol),['EURUSD']);
  assert.deepEqual(filterSnapshotItems(rows,{query:'euro'}).map(item=>item.symbol),['EURUSD']);
});

test('instrument and data-quality families are promoted while unimplemented time-series streaming stays fail-closed',()=>{
  assert.equal(matchUnavailableCapability('instruments'),null);
  assert.equal(matchUnavailableCapability('instruments/EURUSD'),null);
  assert.equal(matchUnavailableCapability('data-quality/status'),null);
  assert.equal(matchUnavailableCapability('data-quality/events'),null);
  assert.equal(matchUnavailableCapability('timeseries/EURUSD')?.id,'streams-timeseries');
  assert.equal(matchUnavailableCapability('streams/market')?.id,'streams-timeseries');
});

test('governed snapshot RPC is authenticated, read-only and does not expose raw provider-cache payloads',async()=>{
  const migration=await read('supabase/migrations/20260816015249_qelly_market_data_snapshot_rpc_v1.sql');
  assert.match(migration,/security definer/i);
  assert.match(migration,/auth\.uid\(\)/);
  assert.match(migration,/revoke all on function public\.qelly_market_data_snapshot\(integer\) from anon/i);
  assert.match(migration,/grant execute on function public\.qelly_market_data_snapshot\(integer\) to authenticated/i);
  assert.match(migration,/providerCacheCount/);
  assert.doesNotMatch(migration,/'payload'\s*,/i);
  assert.doesNotMatch(migration,/insert\s+into|update\s+public\.|delete\s+from/i);
});

test('Cloudflare exposes normalized market health through the constrained RPC rather than privileged raw-table reads',async()=>{
  const [helper,dataPlane,instruments,quality]=await Promise.all([
    read('functions/_lib/market-data-snapshot.js'),
    read('functions/api/v1/platform/data-plane.js'),
    read('functions/api/v1/instruments/[[route]].js'),
    read('functions/api/v1/data-quality/[[route]].js')
  ]);
  assert.match(helper,/rpc\/qelly_market_data_snapshot/);
  assert.match(helper,/method:'POST'/);
  assert.match(dataPlane,/resolveSession\(request,env,\{required:true\}\)/);
  assert.match(dataPlane,/rawProviderCacheExposed:false/);
  assert.match(instruments,/Instrument endpoints are read-only/);
  assert.match(quality,/Data-quality endpoints are read-only/);
  for(const source of [dataPlane,instruments,quality]){
    assert.doesNotMatch(source,/qelly_provider_cache\?/);
    assert.doesNotMatch(source,/SUPABASE_SERVICE_ROLE_KEY/);
  }
});

test('ECB provider ingestion is scheduler-only and the scheduler source contains no plaintext credential',async()=>{
  const [edge,scheduler]=await Promise.all([
    read('supabase/functions/qelly-provider-ingestion/index.ts'),
    read('supabase/migrations/20260816021000_qelly_schedule_ecb_provider_ingestion_v2.sql')
  ]);
  assert.match(edge,/INTERNAL_INGESTION_AUTH_REQUIRED/);
  assert.match(edge,/INTERNAL_KEY_SHA256/);
  assert.doesNotMatch(edge,/admin\.auth\.getUser/);
  assert.doesNotMatch(edge,/authorization.*Bearer/i);
  assert.match(edge,/commercial_rights_status!=="allowed"/);
  assert.match(edge,/redistribution_rights_status!=="allowed"/);
  assert.match(scheduler,/vault\.decrypted_secrets/);
  assert.match(scheduler,/qelly_provider_ingestion_key/);
  assert.doesNotMatch(scheduler,/vault\.create_secret/i);
  assert.doesNotMatch(scheduler,/[A-Za-z0-9_-]{56,}/);
});

test('Market Command renders first-party governed ECB observations separately from TradingView display-only data',async()=>{
  const source=await read('apps/web/public/assets/qelly-external-market-surfaces.mjs');
  assert.match(source,/\/api\/v1\/platform\/data-plane\?limit=200/);
  assert.match(source,/ECB reference-rate data plane/);
  assert.match(source,/not simulated/);
  assert.match(source,/TradingView market visualization/);
  assert.match(source,/values never feed Qelly calculations, risk, alerts or decisions/);
  assert.doesNotMatch(source,/api\.binance\.com|api\.exchange\.coinbase\.com/);
});
