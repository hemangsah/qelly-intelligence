import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const path=new URL('../.github/workflows/release-evidence-handoff.yml',import.meta.url);
test('a completed Browser E2E run has one exact-head handoff',async()=>{
 const yaml=await readFile(path,'utf8');
 assert.match(yaml,/on:\n  workflow_run:\n    workflows: \['Browser E2E'\]\n    types: \[completed\]/);
 assert.doesNotMatch(yaml,/^  check_run:|issue_comment|COMMENT_PR_URL|github\.event\.comment/m);
 assert.match(yaml,/github\.event\.workflow_run\.conclusion == 'success'/);
 assert.match(yaml,/github\.event\.workflow_run\.event == 'pull_request'/);
 assert.match(yaml,/github\.event\.workflow_run\.head_repository\.full_name == github\.repository/);
 assert.match(yaml,/qelly-browser-evidence-handoff-/);
 assert.match(yaml,/cancel-in-progress: true/);
});
test('handoff reuses a validated exact-head archive and trusted Cloudflare preview',async()=>{
 const yaml=await readFile(path,'utf8');
 for(const token of ['commits/$sha/pulls','qelly-complete-all-screens-$sha',
  '.expired == false and .size_in_bytes > 1000000','cloudflare-workers-and-pages',
  'contains("Deploy successful!")','qelly-verified-evidence-receipt-']){
  assert.ok(yaml.includes(token),token);
 }
 assert.match(yaml,/\.head_sha == \$sha/);
 assert.match(yaml,/ref: \$\{\{ steps\.pr\.outputs\.sha \}\}/);
 assert.match(yaml,/test "\$\(git rev-parse HEAD\)" = "\$\{\{ steps\.pr\.outputs\.sha \}\}"/);
});
