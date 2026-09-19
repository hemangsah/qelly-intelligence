import {readFile} from 'node:fs/promises';
import test from 'node:test';
import assert from 'node:assert/strict';
import {parseHashRoute} from '../apps/web/public/assets/hash-route-state.mjs';
import {onRequest} from '../functions/_middleware.js';

test('legacy methodology hash route resolves to canonical Qelly Verify',()=>{
  const parsed=parseHashRoute('#/methodology/verify');
  assert.equal(parsed.route,'qelly-verify');
  assert.equal(parsed.asset,null);
  assert.equal(parsed.queryText,'');
  assert.equal(parsed.query.toString(),'');
});

test('legacy methodology document path redirects before SPA asset resolution',async()=>{
  let nextCalls=0;
  const request=new Request('https://terminal.qellyintelligence.com/methodology/verify');
  const response=await onRequest({
    request,
    env:{QELLY_PUBLIC_RELEASE_SHA:'357c08c1fd5a25fd0c05d28e89d5609ac4b8078a'},
    next:async()=>{nextCalls+=1;return new Response('<html>unexpected</html>',{status:200});}
  });
  assert.equal(nextCalls,0);
  assert.equal(response.status,308);
  assert.equal(response.headers.get('location'),'https://terminal.qellyintelligence.com/#/qelly-verify');
  assert.equal(response.headers.get('x-content-type-options'),'nosniff');
  assert.equal(response.headers.get('x-qelly-release'),'357c08c1fd5a25fd0c05d28e89d5609ac4b8078a');
});


test('Verify bootstrap recognizes legacy methodology hash before app routing',async()=>{
  const source=await readFile(new URL('../apps/web/public/assets/qelly-verify-bootstrap.mjs',import.meta.url),'utf8');
  assert.match(source,/methodology\\\/verify/);
});

test('exact Pages Function owns the legacy methodology document path',async()=>{
  const {onRequest:legacyRoute}=await import('../functions/methodology/verify.js');
  const response=await legacyRoute({request:new Request('https://terminal.qellyintelligence.com/methodology/verify'),env:{QELLY_PUBLIC_RELEASE_SHA:'probe'}});
  assert.equal(response.status,308);
  assert.equal(response.headers.get('location'),'https://terminal.qellyintelligence.com/#/qelly-verify');
  assert.equal(response.headers.get('cache-control'),'no-store');
});
