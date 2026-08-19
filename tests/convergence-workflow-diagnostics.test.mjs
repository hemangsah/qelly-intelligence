import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const workflow=async(name)=>readFile(new URL(`../.github/workflows/${name}`,import.meta.url),'utf8');

test('canonical hash-route gate retains convergence diagnostics after an early stop',async()=>{
  const source=await workflow('canonical-hash-route-production-gate.yml');
  assert.match(source,/node scripts\/wait-for-cloudflare-runtime-convergence\.mjs/);
  assert.match(source,/dist\/live-public-verification\/http/);
  assert.match(source,/if-no-files-found: error/);
});

test('V8 live-terminal gate retains convergence diagnostics after an early stop',async()=>{
  const source=await workflow('qelly-v8-live-terminal-acceptance.yml');
  assert.match(source,/node scripts\/wait-for-cloudflare-runtime-convergence\.mjs/);
  assert.match(source,/dist\/live-public-verification\/http/);
  assert.match(source,/if-no-files-found: error/);
});

test('GitHub Pages deploy retains convergence diagnostics only after the gate actually ran',async()=>{
  const source=await workflow('pages-preview.yml');
  assert.match(source,/id: convergence/);
  assert.match(source,/node scripts\/wait-for-cloudflare-runtime-convergence\.mjs/);
  assert.match(source,/if: always\(\) && steps\.convergence\.outcome != 'skipped'/);
  assert.match(source,/dist\/live-public-verification\/http/);
  assert.match(source,/if-no-files-found: error/);
});
