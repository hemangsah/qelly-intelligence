import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const source=await readFile(new URL('../apps/web/public/assets/qelly-v53-lock-route-cleanup.mjs',import.meta.url),'utf8');
const family=await readFile(new URL('../apps/web/public/assets/qelly-v53-family-harmonization.mjs',import.meta.url),'utf8');

test('legacy Verify and methodology subviews are synchronously excluded from the Q5-004 lock surface',()=>{
  assert.match(source,/new Set\(\['qelly-verify','evidence-methodology'\]\)/);
  assert.match(source,/window\.addEventListener\('hashchange',clearLegacyVerifyLock\)/);
  assert.match(source,/querySelectorAll\(':scope > \.q-v53-lock-page'\)/);
});

test('route cleanup loads before asynchronous lock-candidate activation',()=>{
  assert.match(family,/^import '\.\/qelly-v53-lock-route-cleanup\.mjs';/);
  assert.match(family,/void import\('\.\/qelly-v53-lock-candidate-convergence\.mjs'\)/);
});
