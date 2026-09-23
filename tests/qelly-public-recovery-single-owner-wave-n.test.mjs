import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {parseHashRoute} from '../apps/web/public/assets/hash-route-state.mjs';

const read=(path)=>readFile(new URL(`../${path}`,import.meta.url),'utf8');

test('legacy decision-maker deep link resolves to the canonical decision-provenance route',()=>{
  const parsed=parseHashRoute('#/market?view=decision-maker');
  assert.equal(parsed.route,'decision-provenance');
  assert.equal(parsed.asset,null);
  assert.equal(parsed.query.toString(),'');
});

test('app router owns public degraded-state rendering directly',async()=>{
  const app=await read('apps/web/public/assets/app.js');
  assert.match(app,/bindPublicRecoveryActions,installPublicRecoveryChrome,isPublicRecoveryRoute,publicRecoveryMarkup/);
  assert.match(app,/else if\(isPublicRecoveryRoute\(route\)\)/);
  assert.match(app,/main\.innerHTML=publicRecoveryMarkup\(route,error\.message,\{preview:staticVisualPreview\}\)/);
  assert.match(app,/bindPublicRecoveryActions\(main,\{route,retry:\(\)=>renderRoute\(\)\}\)/);
  assert.match(app,/legacyDecisionMaker=\/\^#\\\/market/);
  assert.match(app,/history\.replaceState\(null,'','#\/decision-provenance'\)/);
});

test('public recovery helper has no global main ownership lifecycle',async()=>{
  const source=await read('apps/web/public/assets/qelly-public-recovery.mjs');
  assert.match(source,/export function publicRecoveryMarkup/);
  assert.match(source,/export function installPublicRecoveryChrome/);
  assert.doesNotMatch(source,/MutationObserver|qellyRecoveryOwner|main\.innerHTML|location\.reload|for\(const delay|addEventListener\(['"]hashchange|addEventListener\(['"]pageshow/);
});

test('base HTML no longer executes a second public recovery owner',async()=>{
  const index=await read('apps/web/public/index.html');
  assert.match(index,/qelly-public-recovery\.css/);
  assert.doesNotMatch(index,/<script[^>]+qelly-public-recovery\.mjs/);
});
