import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {isPublicApiContractRoute,isPublicApiRequestPath} from '../src/server/api-access-policy.mjs';
const routes=['overview','rankings','prediction-markets','news','research','methodologies','coverage','status'].map(x=>'/api/v1/discovery/'+x);
const detail=['categories/digital-assets','venues/venue-coinbase-fixture','dex/pair-btc','research/research-cross-asset-regime','methodologies/risk-appetite'].map(x=>'/api/v1/discovery/'+x);
test('previously authenticated public research pages have explicitly public read-only legacy API paths',()=>{
  for(const endpoint of [...routes,...detail])assert.equal(isPublicApiRequestPath(endpoint),true,endpoint);
});
test('discovery saved workspace and mutation routes remain private',()=>{
  for(const endpoint of ['/api/v1/discovery/saved','/api/v1/discovery/saved/searches','/api/v1/discovery/saved/screens','/api/v1/asset-intelligence/layouts','/api/v1/imports/commit'])assert.equal(isPublicApiRequestPath(endpoint),false,endpoint);
  assert.equal(isPublicApiContractRoute('/api/v1/discovery/research/:id'),true);
  assert.equal(isPublicApiContractRoute('/api/v1/discovery/saved'),false);
});
test('evidence runtime owns public anonymous bootstrap but does not invent production account access',async()=>{
  const src=await readFile(new URL('../scripts/release-a5-evidence-server.mjs',import.meta.url),'utf8');
  assert.match(src,/url.pathname==='\/api\/v1\/bootstrap'/);
  assert.match(src,/evidenceBoundary:'isolated-public-bootstrap-fixture'/);
  assert.match(src,/if\(!hasEvidenceSession\(request\)\)return sessionRequired\(response,'The evidence profile contract/);
  assert.match(src,/if\(!hasEvidenceSession\(request\)\)return sessionRequired\(response,'The evidence data-plane contract/);
});
