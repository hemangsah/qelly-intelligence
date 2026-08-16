import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const sourceUrl=new URL('../apps/web/public/assets/qelly-canonical-route-rescue.mjs',import.meta.url);
const loaderUrl=new URL('../apps/web/public/assets/routes/data-mesh-enhancement.mjs',import.meta.url);

test('canonical route rescue module is valid JavaScript and loaded by the production shell enhancement',async()=>{
  const result=spawnSync(process.execPath,['--check',fileURLToPath(sourceUrl)],{encoding:'utf8'});
  assert.equal(result.status,0,result.stderr||result.stdout);
  const loader=await readFile(loaderUrl,'utf8');
  assert.match(loader,/import '\.\.\/qelly-canonical-route-rescue\.mjs';/);
});

test('rescue coverage matches photographed canonical route failures without fabricating data',async()=>{
  const source=await readFile(sourceUrl,'utf8');
  for(const route of ['news-research','notification-schedules','data-mesh','decision-provenance','platform-readiness','watchlist'])assert.match(source,new RegExp(`['\"]${route}['\"]`));
  assert.match(source,/No fixture incidents are substituted/);
  assert.match(source,/will not substitute packaged news fixtures/);
  assert.match(source,/NO PERSISTENCE/);
  assert.match(source,/NO FABRICATED CONTENT/);
  assert.match(source,/\/api\/v1\/providers\/runtime/);
  assert.match(source,/\/api\/v1\/platform\/readiness/);
  assert.match(source,/\/api\/v1\/workspace\/watchlists/);
  assert.doesNotMatch(source,/data-action=["'](?:execute|trade|order|wallet|withdraw)/i);
});

test('unavailable scheduling is fail-closed instead of presented as an operational worker',async()=>{
  const source=await readFile(sourceUrl,'utf8');
  assert.match(source,/Persistent scheduling and external delivery are not enabled/);
  assert.match(source,/Create schedule','Disabled until the production scheduler exists/);
  assert.match(source,/Run due schedules','No manual simulation is exposed as production behavior/);
  assert.doesNotMatch(source,/api\/v1\/notification-schedules[^'"`]*['"`],\{method:'POST'/);
});
