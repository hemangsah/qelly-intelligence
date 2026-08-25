import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const runtimeUrl=new URL('../apps/web/public/assets/qelly-production-shell.mjs',import.meta.url);

test('production stylesheet convergence becomes idempotent after canonical order is reached',async()=>{
  const source=await readFile(runtimeUrl,'utf8');
  assert.match(source,/const desiredTail=\[canonical,repairs,convergence,premiumTheme\]\.filter\(Boolean\)/);
  assert.match(source,/const currentTail=Array\.from\(document\.head\.querySelectorAll\('link\[rel="stylesheet"\]'\)\)\.slice\(-desiredTail\.length\)/);
  assert.match(source,/const alreadyOrdered=desiredTail\.length>0&&desiredTail\.every\(\(node,index\)=>currentTail\[index\]===node\)/);
  assert.match(source,/if\(!alreadyOrdered\)document\.head\.append\(\.\.\.desiredTail\)/);
  assert.doesNotMatch(source,/lastElementChild!==canonical/);
  assert.doesNotMatch(source,/lastElementChild!==repairs/);
  assert.doesNotMatch(source,/lastElementChild!==convergence/);
});

test('head observer remains enabled so external stylesheet mutations still reconverge',async()=>{
  const source=await readFile(runtimeUrl,'utf8');
  assert.match(source,/new MutationObserver\(\(\)=>schedule\(document\)\)\.observe\(document\.head,\{childList:true\}\)/);
});
