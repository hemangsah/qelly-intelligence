import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const harmonizationPath=new URL('../apps/web/public/assets/qelly-v53-family-harmonization.mjs',import.meta.url);
const candidatePath=new URL('../apps/web/public/assets/qelly-v53-lock-candidate-convergence.mjs',import.meta.url);

test('V5.3 family harmonization no longer activates the historical synthetic candidate runtime',async()=>{
  const source=await readFile(harmonizationPath,'utf8');
  assert.match(source,/import '\.\/qelly-v53-lock-route-cleanup\.mjs'/);
  assert.match(source,/void import\('\.\/qelly-v53-lock-shell\.mjs'\)/);
  assert.doesNotMatch(source,/import\(['"]\.\/qelly-v53-lock-candidate-convergence\.mjs['"]\)/);
  assert.doesNotMatch(source,/^import ['"]\.\/qelly-v53-lock-candidate-convergence\.mjs['"]/m);
});

test('historical lock-candidate source remains reference-only and is not deleted by runtime retirement',async()=>{
  const source=await readFile(candidatePath,'utf8');
  assert.match(source,/presentation-only/i);
  assert.match(source,/q-v53-lock-page/);
  assert.match(source,/SIMULATED REFERENCE DATA/);
});
