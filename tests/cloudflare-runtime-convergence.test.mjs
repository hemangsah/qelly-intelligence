import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  advanceConvergenceStability,
  validateRuntimeConvergence,
  waitForCloudflareRuntimeConvergence
} from '../scripts/wait-for-cloudflare-runtime-convergence.mjs';

const sha='54356505fec0d4c09a5d0bcaec5c49b966197f26';
const old='a10dcf0b1b045481234587e1bb14639c2c2009e8';
const jsonResponse=(status,payload)=>new Response(JSON.stringify(payload),{status,headers:{'Content-Type':'application/json'}});
const scriptResponse=(releaseSha)=>new Response(`window.__QELLY_CONFIG__=Object.freeze({releaseSha:'${releaseSha}',deploymentStage:'global-public-beta'});`,{status:200,headers:{'Content-Type':'application/javascript'}});
const readinessChecks=()=>({supabase:{required:true,configured:true,proven:true},authEmail:{required:true,configured:true,proven:true},rlsIsolation:{required:true,configured:true,proven:true},providerFreshness:{required:true,configured:true,proven:true}});
const readiness=(releaseSha=sha)=>({ready:true,status:'ready',releaseSha,checks:readinessChecks()});
const completeInput=(overrides={})=>({targetSha:sha,releaseStatus:200,buildStatus:200,browserConfigStatus:200,apiConfigStatus:200,healthStatus:200,readinessStatus:200,release:{releaseSha:sha},build:{releaseSha:sha},browserConfig:{releaseSha:sha},apiConfig:{runtime:{releaseSha:sha}},health:{status:'ok',releaseSha:sha},readiness:readiness(),...overrides});

test('runtime convergence rejects a mixed release rollout',()=>{
  const result=validateRuntimeConvergence(completeInput({readiness:readiness(old)}));assert.equal(result.converged,false);assert.deepEqual(result.checks,{release:true,build:true,browserConfig:true,apiConfig:true,health:true,readiness:false});assert.equal(result.observed.readinessSha,old);
});

test('stability requires consecutive complete samples and resets on any mismatch',()=>{
  const first=advanceConvergenceStability({converged:true},0,2);assert.deepEqual(first,{stableSamples:1,requiredStableSamples:2,complete:false});const reset=advanceConvergenceStability({converged:false},first.stableSamples,2);assert.deepEqual(reset,{stableSamples:0,requiredStableSamples:2,complete:false});const second=advanceConvergenceStability({converged:true},reset.stableSamples,2);const complete=advanceConvergenceStability({converged:true},second.stableSamples,2);assert.deepEqual(complete,{stableSamples:2,requiredStableSamples:2,complete:true});
});

const standardFetch=(sequence={})=>{let readinessCalls=0,buildCalls=0;return {fetchImpl:async(url)=>{if(url.includes('qelly-release.json'))return jsonResponse(200,{releaseSha:sha});if(url.includes('BUILD_INFO.json'))return jsonResponse(200,{releaseSha:sequence.build?.[buildCalls++]??sha});if(url.includes('qelly-config.js'))return scriptResponse(sha);if(url.includes('/api/v1/config'))return jsonResponse(200,{runtime:{releaseSha:sha}});if(url.includes('/health'))return jsonResponse(200,{status:'ok',releaseSha:sha});if(url.includes('/readiness')){readinessCalls+=1;return jsonResponse(200,readiness(sequence.readiness?.[readinessCalls-1]??sha));}throw new Error(`Unexpected URL ${url}`);},readinessCalls:()=>readinessCalls};};

test('runtime convergence waits for two consecutive complete six-surface samples',async()=>{
  const outputDir=await mkdtemp(path.join(os.tmpdir(),'qelly-runtime-convergence-'));const logs=[];const stub=standardFetch({readiness:[old,sha,sha]});try{const result=await waitForCloudflareRuntimeConvergence({publicUrl:'https://qelly.example',releaseSha:sha,attempts:4,intervalMs:0,fetchImpl:stub.fetchImpl,outputDir,log:(entry)=>logs.push(JSON.parse(entry))});assert.equal(result.converged,true);assert.equal(result.stableSamples,2);assert.equal(stub.readinessCalls(),3);assert.equal(logs[0].status,'waiting-for-cloudflare-runtime-convergence');assert.equal(logs[1].status,'cloudflare-runtime-stable-sample');assert.equal(logs[2].status,'cloudflare-runtime-stably-converged');assert.equal(JSON.parse(await readFile(path.join(outputDir,'readiness-convergence.json'),'utf8')).releaseSha,sha);}finally{await rm(outputDir,{recursive:true,force:true});}
});

test('a transient stale surface resets the stable convergence streak',async()=>{
  const outputDir=await mkdtemp(path.join(os.tmpdir(),'qelly-runtime-reset-'));const logs=[];const stub=standardFetch({build:[sha,old,sha,sha]});try{const result=await waitForCloudflareRuntimeConvergence({publicUrl:'https://qelly.example',releaseSha:sha,attempts:4,intervalMs:0,fetchImpl:stub.fetchImpl,outputDir,log:(entry)=>logs.push(JSON.parse(entry))});assert.equal(result.stableSamples,2);assert.deepEqual(logs.map(entry=>entry.status),['cloudflare-runtime-stable-sample','waiting-for-cloudflare-runtime-convergence','cloudflare-runtime-stable-sample','cloudflare-runtime-stably-converged']);assert.deepEqual(logs.map(entry=>entry.stableSamples),[1,0,1,2]);}finally{await rm(outputDir,{recursive:true,force:true});}
});

test('one complete sample is insufficient when two stable samples are required',async()=>{
  const outputDir=await mkdtemp(path.join(os.tmpdir(),'qelly-runtime-single-'));const stub=standardFetch();try{await assert.rejects(()=>waitForCloudflareRuntimeConvergence({publicUrl:'https://qelly.example',releaseSha:sha,attempts:1,intervalMs:0,fetchImpl:stub.fetchImpl,outputDir,log:()=>{}}),/did not remain converged/);}finally{await rm(outputDir,{recursive:true,force:true});}
});

test('public-runtime workflow uses the convergence gate before route capture',async()=>{const workflow=await readFile(new URL('../.github/workflows/prompt2c-public-beta.yml',import.meta.url),'utf8');assert.match(workflow,/node scripts\/wait-for-cloudflare-runtime-convergence\.mjs/);assert.ok(workflow.indexOf('wait-for-cloudflare-runtime-convergence.mjs')<workflow.indexOf('Capture and validate critical routes'));});
