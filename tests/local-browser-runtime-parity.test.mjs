import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { routeDefinitions } from '../apps/web/public/assets/route-registry.mjs';
import { closeRuntime, startServer } from '../src/server/server.mjs';

test('local browser runtime serves the profile, capability, data-plane and public ECB contracts used by registered screens',async()=>{
  const runtimePath=await mkdtemp(path.join(os.tmpdir(),'qelly-local-browser-parity-'));
  const environment={...process.env,NODE_ENV:'test',QELLY_PRODUCTION_FOUNDATION_ENABLED:'true',QELLY_PRODUCTION_IDENTITY_ENABLED:'false',QELLY_DEVELOPMENT_IDENTITY_ENABLED:'true',QELLY_DEVELOPMENT_IDENTITY_EXPLICIT_HEADER_ONLY:'true',QELLY_DATABASE_MODE:'sqlite',QELLY_JOB_QUEUE_MODE:'database',QELLY_SESSION_SECRET:'local-browser-parity-session-secret-0000001',QELLY_PASSWORD_PEPPER:'local-browser-parity-pepper',QELLY_LIVE_MARKET_ENABLED:'false',QELLY_EXTERNAL_PROVIDERS_ENABLED:'false'};
  const started=await startServer({port:0,runtimePath,environment});
  const base=`http://${started.host}:${started.port}`;
  const authenticated={'X-Qelly-Session-Id':'sess-local-primary'};
  try{
    const [capabilities,ecb,anonymousProfile]=await Promise.all([
      fetch(`${base}/api/v1/platform/capabilities`),
      fetch(`${base}/api/v1/providers/ecb?capability=fx-reference-rates&symbol=EUR`),
      fetch(`${base}/api/v1/profile`)
    ]);
    assert.equal(capabilities.status,200);
    assert.equal(ecb.status,200);
    assert.equal(anonymousProfile.status,401);
    assert.equal((await ecb.json()).truthState,'unavailable');
    const serviceWorker=await fetch(`${base}/prompt2c-sw.js`);
    assert.equal(serviceWorker.status,200);
    assert.match(serviceWorker.headers.get('content-type')||'',/javascript/);
    assert.match(await serviceWorker.text(),/CACHE_PREFIX/);

    const config=await (await fetch(`${base}/api/v1/config`,{headers:authenticated})).json();
    const [profileResponse,dataPlaneResponse]=await Promise.all([
      fetch(`${base}/api/v1/profile`,{headers:authenticated}),
      fetch(`${base}/api/v1/platform/data-plane?limit=200`,{headers:authenticated})
    ]);
    assert.equal(profileResponse.status,200);
    assert.equal(dataPlaneResponse.status,200);
    const profile=await profileResponse.json();
    assert.equal(profile.capabilities.profilePersistence,'local-atomic-json');
    assert.equal(profile.capabilities.cloudSync,false);
    const dataPlane=await dataPlaneResponse.json();
    assert.deepEqual(dataPlane.items,[]);
    assert.equal(dataPlane.guardrails.execution,false);

    const updatedResponse=await fetch(`${base}/api/v1/profile`,{method:'PATCH',headers:{...authenticated,'Content-Type':'application/json','X-Qelly-CSRF':config.csrf.token},body:JSON.stringify({displayName:'Local Browser Auditor',baseCurrency:'INR',timezone:'Asia/Kolkata',cloudSyncOptIn:true})});
    const updated=await updatedResponse.json();
    assert.equal(updatedResponse.status,200,JSON.stringify(updated));
    assert.equal(updated.profile.displayName,'Local Browser Auditor');
    assert.equal(updated.profile.cloudSyncOptIn,false);
  }finally{
    started.server.closeIdleConnections?.();
    await new Promise((resolve)=>started.server.close(resolve));
    await closeRuntime(started.runtime);
    await rm(runtimePath,{recursive:true,force:true});
  }
});

test('public saved calculations avoid a rejected private cloud-status request and Theme Studio identity is canonical',async()=>{
  const saved=await readFile(new URL('../apps/web/public/assets/routes/saved-calculations.mjs',import.meta.url),'utf8');
  assert.match(saved,/state\?\.config\?\.auth\?\.authenticated===true/);
  assert.match(saved,/if\(!api\|\|!authenticated\)/);
  assert.equal(routeDefinitions.find((item)=>item.route==='theme-lab')?.label,'Theme Studio');
});
