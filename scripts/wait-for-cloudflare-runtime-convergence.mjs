import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {runInNewContext} from 'node:vm';
import {fileURLToPath,pathToFileURL} from 'node:url';

const repositoryRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const defaultOutput=path.join(repositoryRoot,'dist/live-public-verification/http');
const sleep=(milliseconds)=>new Promise((resolve)=>setTimeout(resolve,milliseconds));
const exactSha=(value,target)=>String(value||'')===String(target||'');
const apiConfigSha=(payload)=>payload?.runtime?.releaseSha??payload?.releaseSha??null;

export function parseGeneratedBrowserConfig(source){
  const sandbox={window:{}};
  runInNewContext(String(source||''),sandbox,{timeout:1000,contextCodeGeneration:{strings:false,wasm:false}});
  const config=sandbox.window.__QELLY_CONFIG__;
  if(!config||typeof config!=='object')throw new Error('generated_browser_config_missing');
  return config;
}

export function validateRuntimeConvergence({
  targetSha,
  releaseStatus,
  buildStatus,
  browserConfigStatus,
  apiConfigStatus,
  healthStatus,
  readinessStatus,
  release,
  build,
  browserConfig,
  apiConfig,
  health,
  readiness
}){
  const checks=Object.freeze({
    release:releaseStatus===200&&exactSha(release?.releaseSha,targetSha),
    build:buildStatus===200&&exactSha(build?.releaseSha,targetSha),
    browserConfig:browserConfigStatus===200&&exactSha(browserConfig?.releaseSha,targetSha),
    apiConfig:apiConfigStatus===200&&exactSha(apiConfigSha(apiConfig),targetSha),
    health:healthStatus===200&&health?.status==='ok'&&exactSha(health?.releaseSha,targetSha),
    readiness:readinessStatus===503&&readiness?.ready===false&&readiness?.status==='not_proven'&&exactSha(readiness?.releaseSha,targetSha)
  });
  return Object.freeze({
    converged:Object.values(checks).every(Boolean),
    checks,
    observed:Object.freeze({
      releaseStatus,
      releaseSha:release?.releaseSha??null,
      buildStatus,
      buildSha:build?.releaseSha??null,
      browserConfigStatus,
      browserConfigSha:browserConfig?.releaseSha??null,
      apiConfigStatus,
      apiConfigSha:apiConfigSha(apiConfig),
      healthStatus,
      healthSha:health?.releaseSha??null,
      readinessStatus,
      readinessSha:readiness?.releaseSha??null,
      readinessState:readiness?.status??null
    })
  });
}

async function fetchText(fetchImpl,url,file,{timeoutMs=20_000}={}){
  let response;
  try{
    response=await fetchImpl(url,{headers:{'Cache-Control':'no-cache'},redirect:'follow',signal:AbortSignal.timeout(timeoutMs)});
  }catch(error){
    await writeFile(file,JSON.stringify({fetchError:error?.message||String(error)},null,2));
    return {status:0,text:'',error};
  }
  const text=await response.text();
  await writeFile(file,text);
  return {status:response.status,text,error:null};
}

async function fetchJson(fetchImpl,url,file,options={}){
  const result=await fetchText(fetchImpl,url,file,options);
  if(result.error)return {status:result.status,payload:null,error:result.error};
  try{return {status:result.status,payload:result.text?JSON.parse(result.text):null,error:null};}
  catch(error){return {status:result.status,payload:null,error};}
}

export async function waitForCloudflareRuntimeConvergence({
  publicUrl=process.env.PUBLIC_URL,
  releaseSha=process.env.RELEASE_SHA,
  attempts=36,
  intervalMs=10_000,
  fetchImpl=globalThis.fetch,
  outputDir=defaultOutput,
  log=console.log
}={}){
  if(!/^https:\/\//.test(String(publicUrl||'')))throw new Error('PUBLIC_URL must be a safe HTTPS URL');
  if(!/^[0-9a-f]{40}$/i.test(String(releaseSha||'')))throw new Error('RELEASE_SHA must be a full Git commit SHA');
  if(typeof fetchImpl!=='function')throw new Error('A fetch implementation is required');
  await mkdir(outputDir,{recursive:true});
  const base=String(publicUrl).replace(/\/$/,'');

  for(let attempt=1;attempt<=attempts;attempt++){
    const suffix=`verify=${releaseSha}-${attempt}`;
    const [release,build,browserConfigSource,apiConfig,health,readiness]=await Promise.all([
      fetchJson(fetchImpl,`${base}/qelly-release.json?${suffix}`,path.join(outputDir,'release.json')),
      fetchJson(fetchImpl,`${base}/BUILD_INFO.json?${suffix}`,path.join(outputDir,'build-convergence.json')),
      fetchText(fetchImpl,`${base}/qelly-config.js?${suffix}`,path.join(outputDir,'browser-config-convergence.js')),
      fetchJson(fetchImpl,`${base}/api/v1/config?${suffix}`,path.join(outputDir,'api-config-convergence.json')),
      fetchJson(fetchImpl,`${base}/api/v1/health?${suffix}`,path.join(outputDir,'health-convergence.json')),
      fetchJson(fetchImpl,`${base}/api/v1/readiness?${suffix}`,path.join(outputDir,'readiness-convergence.json'))
    ]);
    let browserConfig=null;
    try{browserConfig=parseGeneratedBrowserConfig(browserConfigSource.text);}
    catch(error){browserConfigSource.error=error;}
    const result=validateRuntimeConvergence({
      targetSha:releaseSha,
      releaseStatus:release.status,
      buildStatus:build.status,
      browserConfigStatus:browserConfigSource.status,
      apiConfigStatus:apiConfig.status,
      healthStatus:health.status,
      readinessStatus:readiness.status,
      release:release.payload,
      build:build.payload,
      browserConfig,
      apiConfig:apiConfig.payload,
      health:health.payload,
      readiness:readiness.payload
    });
    if(result.converged){
      log(JSON.stringify({status:'cloudflare-runtime-converged',attempt,...result.observed}));
      return result;
    }
    log(JSON.stringify({status:'waiting-for-cloudflare-runtime-convergence',attempt,targetSha:releaseSha,...result.observed}));
    if(attempt<attempts)await sleep(intervalMs);
  }
  throw new Error(`Cloudflare runtime did not converge to ${releaseSha} after ${attempts} attempts`);
}

const invokedPath=process.argv[1]?pathToFileURL(path.resolve(process.argv[1])).href:'';
if(invokedPath===import.meta.url)await waitForCloudflareRuntimeConvergence();
