import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {effectiveDeploymentEnvironment} from './deployment-environment.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const configTarget=path.join(root,'dist/frontend/qelly-config.js');
const releaseTarget=path.join(root,'dist/frontend/qelly-release.json');
const buildInfoTarget=path.join(root,'dist/frontend/BUILD_INFO.json');

export function shouldEnablePublicAuthEmail(environment=process.env){
  return environment.QELLY_REQUIRE_PUBLIC_RUNTIME==='true'&&String(environment.QELLY_ENABLE_AUTH_EMAIL_DELIVERY||'').trim().toLowerCase()==='true';
}

export function synchronizePublicAuthEmailArtifacts({configSource,releaseSource,buildInfoSource}){
  const source=String(configSource||'');
  const config=source.replace('"emailDelivery":false','"emailDelivery":true');
  if(config===source&&!source.includes('"emailDelivery":true'))throw new Error('Generated Qelly runtime config does not expose emailDelivery capability');

  const release=JSON.parse(String(releaseSource||'{}'));
  release.emailDelivery=true;

  const buildInfo=JSON.parse(String(buildInfoSource||'{}'));
  buildInfo.connectedCapabilitiesActivated=Boolean(
    release.authentication&&release.emailDelivery&&release.cloudSync&&release.liveProviders
  );

  return Object.freeze({
    config,
    release:`${JSON.stringify(release,null,2)}\n`,
    buildInfo:`${JSON.stringify(buildInfo,null,2)}\n`
  });
}

export async function enablePublicAuthEmail({environment=effectiveDeploymentEnvironment(process.env)}={}){
  if(!shouldEnablePublicAuthEmail(environment)){
    return Object.freeze({status:'public-auth-email-unchanged'});
  }

  const [configSource,releaseSource,buildInfoSource]=await Promise.all([
    readFile(configTarget,'utf8'),
    readFile(releaseTarget,'utf8'),
    readFile(buildInfoTarget,'utf8')
  ]);
  const synchronized=synchronizePublicAuthEmailArtifacts({configSource,releaseSource,buildInfoSource});
  await Promise.all([
    writeFile(configTarget,synchronized.config),
    writeFile(releaseTarget,synchronized.release),
    writeFile(buildInfoTarget,synchronized.buildInfo)
  ]);
  return Object.freeze({status:'public-auth-email-enabled',artifacts:['qelly-config.js','qelly-release.json','BUILD_INFO.json']});
}

const invokedPath=process.argv[1]?pathToFileURL(path.resolve(process.argv[1])).href:'';
if(invokedPath===import.meta.url){
  console.log(JSON.stringify(await enablePublicAuthEmail()));
}
