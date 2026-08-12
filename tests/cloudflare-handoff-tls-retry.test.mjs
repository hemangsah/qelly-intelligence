import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('Cloudflare handoff retries transient GitHub API transport failures while retaining TLS verification',async()=>{
  const source=await readFile(new URL('../.github/workflows/qelly-cloudflare-evidence-handoff.yml',import.meta.url),'utf8');
  assert.match(source,/--retry 4 --retry-delay 1 --retry-all-errors/);
  assert.equal(source.includes('--insecure'),false);
  assert.equal(source.includes('curl -k'),false);
  assert.match(source,/curl --fail --silent --show-error/);
  assert.match(source,/Authorization: Bearer \$GH_TOKEN/);
  assert.match(source,/X-GitHub-Api-Version: 2022-11-28/);
});
