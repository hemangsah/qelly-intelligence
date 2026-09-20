import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const runtimeUrl=new URL('../apps/web/public/assets/qelly-production-shell.mjs',import.meta.url);

test('production stylesheet convergence validates the build-time order without mutating head',async()=>{
  const source=await readFile(runtimeUrl,'utf8');
  assert.match(source,/function verifyCanonicalStylesheetContract\(\)/);
  assert.match(source,/root\.dataset\.productionStylesheets=missing\.length\?'incomplete':'stable'/);
  assert.doesNotMatch(source,/document\.head\.append\(\.\.\.desiredTail\)/);
  assert.doesNotMatch(source,/document\.head\.append\(repairs\)/);
  assert.doesNotMatch(source,/document\.head\.append\(convergence\)/);
});

test('production shell no longer observes head or the entire app for late visual convergence',async()=>{
  const source=await readFile(runtimeUrl,'utf8');
  assert.doesNotMatch(source,/observe\(document\.head/);
  assert.doesNotMatch(source,/observe\(document\.querySelector\('#app'\)/);
  assert.match(source,/queueMicrotask\(\(\)=>\{queued=false;refresh\(scope\);\}\)/);
  assert.match(source,/root\.dataset\.productionShellReady='true'/);
});
