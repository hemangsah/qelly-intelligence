import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {routeIdentityFor} from '../apps/web/public/assets/route-registry.mjs';

test('Wave CN browser evidence uses canonical SEO titles rather than legacy menu labels',async()=>{
  for(const [route,expected] of [
    ['calculator-center','Calculator Center'],
    ['theme-personas','Preferences & Themes'],
    ['qelly-verify','QELLY Verify']
  ]){
    const identity=routeIdentityFor(route);
    assert.equal(identity.seoTitle,expected+' · Qelly Intelligence');
    assert.notEqual(identity.seoTitle,identity.label+' · Qelly Intelligence');
  }
  const batch=await readFile(new URL('../scripts/release-a5-screen-batch-v2.py',import.meta.url),'utf8');
  const adapter=await readFile(new URL('../scripts/release-a5-screen-batch.py',import.meta.url),'utf8');
  assert.match(batch,/expected_title = definition\.get\('seoTitle'\)/);
  assert.equal((adapter.match(/definition\.get\('seoTitle'\)/g)||[]).length,2);
  assert.match(adapter,/detail_route_evidence/);
  const accessibility=await readFile(new URL('../scripts/release-a5-accessibility-check.py',import.meta.url),'utf8');
  assert.match(accessibility,/route_titles=\{item\['route'\]:item\.get\('seoTitle'\)/);
  assert.match(accessibility,/expected_title=route_titles\[route_key\]/);
});
