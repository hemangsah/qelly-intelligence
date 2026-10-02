import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {isPublicApiRequestPath} from '../src/server/api-access-policy.mjs';
const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');
test('Trust Center anonymous first paint never requests private saved workspaces',async()=>{
 const app=await read('apps/web/public/assets/app.js');
 const start=app.indexOf('async function renderTrustCenter(main)'),end=app.indexOf('\n\nasync function renderSecurityEvidence',start);
 assert.ok(start>0&&end>start);
 const block=app.slice(start,end);
 assert.match(block,/state\.authenticated===true\?api\('\/api\/v1\/discovery\/saved'\)\.catch\(\(\)=>null\):Promise\.resolve\(null\)/);
 assert.match(block,/const savedReady=Array\.isArray\(saved\?\.savedSearches\)&&Array\.isArray\(saved\?\.savedScreens\)/);
 assert.match(block,/savedReady\?saved\.savedSearches\.length\+saved\.savedScreens\.length:'—'/);
 assert.match(block,/Sign in to inspect saved research/);
 assert.equal((block.match(/<article class="q-kpi">/g)||[]).length,4);
 assert.doesNotMatch(block,/api\('\/api\/v1\/discovery\/saved'\)\]\)/);
});
test('saved research endpoint stays private even while public Trust Center is anonymous',()=>{
 assert.equal(isPublicApiRequestPath('/api/v1/discovery/saved'),false);
 assert.equal(isPublicApiRequestPath('/api/v1/discovery/saved/searches'),false);
 for(const path of ['/api/v1/discovery/methodologies','/api/v1/discovery/coverage','/api/v1/discovery/status'])assert.equal(isPublicApiRequestPath(path),true);
});
test('governed fallback never shows the retired Market Command product name',async()=>{
 const src=await read('apps/web/public/assets/routes/governed-discovery.mjs');
 assert.doesNotMatch(src,/Open Market Command/);
 assert.match(src,/Open market overview/);
});
