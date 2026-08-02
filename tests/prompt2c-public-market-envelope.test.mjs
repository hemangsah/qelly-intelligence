import test from 'node:test';
import assert from 'node:assert/strict';
import {__test} from '../functions/api/v1/[[path]].js';

test('public market provider envelopes expose canonical identities while preserving source provenance',()=>{
  const source={provider:'coinbase-exchange-public',truthState:'live_provider',observationTime:'2026-08-02T09:00:00.000Z',ingestionTime:'2026-08-02T09:00:02.000Z',attribution:'Coinbase Exchange public market data',data:{price:64820.12}};
  const result=__test.publicProviderEnvelope(source,'coinbase');
  assert.equal(result.provider,'coinbase');
  assert.equal(result.sourceProvider,'coinbase-exchange-public');
  assert.equal(result.truthState,'live');
  assert.equal(result.sourceTruthState,'live_provider');
  assert.equal(result.observedAt,source.observationTime);
  assert.equal(result.ingestedAt,source.ingestionTime);
  assert.deepEqual(result.data,source.data);
});

test('public truth states remain bounded and truthful',()=>{
  const vectors=new Map([
    ['live_provider','live'],
    ['cached_provider','live'],
    ['delayed_provider','delayed'],
    ['stale_provider','stale'],
    ['unavailable','unavailable'],
    ['unexpected-provider-state','unavailable']
  ]);
  for(const [source,expected] of vectors)assert.equal(__test.publicTruthState(source),expected);
});
