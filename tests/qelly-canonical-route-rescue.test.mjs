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
  for(const route of ['notification-schedules','data-mesh','decision-provenance','platform-readiness','watchlist'])assert.match(source,new RegExp(`['\"]${route}['\"]`));
  assert.doesNotMatch(source,/rescueNews|route==='news-research'/);
  assert.match(source,/Missing source coverage stays clearly identified instead of being replaced with sample market values/);
  assert.match(source,/providerPolicyMessage/);
  assert.match(source,/NO PERSISTENCE/);
  assert.match(source,/\/api\/v1\/providers\/runtime/);
  assert.match(source,/\/api\/v1\/platform\/readiness/);
  assert.match(source,/\/api\/v1\/workspace\/watchlists/);
  assert.doesNotMatch(source,/data-action=["'](?:execute|trade|order|wallet|withdraw)/i);
});

test('unavailable scheduling is fail-closed instead of presented as an operational worker',async()=>{
  const source=await readFile(sourceUrl,'utf8');
  assert.match(source,/Scheduled alerts are being prepared/);
  assert.match(source,/Research notes','Capture catalysts and follow-up dates/);
  assert.match(source,/Scheduled delivery','Email, SMS, push and webhooks are on the roadmap/);
  assert.doesNotMatch(source,/api\/v1\/notification-schedules[^'"`]*['"`],\{method:'POST'/);
});
