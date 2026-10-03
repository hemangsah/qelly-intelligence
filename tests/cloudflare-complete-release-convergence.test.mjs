import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {
  parseGeneratedBrowserConfig,
  validateRuntimeConvergence
} from '../scripts/wait-for-cloudflare-runtime-convergence.mjs';

const sha='0123456789abcdef0123456789abcdef01234567';
const readinessChecks=()=>({
  supabase:{required:true,configured:true,proven:true},
  authEmail:{required:true,configured:true,proven:true},
  rlsIsolation:{required:true,configured:true,proven:true},
  providerFreshness:{required:true,configured:true,proven:true}
});
const convergedInput=()=>({
  targetSha:sha,
  releaseStatus:200,
  buildStatus:200,
  browserConfigStatus:200,
  apiConfigStatus:200,
  healthStatus:200,
  readinessStatus:200,
  release:{releaseSha:sha},
  build:{releaseSha:sha},
  browserConfig:{releaseSha:sha},
  apiConfig:{runtime:{releaseSha:sha}},
  health:{status:'ok',releaseSha:sha},
  readiness:{ready:true,status:'ready',releaseSha:sha,checks:readinessChecks()}
});

test('generated browser config is parsed in an isolated context',()=>{
  const config=parseGeneratedBrowserConfig(`window.__QELLY_CONFIG__=Object.freeze({releaseSha:'${sha}',staticVisualPreview:false});`);
  assert.equal(config.releaseSha,sha);
  assert.equal(config.staticVisualPreview,false);
  assert.throws(()=>parseGeneratedBrowserConfig('window.notQelly=true'),/generated_browser_config_missing/);
});

test('Cloudflare convergence requires all six release identity surfaces and proven readiness',()=>{
  const result=validateRuntimeConvergence(convergedInput());
  assert.equal(result.converged,true);
  assert.deepEqual(result.checks,{release:true,build:true,browserConfig:true,apiConfig:true,health:true,readiness:true});
  const unproven=validateRuntimeConvergence({...convergedInput(),readiness:{ready:true,status:'ready',releaseSha:sha,checks:{...readinessChecks(),providerFreshness:{required:true,configured:true,proven:false}}}});
  assert.equal(unproven.converged,false);
});

test('stale build or API config blocks route verification even when health is current',()=>{
  for(const mutation of [
    {build:{releaseSha:'fedcba9876543210fedcba9876543210fedcba98'}},
    {browserConfig:{releaseSha:'fedcba9876543210fedcba9876543210fedcba98'}},
    {apiConfig:{runtime:{releaseSha:'fedcba9876543210fedcba9876543210fedcba98'}}}
  ])assert.equal(validateRuntimeConvergence({...convergedInput(),...mutation}).converged,false);
});

test('production verifier fetches build, generated config and API config before route capture',async()=>{
  const source=await readFile(new URL('../scripts/wait-for-cloudflare-runtime-convergence.mjs',import.meta.url),'utf8');
  assert.match(source,/\/BUILD_INFO\.json\?/);assert.match(source,/\/qelly-config\.js\?/);assert.match(source,/\/api\/v1\/config\?/);assert.match(source,/browserConfig:browserConfigStatus===200/);assert.match(source,/apiConfig:apiConfigStatus===200/);assert.match(source,/readinessStatus===200/);assert.match(source,/readinessProven/);
});

test('handoff follows successful Browser E2E PR evidence and independently authenticates Cloudflare preview',async()=>{
 const source=await readFile(new URL('../.github/workflows/release-evidence-handoff.yml',import.meta.url),'utf8');
 const browser=await readFile(new URL('../.github/workflows/browser-e2e.yml',import.meta.url),'utf8');
 assert.match(source,/on:\n  workflow_run:\n    workflows: \['Browser E2E'\]\n    types: \[completed\]/);
 assert.doesNotMatch(source,/^  check_run:|issue_comment:|github\.event\.comment/m);
 assert.match(source,/github\.event\.workflow_run\.conclusion == 'success'/);
 assert.match(source,/github\.event\.workflow_run\.event == 'pull_request'/);
 assert.match(source,/cancel-in-progress: true/);
 assert.match(source,/commits\/\$sha\/pulls/);
 assert.match(source,/select\(\.state == "open" and \.head\.sha == \$sha/);
 assert.match(source,/if \[ "\$current_sha" != "\$sha" \]; then/);
 assert.match(source,/qelly-complete-all-screens-\$sha/);
 assert.match(source,/\.expired == false and \.size_in_bytes > 1000000/);
 assert.match(source,/\.app\.slug == "cloudflare-workers-and-pages"/);
 assert.match(source,/\.output\.summary \| type == "string" and contains\("Deploy successful!"\)/);
 assert.match(source,/echo "eligible=false" >> "\$GITHUB_OUTPUT"/);
 assert.match(source,/echo "eligible=true" >> "\$GITHUB_OUTPUT"/);
 assert.match(source,/ref: \$\{\{ steps\.pr\.outputs\.sha \}\}/);
 assert.match(source,/test "\$\(git rev-parse HEAD\)" = "\$\{\{ steps\.pr\.outputs\.sha \}\}"/);
 assert.match(source,/qelly-verified-evidence-receipt-/);
 assert.doesNotMatch(source,/npm run browser:all|npm run a11y|playwright install|npm ci/);
 assert.match(browser,/manifest\.status==='passed'/);
 assert.match(browser,/manifest\.failed===0/);
 assert.match(browser,/pngs\.length===expectedRenders/);
 assert.match(browser,/accessibility\.status==='passed'/);
 assert.match(browser,/archives\.length===1&&archives\[0\]===exactArchive&&archiveSize>0/);
 assert.match(source,/contents: read/);
 assert.match(source,/pull-requests: read/);
 assert.doesNotMatch(source,/contents:\s*write|pull-requests:\s*write|deployments:\s*write/);
 assert.doesNotMatch(source,/\bwrangler\b|cloudflare\/pages-action|gh\s+pr\s+merge|\/merge\b/);
});
