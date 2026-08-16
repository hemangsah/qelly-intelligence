import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,stat} from 'node:fs/promises';

const harmonizationPath=new URL('../apps/web/public/assets/qelly-v53-family-harmonization.mjs',import.meta.url);
const candidatePaths=[
  new URL('../apps/web/public/assets/qelly-v53-lock-candidate-convergence.mjs',import.meta.url),
  new URL('../apps/web/public/assets/qelly-v53-lock-candidate-convergence.css',import.meta.url)
];

test('V5.3 family harmonization no longer activates the historical synthetic candidate runtime',async()=>{
  const source=await readFile(harmonizationPath,'utf8');
  assert.match(source,/import '\.\/qelly-v53-lock-route-cleanup\.mjs'/);
  assert.match(source,/void import\('\.\/qelly-v53-lock-shell\.mjs'\)/);
  assert.doesNotMatch(source,/import\(['"]\.\/qelly-v53-lock-candidate-convergence\.mjs['"]\)/);
  assert.doesNotMatch(source,/^import ['"]\.\/qelly-v53-lock-candidate-convergence\.mjs['"]/m);
});

test('historical synthetic lock-candidate assets are absent from the public tree',async()=>{
  for(const candidatePath of candidatePaths){
    await assert.rejects(()=>stat(candidatePath),{code:'ENOENT'});
  }
});
