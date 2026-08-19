import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const buildFrontendUrl=new URL('../scripts/build-frontend.mjs',import.meta.url);

test('frontend build requires explicit email-delivery activation and never promotes the dated canary to authority',async()=>{
  const source=await readFile(buildFrontendUrl,'utf8');
  assert.doesNotMatch(source,/AUTH_EMAIL_CANARY/);
  assert.doesNotMatch(source,/productionEmailCanary/);
  assert.match(source,/QELLY_ENABLE_AUTH_EMAIL_DELIVERY\s*,\s*false\)/);
});
