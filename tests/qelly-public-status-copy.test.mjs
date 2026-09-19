import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=(path)=>readFile(new URL(`../${path}`,import.meta.url),'utf8');

test('public legal and support copy reflects readiness-gated cloud capabilities without stale not-proven claims',async()=>{
  const [privacy,support]=await Promise.all([
    read('apps/web/public/legal/privacy.html'),
    read('apps/web/public/support.html')
  ]);
  assert.doesNotMatch(privacy,/authenticated cloud lifecycle not production-proven/i);
  assert.doesNotMatch(support,/protected (?:account feedback|cloud support) (?:is )?not (?:yet )?production-proven/i);
  assert.match(privacy,/governed by live readiness checks and fail closed/i);
  assert.match(support,/protected account capabilities are readiness-gated/i);
  assert.match(support,/fail closed if required evidence degrades/i);
});
