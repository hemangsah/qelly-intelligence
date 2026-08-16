import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const scriptUrl=new URL('../scripts/verify-canonical-hash-routes.mjs',import.meta.url);
const workflowUrl=new URL('../.github/workflows/canonical-hash-route-production-gate.yml',import.meta.url);

test('canonical hash route browser probe is valid JavaScript and covers screenshot-critical routes',async()=>{
  const result=spawnSync(process.execPath,['--check',fileURLToPath(scriptUrl)],{encoding:'utf8'});
  assert.equal(result.status,0,result.stderr||result.stdout);
  const source=await readFile(scriptUrl,'utf8');
  for(const route of ['news-research','watchlist','notification-schedules','data-mesh','platform-readiness','decision-provenance','market','asset-rankings','calculator-detail/risk-reward','feature-universe','account-session','theme-personas'])assert.match(source,new RegExp(`['\"]${route.replace('/','\\/')}['\"]`));
  assert.match(source,/Unable to render this route\|API route was not found/);
  assert.match(source,/data-canonical-route-rescue/);
  assert.match(source,/serviceWorkers:'block'/);
});

test('production gate targets only the canonical release branch, uses proven action pins and uploads browser evidence',async()=>{
  const source=await readFile(workflowUrl,'utf8');
  assert.match(source,/release\/qelly-global-public-beta/);
  assert.match(source,/PUBLIC_URL: https:\/\/qelly-intelligence\.pages\.dev/);
  assert.match(source,/actions\/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1/);
  assert.match(source,/actions\/setup-node@820762786026740c76f36085b0efc47a31fe5020/);
  assert.match(source,/actions\/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a/);
  assert.match(source,/verify-canonical-hash-routes\.mjs/);
  assert.match(source,/wait-for-cloudflare-runtime-convergence\.mjs/);
  assert.match(source,/qelly-canonical-hash-routes-\$\{\{ github\.sha \}\}/);
  assert.doesNotMatch(source,/branches:\s*\n\s*- main/);
});
