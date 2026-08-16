import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {capabilityInventory,matchUnavailableCapability,unavailableCapabilities} from '../functions/_lib/capability-registry.js';

test('canonical capability debt is explicit, reasoned and never presented as implemented',()=>{
  assert.ok(unavailableCapabilities.length>=20);
  for(const item of unavailableCapabilities){
    assert.equal(item.state,'UNAVAILABLE');
    assert.equal(item.canonicalRuntime,'cloudflare-pages-functions');
    assert.ok(item.id.length>2);
    assert.ok(item.label.length>4);
    assert.ok(item.reason.length>20);
    assert.ok(item.routeFamilies.length>=1);
    assert.ok(['critical','high','medium','low'].includes(item.priority));
  }
  const inventory=capabilityInventory();
  assert.equal(inventory.truthState,'AUDIT');
  assert.equal(inventory.unavailableCount,unavailableCapabilities.length);
});

test('registry matches capability debt without shadowing promoted runtime families',()=>{
  assert.equal(matchUnavailableCapability('auth/mfa/status')?.id,'mfa');
  assert.equal(matchUnavailableCapability('research/workspaces'),null);
  assert.equal(matchUnavailableCapability('research/workspaces/abc/items'),null);
  assert.equal(matchUnavailableCapability('workspace/watchlists'),null);
  assert.equal(matchUnavailableCapability('workspace/watchlists/abc/items'),null);
  assert.equal(matchUnavailableCapability('providers/runtime'),null);
  assert.equal(matchUnavailableCapability('public/providers'),null);
  assert.equal(matchUnavailableCapability('sessions/remote-session-id')?.id,'remote-session-control');
  assert.equal(matchUnavailableCapability('portfolio/risk')?.id,'portfolio');
  assert.equal(matchUnavailableCapability('platform/readiness'),null);
  assert.equal(matchUnavailableCapability('live-markets/candles'),null);
  assert.equal(matchUnavailableCapability('saved-calculations'),null);
  assert.equal(matchUnavailableCapability('admin/anything'),null);
});

test('Cloudflare catch-all returns governed 501 capability evidence before generic route-not-found',async()=>{
  const source=await readFile(new URL('../functions/api/v1/[[path]].js',import.meta.url),'utf8');
  assert.match(source,/capabilityInventory,matchUnavailableCapability/);
  assert.match(source,/path==='platform\/capabilities'/);
  assert.match(source,/capability_unavailable_in_canonical_runtime/);
  assert.match(source,/truthState:'UNAVAILABLE'/);
  const unavailableIndex=source.indexOf('const unavailable=matchUnavailableCapability(path)');
  const routeNotFoundIndex=source.indexOf("throw new HttpError(404,'route_not_found'");
  const handleDataIndex=source.indexOf('const data=await handleData');
  assert.ok(handleDataIndex>=0&&unavailableIndex>handleDataIndex,'implemented data handlers must run before unavailable fallback');
  assert.ok(routeNotFoundIndex>unavailableIndex,'generic 404 must remain after explicit capability-debt handling');
});

test('capability inventory contains no secret values or credential-shaped fields',()=>{
  const serialized=JSON.stringify(capabilityInventory()).toLowerCase();
  assert.doesNotMatch(serialized,/private[_ -]?key|recovery phrase|access[_ -]?token|refresh[_ -]?token|service[_ -]?role|password\s*[:=]/);
});
