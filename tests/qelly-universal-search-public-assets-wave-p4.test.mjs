import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PUBLIC_CRYPTO_ASSETS,PUBLIC_CRYPTO_ASSET_MAP} from '../functions/_lib/public-market-assets.js';
import {buildUniversalSearch} from '../functions/_lib/public-search.js';

const read=(path)=>readFile(new URL(`../${path}`,import.meta.url),'utf8');

test('public market and Search share one six-asset canonical identity catalog',()=>{
  assert.deepEqual(PUBLIC_CRYPTO_ASSETS.map((asset)=>asset.symbol),['BTC','ETH','SOL','XRP','HYPE','DOGE']);
  assert.equal(PUBLIC_CRYPTO_ASSET_MAP.get('BTC')?.canonicalId,'QI-CRYPTO-BTC');
  assert.equal(PUBLIC_CRYPTO_ASSET_MAP.get('QI-CRYPTO-HYPE')?.symbol,'HYPE');
});

test('catalog-only Search never fabricates market observations',()=>{
  for(const asset of PUBLIC_CRYPTO_ASSETS){
    const result=buildUniversalSearch({q:asset.symbol,types:'asset',access:'public'});
    assert.ok(result.items.length>=1,`${asset.symbol} missing from public search`);
    const item=result.items.find((candidate)=>candidate.id===asset.canonicalId);
    assert.ok(item,`${asset.symbol} canonical ID missing`);
    assert.equal(item.truthState,'catalog');
    assert.equal(item.source,'Qelly public asset catalog');
    assert.equal(item.evidence.supportedPublicAsset,true);
    assert.equal(item.evidence.observedAt,null);
    assert.equal(item.evidence.priceUsd,null);
    assert.equal(item.evidence.change24hPct,null);
    assert.equal(item.evidence.rankingScore,null);
  }
});

test('public Asset Dossier resolves the same shared asset catalog',async()=>{
  const source=await read('functions/api/v1/public/markets/[[route]].js');
  assert.match(source,/PUBLIC_CRYPTO_ASSETS,PUBLIC_CRYPTO_ASSET_MAP/);
  assert.match(source,/const LIVE_ASSETS=PUBLIC_CRYPTO_ASSETS/);
  assert.match(source,/const LIVE_ASSET_MAP=PUBLIC_CRYPTO_ASSET_MAP/);
});

test('Universal Search exact retrieval does not wait on external ranking-provider work',async()=>{
  const source=await read('functions/api/v1/[[path]].js');
  const start=source.indexOf("if(path==='search'");
  const end=source.indexOf("if(path==='discovery/categories'",start);
  assert.ok(start>=0&&end>start);
  const block=source.slice(start,end);
  assert.doesNotMatch(block,/buildExternalMarketNetwork|buildAssetRankings|assetIntent|providerResult/);
  assert.match(block,/buildUniversalSearch/);
  assert.match(block,/s-maxage=60, stale-while-revalidate=300/);
});
