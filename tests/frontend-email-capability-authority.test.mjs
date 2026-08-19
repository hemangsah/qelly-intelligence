import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {shouldEnablePublicAuthEmail,synchronizePublicAuthEmailArtifacts} from '../scripts/enable-public-auth-email.mjs';

const buildFrontendUrl=new URL('../scripts/build-frontend.mjs',import.meta.url);

test('frontend build requires explicit email-delivery activation and never promotes the dated canary to authority',async()=>{
  const source=await readFile(buildFrontendUrl,'utf8');
  assert.doesNotMatch(source,/AUTH_EMAIL_CANARY/);
  assert.doesNotMatch(source,/productionEmailCanary/);
  assert.match(source,/QELLY_ENABLE_AUTH_EMAIL_DELIVERY\s*,\s*false\)/);
});

test('post-build auth email activation is explicit-only',()=>{
  assert.equal(shouldEnablePublicAuthEmail({}),false);
  assert.equal(shouldEnablePublicAuthEmail({QELLY_REQUIRE_PUBLIC_RUNTIME:'true'}),false);
  assert.equal(shouldEnablePublicAuthEmail({
    QELLY_REQUIRE_PUBLIC_RUNTIME:'true',
    QELLY_ENABLE_AUTH_EMAIL_DELIVERY:'false'
  }),false);
  assert.equal(shouldEnablePublicAuthEmail({
    QELLY_REQUIRE_PUBLIC_RUNTIME:'false',
    QELLY_ENABLE_AUTH_EMAIL_DELIVERY:'true'
  }),false);
  assert.equal(shouldEnablePublicAuthEmail({
    QELLY_REQUIRE_PUBLIC_RUNTIME:'true',
    QELLY_ENABLE_AUTH_EMAIL_DELIVERY:'true'
  }),true);
});

test('artifact synchronization only promotes an explicitly authorized build result',()=>{
  const synchronized=synchronizePublicAuthEmailArtifacts({
    configSource:'window.__QELLY_CONFIG__=Object.freeze({"capabilities":{"emailDelivery":false}});\n',
    releaseSource:'{"authentication":true,"emailDelivery":false,"cloudSync":true,"liveProviders":true}\n',
    buildInfoSource:'{"connectedCapabilitiesActivated":false}\n'
  });
  assert.match(synchronized.config,/"emailDelivery":true/);
  const release=JSON.parse(synchronized.release);
  const buildInfo=JSON.parse(synchronized.buildInfo);
  assert.equal(release.emailDelivery,true);
  assert.equal(buildInfo.connectedCapabilitiesActivated,true);
});
