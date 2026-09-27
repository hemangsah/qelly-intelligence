import test from 'node:test';
import assert from 'node:assert/strict';
import {decisionAssetCapabilities,DECISION_ASSET_SYMBOLS,DECISION_ASSET_SET} from '../functions/_lib/decision-asset-capabilities.js';
import {onRequest as decisionAssetsEndpoint} from '../functions/api/v1/decision-assets.js';
import {DECISION_SCAN_ASSETS} from '../functions/api/v1/decision-scan.js';

test('Wave BX capability authority exposes only real current Decision assets as selectable',()=>{
  const catalog=decisionAssetCapabilities();
  assert.equal(catalog.schemaVersion,'qelly.decision-asset-capabilities/1.0.0');
  assert.equal(catalog.authority,'decision-runtime-capability-contract');
  assert.deepEqual(DECISION_ASSET_SYMBOLS,['BTC','ETH','SOL','HYPE','XRP','DOGE']);
  assert.deepEqual(DECISION_SCAN_ASSETS,DECISION_ASSET_SYMBOLS);
  assert.equal(catalog.supportedAssetCount,6);
  const crypto=catalog.groups.find((group)=>group.id==='crypto');
  assert.equal(crypto.state,'SUPPORTED');
  assert.equal(crypto.selectable,true);
  assert.equal(crypto.provider.id,'hyperliquid-public');
  assert.equal(crypto.assets.length,6);
  assert.ok(crypto.assets.every((asset)=>asset.selectable&&DECISION_ASSET_SET.has(asset.symbol)));
  assert.ok(crypto.assets.every((asset)=>asset.supportedTimeframes.includes('15m')));
});

test('Wave BX keeps non-Decision categories visible but non-selectable and preserves provider boundaries',()=>{
  const catalog=decisionAssetCapabilities();
  const forex=catalog.groups.find((group)=>group.id==='forex');
  assert.equal(forex.state,'REFERENCE_ONLY');
  assert.equal(forex.selectable,false);
  assert.equal(forex.provider.id,'ecb');
  assert.match(forex.reason,/reference.*only/i);
  for(const id of ['indian-indices','indian-equities','global-equities','metals','commodities','global-indices']){
    const group=catalog.groups.find((item)=>item.id===id);
    assert.ok(group);
    assert.equal(group.selectable,false);
    assert.equal(group.state,'UNAVAILABLE');
    assert.deepEqual(group.assets,[]);
  }
  assert.equal(catalog.guardrails.referenceDataDoesNotImplyDecisionSupport,true);
  assert.equal(catalog.guardrails.providerRightsBoundariesPreserved,true);
});

test('Wave BX public capability endpoint is cacheable, read-only and truthful',async()=>{
  const request=new Request('https://terminal.qellyintelligence.com/api/v1/decision-assets');
  const response=await decisionAssetsEndpoint({request,env:{},next:()=>new Response(null,{status:405})});
  assert.equal(response.status,200);
  assert.match(response.headers.get('cache-control'),/max-age=60/);
  const body=await response.json();
  assert.equal(body.truthState,'AUDIT');
  assert.equal(body.selectableSymbols.length,6);
  assert.ok(new Date(body.generatedAt).getTime()>0);
});
