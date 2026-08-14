import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const geometry=await readFile(new URL('../apps/web/public/assets/qelly-v53-lock-geometry-fix.mjs',import.meta.url),'utf8');
const cleanup=await readFile(new URL('../apps/web/public/assets/qelly-v53-lock-route-cleanup.mjs',import.meta.url),'utf8');

test('accepted V5.3 desktop lock geometry reserves the governed 114px fixed shell and full post-rail width',()=>{
  assert.match(geometry,/width:calc\(100% - 64px\)!important/);
  assert.match(geometry,/margin:0 0 0 64px!important/);
  assert.match(geometry,/padding:114px 0 0!important/);
  assert.match(geometry,/padding:12px 24px 10px 20px!important/);
});

test('accepted V5.3 mobile lock geometry preserves the compact first-view boundary without double-reserving the shell',()=>{
  assert.match(geometry,/@media\(max-width:900px\)/);
  assert.match(geometry,/min-height:844px!important/);
  assert.match(geometry,/padding:0!important/);
  assert.match(geometry,/padding:11px 12px 92px!important/);
  assert.doesNotMatch(geometry,/@media\(max-width:900px\)[\s\S]*#main[\s\S]*padding:82px 0 0!important/);
});

test('accepted V5.3 mobile shell shows governed brand, command, task and evidence semantics',()=>{
  assert.match(geometry,/content:'QELLY'!important/);
  assert.match(geometry,/content:'Search Qelly…'!important/);
  assert.match(geometry,/content:'⌘K'!important/);
  assert.match(geometry,/content:'PRIMARY TASK'!important/);
  assert.match(geometry,/content:'EVIDENCE SHEET'!important/);
});

test('accepted V5.3 mobile frames carry route-specific sign-off labels above task navigation',()=>{
  assert.match(geometry,/content:'V5\.3 · ' attr\(data-v53-lock-route\)!important/);
  assert.match(geometry,/market-command/);
  assert.match(geometry,/research-evidence/);
  assert.match(geometry,/identity-security/);
  assert.match(geometry,/bottom:68px!important/);
});

test('geometry reconciliation is loaded synchronously before asynchronous lock activation and kept last in head',()=>{
  assert.match(cleanup,/^import '\.\/qelly-v53-lock-geometry-fix\.mjs';/);
  assert.match(geometry,/document\.head\.lastElementChild!==style/);
  assert.match(geometry,/document\.head\.append\(style\)/);
});
