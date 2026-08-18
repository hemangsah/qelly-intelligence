import test from 'node:test';
import assert from 'node:assert/strict';
import {__test} from '../functions/_lib/market-network.js';

const {cachedSource,edgeCacheRequest,sourceTruthState,SOURCE_CACHE_TTL}=__test;

function installCache(cache){
  const previous=Object.getOwnPropertyDescriptor(globalThis,'caches');
  Object.defineProperty(globalThis,'caches',{configurable:true,writable:true,value:{default:cache}});
  return ()=>{
    if(previous)Object.defineProperty(globalThis,'caches',previous);
    else delete globalThis.caches;
  };
}

function memoryCache(){
  const store=new Map();
  return {
    store,
    async match(request){
      const response=store.get(request.url);
      return response?response.clone():undefined;
    },
    async put(request,response){store.set(request.url,response.clone());}
  };
}

test('edge cache key is synthetic and stays on the canonical request origin',()=>{
  const request=edgeCacheRequest({request:new Request('https://qelly-intelligence.pages.dev/api/v1/market/network')},'hyperliquid');
  assert.equal(request.method,'GET');
  assert.equal(new URL(request.url).origin,'https://qelly-intelligence.pages.dev');
  assert.equal(new URL(request.url).pathname,'/__qelly-edge-cache/market-network/hyperliquid/v2');
});

test('successful external source is cached and cache hit is never labelled live',async()=>{
  const cache=memoryCache();
  const restore=installCache(cache);
  const waits=[];
  const context={request:new Request('https://qelly-intelligence.pages.dev/api/v1/market/network'),waitUntil(promise){waits.push(promise);}};
  let loads=0;
  const loader=async()=>{loads+=1;return {id:'hyperliquid',label:'Hyperliquid',state:'live_external_reference',observedAt:'2026-08-18T18:00:00.000Z',data:[{symbol:'BTC',mid:60000}]};};
  try{
    const first=await cachedSource(context,'hyperliquid',SOURCE_CACHE_TTL.hyperliquid,loader);
    assert.equal(first.delivery.edgeCache,'miss');
    assert.equal(first.truthState,'live');
    await Promise.all(waits);
    const second=await cachedSource(context,'hyperliquid',SOURCE_CACHE_TTL.hyperliquid,loader);
    assert.equal(loads,1);
    assert.equal(second.delivery.edgeCache,'hit');
    assert.equal(second.truthState,'cached');
    assert.equal(second.data[0].symbol,'BTC');
  }finally{restore();}
});

test('unavailable source is never written to edge cache',async()=>{
  const cache=memoryCache();
  const restore=installCache(cache);
  const context={request:new Request('https://qelly-intelligence.pages.dev/api/v1/market/network'),waitUntil(){}};
  let loads=0;
  const loader=async()=>{loads+=1;return {id:'hyperliquid',label:'Hyperliquid',state:'unavailable',truthState:'unavailable',data:null};};
  try{
    const first=await cachedSource(context,'hyperliquid',SOURCE_CACHE_TTL.hyperliquid,loader);
    const second=await cachedSource(context,'hyperliquid',SOURCE_CACHE_TTL.hyperliquid,loader);
    assert.equal(loads,2);
    assert.equal(cache.store.size,0);
    assert.equal(first.truthState,'unavailable');
    assert.equal(second.truthState,'unavailable');
  }finally{restore();}
});

test('reference data keeps delayed truth semantics while live cache hits become cached',()=>{
  assert.equal(sourceTruthState({state:'reference_external',data:[1]},'miss'),'delayed');
  assert.equal(sourceTruthState({state:'reference_external',data:[1]},'hit'),'delayed');
  assert.equal(sourceTruthState({state:'live_external_reference',data:[1]},'miss'),'live');
  assert.equal(sourceTruthState({state:'live_external_reference',data:[1]},'hit'),'cached');
});
