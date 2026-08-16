import test from 'node:test';
import assert from 'node:assert/strict';
import {
  shouldEnablePublicAuthEmail,
  synchronizePublicAuthEmailArtifacts
} from '../scripts/enable-public-auth-email.mjs';

test('public auth email capability activates only for explicit required connected runtime',()=>{
  assert.equal(shouldEnablePublicAuthEmail({QELLY_REQUIRE_PUBLIC_RUNTIME:'true',QELLY_ENABLE_AUTH_EMAIL_DELIVERY:'true'}),true);
  assert.equal(shouldEnablePublicAuthEmail({QELLY_REQUIRE_PUBLIC_RUNTIME:'true'}),false);
  assert.equal(shouldEnablePublicAuthEmail({QELLY_REQUIRE_PUBLIC_RUNTIME:'true',QELLY_ENABLE_AUTH_EMAIL_DELIVERY:'false'}),false);
  assert.equal(shouldEnablePublicAuthEmail({QELLY_REQUIRE_PUBLIC_RUNTIME:'false',QELLY_ENABLE_AUTH_EMAIL_DELIVERY:'true'}),false);
});

test('auth email synchronizer keeps browser config, release identity and build info consistent',()=>{
  const result=synchronizePublicAuthEmailArtifacts({
    configSource:'window.__QELLY_CONFIG__=Object.freeze({"capabilities":{"authentication":true,"emailDelivery":false,"cloudSync":true,"liveProviders":true}});\n',
    releaseSource:JSON.stringify({
      releaseSha:'0123456789abcdef0123456789abcdef01234567',
      authentication:true,
      emailDelivery:false,
      cloudSync:true,
      liveProviders:true
    }),
    buildInfoSource:JSON.stringify({connectedCapabilitiesActivated:false})
  });

  assert.match(result.config,/"emailDelivery":true/);
  assert.doesNotMatch(result.config,/"emailDelivery":false/);
  const release=JSON.parse(result.release);
  const buildInfo=JSON.parse(result.buildInfo);
  assert.equal(release.emailDelivery,true);
  assert.equal(buildInfo.connectedCapabilitiesActivated,true);
});

test('connected capability summary remains false when another required capability is unavailable',()=>{
  const result=synchronizePublicAuthEmailArtifacts({
    configSource:'window.__QELLY_CONFIG__=Object.freeze({"capabilities":{"authentication":true,"emailDelivery":false,"cloudSync":false,"liveProviders":true}});\n',
    releaseSource:JSON.stringify({authentication:true,emailDelivery:false,cloudSync:false,liveProviders:true}),
    buildInfoSource:JSON.stringify({connectedCapabilitiesActivated:false})
  });
  assert.equal(JSON.parse(result.release).emailDelivery,true);
  assert.equal(JSON.parse(result.buildInfo).connectedCapabilitiesActivated,false);
});

test('synchronizer rejects a generated config without the governed capability marker',()=>{
  assert.throws(()=>synchronizePublicAuthEmailArtifacts({
    configSource:'window.__QELLY_CONFIG__=Object.freeze({});',
    releaseSource:'{}',
    buildInfoSource:'{}'
  }),/does not expose emailDelivery capability/);
});