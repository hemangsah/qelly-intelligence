import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {routeDefinitions} from '../apps/web/public/assets/route-registry.mjs';
const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');
test('all downstream evidence workflows derive the canonical inventory from registered routes',async()=>{
 const paths=['.github/workflows/accessibility.yml','.github/workflows/verify-evidence.yml','.github/workflows/production-shell.yml'];
 const workflows=await Promise.all(paths.map(read));
 assert.ok(routeDefinitions.length>=72);
 assert.equal(new Set(routeDefinitions.map(item=>item.route)).size,routeDefinitions.length);
 for(let i=0;i<paths.length;i++){
  const text=workflows[i];
  assert.match(text,/import \{routeDefinitions\} from '\.\/apps\/web\/public\/assets\/route-registry\.mjs'/,paths[i]);
  assert.match(text,/registeredRoutes=routeDefinitions\.length/,paths[i]);
  assert.match(text,/registeredRoutes>=72&&uniqueRoutes&&manifest\.canonicalRouteCount===registeredRoutes/,paths[i]);
  assert.doesNotMatch(text,/manifest\.canonicalRouteCount===71/,paths[i]);
 }
 assert.match(workflows[0],/zoomRouteCount===6/);
 assert.match(workflows[1],/manifest\.renderCount===18/);
 assert.match(workflows[2],/manifest\.renderCount===10/);
});
