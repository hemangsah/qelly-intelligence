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

test('frontend and Cloudflare runtime both keep email delivery fail-closed without explicit proof',async()=>{
  const runtime=await readFile(new URL('../functions/_lib/runtime.js',import.meta.url),'utf8');
  const capability=await readFile(new URL('../functions/_lib/email-capability.js',import.meta.url),'utf8');
  const build=await readFile(new URL('../scripts/enable-public-auth-email.mjs',import.meta.url),'utf8');
  assert.match(runtime,/emailDelivery:bool\(env\.QELLY_ENABLE_AUTH_EMAIL_DELIVERY,false\)/);
  assert.match(capability,/emailDeliveryAvailable=\(env=\{\}\)=>bool\(env\.QELLY_ENABLE_AUTH_EMAIL_DELIVERY,false\)/);
  assert.match(capability,/readinessEvidence:true/);
  assert.match(capability,/capabilityAuthority:false/);
  assert.match(capability,/evidenceMethod:'confirmation_sent_at_then_email_confirmed_at'/);
  assert.doesNotMatch(capability,/AUTH_EMAIL_CANARY\.proven\s*&&/);
  assert.doesNotMatch(capability,/site===CANONICAL_QELLY_PUBLIC_SITE/);
  assert.match(build,/String\(environment\.QELLY_ENABLE_AUTH_EMAIL_DELIVERY\|\|'?'\)?/);
  assert.match(build,/\.trim\(\)\.toLowerCase\(\)==='true'/);
  assert.doesNotMatch(build,/!==\s*'false'/);
});
