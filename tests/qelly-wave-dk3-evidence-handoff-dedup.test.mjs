import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../.github/workflows/release-evidence-handoff.yml',import.meta.url),'utf8');
test('Browser workflow identity and archive evidence are verified instead of assumed',()=>{
 for(const token of [
  'test "$(jq -r \'.id\' <<<"$run_json")" = "$BROWSER_RUN_ID"',
  'test "$(jq -r \'.conclusion\' <<<"$run_json")" = \'success\'',
  'test "$sha" = "$BROWSER_HEAD_SHA"',
  'commits/$sha/pulls',
  'actions/runs/$BROWSER_RUN_ID/artifacts?per_page=100',
  'qelly-complete-all-screens-$sha',
  'check-runs?per_page=100',
  '.name == "Cloudflare Pages"',
  '.app.slug == "cloudflare-workers-and-pages"',
  'contains("Deploy successful!")'
 ])assert.ok(source.includes(token),token);
});
test('receipt follows exact checkout and never recaptures browser screenshots',()=>{
 const checkout=source.indexOf('- name: Checkout verified exact PR head');
 const receipt=source.indexOf('          mkdir -p dist/release-evidence-handoff');
 const publish=source.indexOf('- name: Publish small exact-head evidence receipt');
 assert.ok(checkout>0&&receipt>checkout&&publish>receipt);
 assert.match(source,/if-no-files-found: error/);
 assert.match(source,/retention-days: 30/);
 assert.match(source,/noDuplicateScreenshotCapture:true/);
 assert.doesNotMatch(source,/npm run browser:all|npm run a11y|playwright install/);
});
test('API checks retry transport failures while retaining TLS verification',()=>{
 assert.match(source,/--retry 4 --retry-delay 1 --retry-all-errors/);
 assert.doesNotMatch(source,/--insecure|curl -k|cat \$GH_TOKEN|echo \$GH_TOKEN/);
 assert.match(source,/Authorization: Bearer \$GH_TOKEN/);
 assert.match(source,/X-GitHub-Api-Version: 2022-11-28/);
});
