import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {validateRuntimeConvergence,waitForCloudflareRuntimeConvergence} from '../scripts/wait-for-cloudflare-runtime-convergence.mjs';

const sha='54356505fec0d4c09a5d0bcaec5c49b966197f26';
const old='a10dcf0b1b045481234587e1bb14639c2c2009e8';

const response=(status,payload)=>new Response(JSON.stringify(payload),{status,headers:{'Content-Type':'application/json'}});

test('runtime convergence rejects a mixed static/functions rollout',()=>{
  const result=validateRuntimeConvergence({
    targetSha:sha,
    releaseStatus:200,
    healthStatus:200,
    readinessStatus:503,
    release:{releaseSha:sha},
    health:{status:'ok',releaseSha:sha},
    readiness:{ready:false,status:'not_proven',releaseSha:old}
  });
  assert.equal(result.converged,false);
  assert.deepEqual(result.checks,{release:true,health:true,readiness:false});
  assert.equal(result.observed.readinessSha,old);
});

test('runtime convergence waits until release, health and readiness share one SHA',async()=>{
  const outputDir=await mkdtemp(path.join(os.tmpdir(),'qelly-runtime-convergence-'));
  const logs=[];
  let readinessCalls=0;
  const fetchImpl=async(url)=>{
    if(url.includes('qelly-release.json'))return response(200,{releaseSha:sha});
    if(url.includes('/health'))return response(200,{status:'ok',releaseSha:sha});
    if(url.includes('/readiness')){
      readinessCalls+=1;
      return response(503,{ready:false,status:'not_proven',releaseSha:readinessCalls===1?old:sha});
    }
    throw new Error(`Unexpected URL ${url}`);
  };
  try{
    const result=await waitForCloudflareRuntimeConvergence({
      publicUrl:'https://qelly.example',
      releaseSha:sha,
      attempts:3,
      intervalMs:0,
      fetchImpl,
      outputDir,
      log:(entry)=>logs.push(JSON.parse(entry))
    });
    assert.equal(result.converged,true);
    assert.equal(readinessCalls,2);
    assert.equal(logs[0].status,'waiting-for-cloudflare-runtime-convergence');
    assert.equal(logs[1].status,'cloudflare-runtime-converged');
    assert.equal(JSON.parse(await readFile(path.join(outputDir,'release.json'),'utf8')).releaseSha,sha);
    assert.equal(JSON.parse(await readFile(path.join(outputDir,'health-convergence.json'),'utf8')).releaseSha,sha);
    assert.equal(JSON.parse(await readFile(path.join(outputDir,'readiness-convergence.json'),'utf8')).releaseSha,sha);
  }finally{
    await rm(outputDir,{recursive:true,force:true});
  }
});

test('public-runtime workflow uses the convergence gate before route capture',async()=>{
  const workflow=await readFile(new URL('../.github/workflows/prompt2c-public-beta.yml',import.meta.url),'utf8');
  assert.match(workflow,/node scripts\/wait-for-cloudflare-runtime-convergence\.mjs/);
  assert.ok(workflow.indexOf('wait-for-cloudflare-runtime-convergence.mjs')<workflow.indexOf('Capture and validate critical routes'));
});
