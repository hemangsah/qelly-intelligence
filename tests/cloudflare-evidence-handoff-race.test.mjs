import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const workflowPath = path.join(root, '.github/workflows/qelly-cloudflare-evidence-handoff.yml');

test('Cloudflare handoff treats superseded successful previews as ineligible instead of failed', async () => {
  const workflow = await readFile(workflowPath, 'utf8');
  assert.match(workflow, /if \[ "\$current_sha" != "\$sha" \]; then/);
  assert.match(workflow, /superseded pull-request head; exact-PR evidence is intentionally not applicable/);
  assert.match(workflow, /echo "eligible=false" >> "\$GITHUB_OUTPUT"/);
  assert.doesNotMatch(workflow, /test "\$current_sha" = "\$sha"/);
});

test('Cloudflare handoff still guards the evidence checkout against exact resolved SHA', async () => {
  const workflow = await readFile(workflowPath, 'utf8');
  assert.match(workflow, /ref: \$\{\{ steps\.pr\.outputs\.sha \}\}/);
  assert.match(workflow, /run: test "\$\(git rev-parse HEAD\)" = "\$\{\{ steps\.pr\.outputs\.sha \}\}"/);
  assert.match(workflow, /github\.event\.check_run\.conclusion == 'success'/);
});
