import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {
  parseGeneratedBrowserConfig,
  validateRuntimeConvergence
} from '../scripts/wait-for-cloudflare-runtime-convergence.mjs';

const sha='0123456789abcdef0123456789abcdef01234567';
const convergedInput=()=>({
  targetSha:sha,
  releaseStatus:200,
  buildStatus:200,
  browserConfigStatus:200,
  apiConfigStatus:200,
  healthStatus:200,
  readinessStatus:503,
  release:{releaseSha:sha},
  build:{releaseSha:sha},
  browserConfig:{releaseSha:sha},
  apiConfig:{runtime:{releaseSha:sha}},
  health:{status:'ok',releaseSha:sha},
  readiness:{ready:false,status:'not_proven',releaseSha:sha}
});

test('generated browser config is parsed in an isolated context',()=>{
  const config=parseGeneratedBrowserConfig(`window.__QELLY_CONFIG__=Object.freeze({releaseSha:'${sha}',staticVisualPreview:false});`);
  assert.equal(config.releaseSha,sha);
  assert.equal(config.staticVisualPreview,false);
  assert.throws(()=>parseGeneratedBrowserConfig('window.notQelly=true'),/generated_browser_config_missing/);
});

test('Cloudflare convergence requires all six release identity surfaces',()=>{
  const result=validateRuntimeConvergence(convergedInput());
  assert.equal(result.converged,true);
  assert.deepEqual(result.checks,{
    release:true,
    build:true,
    browserConfig:true,
    apiConfig:true,
    health:true,
    readiness:true
  });
});

test('stale build or API config blocks route verification even when health is current',()=>{
  for(const mutation of [
    {build:{releaseSha:'fedcba9876543210fedcba9876543210fedcba98'}},
    {browserConfig:{releaseSha:'fedcba9876543210fedcba9876543210fedcba98'}},
    {apiConfig:{runtime:{releaseSha:'fedcba9876543210fedcba9876543210fedcba98'}}}
  ]){
    const result=validateRuntimeConvergence({...convergedInput(),...mutation});
    assert.equal(result.converged,false);
  }
});

test('production verifier fetches build, generated config and API config before route capture',async()=>{
  const source=await readFile(new URL('../scripts/wait-for-cloudflare-runtime-convergence.mjs',import.meta.url),'utf8');
  assert.match(source,/\/BUILD_INFO\.json\?/);
  assert.match(source,/\/qelly-config\.js\?/);
  assert.match(source,/\/api\/v1\/config\?/);
  assert.match(source,/browserConfig:browserConfigStatus===200/);
  assert.match(source,/apiConfig:apiConfigStatus===200/);
});
