import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { startServer } from '../src/server/server.mjs';
import { legacyRelease, productVersion } from '../src/server/route-manifest.mjs';

const runtimePath=await mkdtemp(path.join(os.tmpdir(),'qelly-release-a5-production-identity-'));
const environment={...process.env,
  NODE_ENV:'production',QELLY_PRODUCTION_FOUNDATION_ENABLED:'true',QELLY_PRODUCTION_IDENTITY_ENABLED:'true',QELLY_DEVELOPMENT_IDENTITY_ENABLED:'false',
  QELLY_DATABASE_MODE:'sqlite',QELLY_ALLOW_SQLITE_IN_PRODUCTION:'true',QELLY_JOB_QUEUE_MODE:'database',QELLY_ALLOW_DATABASE_QUEUE_IN_PRODUCTION:'true',
  QELLY_SESSION_SECRET:'release-a5-production-identity-check-secret-0000001',QELLY_PASSWORD_PEPPER:'release-a5-production-check-pepper',
  QELLY_SECRET_PROTECTION_KEY:crypto.createHash('sha256').update('qelly-production-identity-test-key').digest('hex'),
  QELLY_OBJECT_STORAGE_MODE:'local',QELLY_ALLOW_LOCAL_OBJECT_STORAGE_IN_PRODUCTION:'true',
  QELLY_DELIVERY_MODE:'disabled',QELLY_ALLOW_LOCAL_DELIVERY_IN_PRODUCTION:'false'
};
const {server,host,port}=await startServer({port:0,runtimePath,environment});
const base=`http://${host}:${port}`;
try{
  const config=await (await fetch(base+'/api/v1/config')).json();
  if(config.developmentIdentity.enabled!==false||config.developmentIdentity.defaultFixtureSession!==null)throw new Error('Development identity remained enabled');
  const noHeader=await fetch(base+'/api/v1/session/context');
  if(noHeader.status!==401)throw new Error(`No-cookie request returned ${noHeader.status}`);
  const fixtureHeader=await fetch(base+'/api/v1/session/context',{headers:{'X-Qelly-Session-Id':'sess-local-primary'}});
  if(fixtureHeader.status!==401)throw new Error(`Fixture header bypass returned ${fixtureHeader.status}`);
  const status=await (await fetch(base+'/api/v1/auth/status')).json();
  if(status.authenticated!==false||status.productionFoundation?.developmentIdentityEnabled!==false)throw new Error('Anonymous production auth status is inconsistent');
  console.log(JSON.stringify({status:'production-identity-isolation-passed',productVersion,legacyRelease,developmentIdentity:false,noCookie:noHeader.status,fixtureHeader:fixtureHeader.status,productionAdapter:'sqlite-test-override',deliveryMode:'disabled'},null,2));
}finally{
  await new Promise((resolve)=>server.close(resolve));
  await rm(runtimePath,{recursive:true,force:true});
}
