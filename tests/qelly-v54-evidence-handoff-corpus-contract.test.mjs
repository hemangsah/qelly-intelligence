import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const workflow = await readFile('.github/workflows/release-evidence-handoff.yml', 'utf8');

test('Cloudflare evidence handoff derives render cardinality from the captured corpus', () => {
  assert.match(workflow, /const expectedRenderCount=manifest\.routeCount\*manifest\.viewportCount;/);
  assert.match(workflow, /manifest\.renderCount===expectedRenderCount/);
  assert.match(workflow, /manifest\.expectedRenderCount===expectedRenderCount/);
  assert.match(workflow, /pngs\.length===expectedRenderCount/);
});

test('Cloudflare evidence handoff does not pin the obsolete 70-route corpus', () => {
  assert.doesNotMatch(workflow, /manifest\.routeCount===70/);
  assert.doesNotMatch(workflow, /manifest\.renderCount===140/);
  assert.doesNotMatch(workflow, /manifest\.expectedRenderCount===140/);
  assert.doesNotMatch(workflow, /pngs\.length===140/);
});

test('Cloudflare evidence handoff still enforces complete passed evidence', () => {
  assert.match(workflow, /manifest\.status==='passed'/);
  assert.match(workflow, /manifest\.failed===0/);
  assert.match(workflow, /Array\.isArray\(manifest\.missing\)&&manifest\.missing\.length===0/);
  assert.match(workflow, /accessibility\.status==='passed'/);
  assert.match(workflow, /archives\.length===1&&archiveSize>0/);
});
