import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {shouldEnablePublicAuthEmail} from '../scripts/enable-public-auth-email.mjs';

test('public auth email requires exact explicit production activation',()=>{
  assert.equal(shouldEnablePublicAuthEmail({QELLY_REQUIRE_PUBLIC_RUNTIME:'true',QELLY_ENABLE_AUTH_EMAIL_DELIVERY:'true'}),true);
  assert.equal(shouldEnablePublicAuthEmail({QELLY_REQUIRE_PUBLIC_RUNTIME:'true',QELLY_ENABLE_AUTH_EMAIL_DELIVERY:'TRUE'}),true);
  assert.equal(shouldEnablePublicAuthEmail({QELLY_REQUIRE_PUBLIC_RUNTIME:'true'}),false);
  assert.equal(shouldEnablePublicAuthEmail({QELLY_REQUIRE_PUBLIC_RUNTIME:'true',QELLY_ENABLE_AUTH_EMAIL_DELIVERY:'false'}),false);
  assert.equal(shouldEnablePublicAuthEmail({QELLY_REQUIRE_PUBLIC_RUNTIME:'false',QELLY_ENABLE_AUTH_EMAIL_DELIVERY:'true'}),false);
});

test('frontend and Cloudflare runtime use the same exact-true email delivery rule',async()=>{
  const runtime=await readFile(new URL('../functions/_lib/runtime.js',import.meta.url),'utf8');
  const build=await readFile(new URL('../scripts/enable-public-auth-email.mjs',import.meta.url),'utf8');
  assert.match(runtime,/QELLY_ENABLE_AUTH_EMAIL_DELIVERY==='true'/);
  assert.match(build,/QELLY_ENABLE_AUTH_EMAIL_DELIVERY\|\|'[^']*'\)\.trim\(\)\.toLowerCase\(\)==='true'/);
  assert.doesNotMatch(build,/!==\s*'false'/);
});