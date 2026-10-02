import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const path=new URL('../.github/workflows/release-evidence-handoff.yml',import.meta.url);
test('Cloudflare deployment evidence has exactly one authoritative event trigger',async()=>{
  const yaml=await readFile(path,'utf8');
  assert.match(yaml,/on:\n  check_run:\n    types: \[completed\]\npermissions:/);
  assert.doesNotMatch(yaml,/issue_comment|COMMENT_PR_URL|github\.event\.comment/);
  assert.ok(yaml.includes("format('qelly-cloudflare-evidence-{0}', github.event.check_run.head_sha)"));
  assert.ok(yaml.includes("format('qelly-unrelated-check-{0}', github.run_id)"));
  assert.match(yaml,/cancel-in-progress: true/);
  assert.match(yaml,/github\.event\.check_run\.conclusion == 'success'/);
});
test('Evidence only runs against authenticated Cloudflare app and current exact PR head',async()=>{
  const yaml=await readFile(path,'utf8');
  for(const marker of [
    "test \"$(jq -r '.app.slug' <<<\"$check_json\")\" = 'cloudflare-workers-and-pages'",
    'contains("Deploy successful!")',
    'commits/$sha/pulls',
    'if [ "$current_sha" != "$sha" ]; then',
    'ref: ${{ steps.pr.outputs.sha }}',
    'run: test "$(git rev-parse HEAD)" = "${{ steps.pr.outputs.sha }}"',
    "manifest.status==='passed'",
    "accessibility.status==='passed'"
  ])assert.ok(yaml.includes(marker),marker);
});
