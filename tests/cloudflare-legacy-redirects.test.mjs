import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const redirects=await readFile(new URL('../apps/web/public/_redirects',import.meta.url),'utf8');

test('legacy Qelly Verify path redirects directly to the canonical hash route',()=>{
  assert.match(redirects,/^\/methodology\/verify \/#\/qelly-verify 301$/m);
  assert.match(redirects,/^\/methodology\/verify\/ \/#\/qelly-verify 301$/m);
  assert.doesNotMatch(redirects,/pages\.dev/);
});
