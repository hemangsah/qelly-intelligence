import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {shouldEnablePublicAuthEmail} from '../scripts/enable-public-auth-email.mjs';
import {CANONICAL_QELLY_PUBLIC_SITE,emailDeliveryAvailable} from '../functions/_lib/email-capability.js';

test('build-time public auth email still requires exact explicit production activation',()=>{
  assert.equal(shouldEnablePublicAuthEmail({QELLY_REQUIRE_PUBLIC_RUNTIME:'true',QELLY_ENABLE_AUTH_EMAIL_DELIVERY:'true'}),true);
  assert.equal(shouldEnablePublicAuthEmail({QELLY_REQUIRE_PUBLIC_RUNTIME:'true',QELLY_ENABLE_AUTH_EMAIL_DELIVERY:'TRUE'}),true);
  assert.equal(shouldEnablePublicAuthEmail({QELLY_REQUIRE_PUBLIC_RUNTIME:'true'}),false);
  assert.equal(shouldEnablePublicAuthEmail({QELLY_REQUIRE_PUBLIC_RUNTIME:'true',QELLY_ENABLE_AUTH_EMAIL_DELIVERY:'false'}),false);
  assert.equal(shouldEnablePublicAuthEmail({QELLY_REQUIRE_PUBLIC_RUNTIME:'false',QELLY_ENABLE_AUTH_EMAIL_DELIVERY:'true'}),false);
});

test('Cloudflare runtime trusts only the dated canonical canary when no explicit email override exists',async()=>{
  const runtime=await readFile(new URL('../functions/_lib/runtime.js',import.meta.url),'utf8');
  const capability=await readFile(new URL('../functions/_lib/email-capability.js',import.meta.url),'utf8');
  const build=await readFile(new URL('../scripts/enable-public-auth-email.mjs',import.meta.url),'utf8');
  assert.match(runtime,/emailDelivery:bool\(env\.QELLY_ENABLE_AUTH_EMAIL_DELIVERY,false\)/);
  assert.match(capability,/readinessEvidence:true/);
  assert.match(capability,/capabilityAuthority:true/);
  assert.match(capability,/evidenceMethod:'confirmation_sent_at_then_email_confirmed_at'/);
  assert.match(capability,/canonicalOrigin\(env\.QELLY_PUBLIC_SITE_URL\)===CANONICAL_QELLY_PUBLIC_SITE/);
  assert.match(capability,/canonicalOrigin\(requestUrl\)===CANONICAL_QELLY_PUBLIC_SITE/);
  assert.match(capability,/hasExplicitEmailDeliverySetting/);
  assert.match(build,/String\(environment\.QELLY_ENABLE_AUTH_EMAIL_DELIVERY\|\|'?'\)?/);
  assert.match(build,/\.trim\(\)\.toLowerCase\(\)==='true'/);
  assert.doesNotMatch(build,/!==\s*'false'/);

  const canonicalEnv={QELLY_PUBLIC_SITE_URL:CANONICAL_QELLY_PUBLIC_SITE};
  assert.equal(emailDeliveryAvailable(canonicalEnv,CANONICAL_QELLY_PUBLIC_SITE),true);
  assert.equal(emailDeliveryAvailable(canonicalEnv,'https://preview.qelly-intelligence.pages.dev'),false);
  assert.equal(emailDeliveryAvailable({...canonicalEnv,QELLY_ENABLE_AUTH_EMAIL_DELIVERY:'false'},CANONICAL_QELLY_PUBLIC_SITE),false);
  assert.equal(emailDeliveryAvailable({QELLY_PUBLIC_SITE_URL:'https://qelly.example'},'https://qelly.example'),false);
});
