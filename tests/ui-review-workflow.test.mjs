import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=(file)=>readFile(path.join(root,file),'utf8');

test('UI review workflow is limited to the rescue PR and manual dispatch',async()=>{
  const workflow=await read('.github/workflows/ui-review.yml');
  assert.match(workflow,/pull_request:/);
  assert.match(workflow,/workflow_dispatch:/);
  assert.doesNotMatch(workflow,/\n\s+push:/);
  assert.match(workflow,/agent\/ui-rescue-asset-rankings/);
  assert.match(workflow,/npm ci --ignore-scripts/);
  assert.match(workflow,/playwright install --with-deps chromium/);
  assert.match(workflow,/name: qelly-ui-rescue-review/);
  assert.doesNotMatch(workflow,/deploy-pages|pages: write|id-token: write/);
});

test('UI review captures all acceptance viewports and interactive states',async()=>{
  const script=await read('scripts/ui-review.mjs');
  for(const viewport of ['desktop-1440','tablet-1024','tablet-768','mobile-390']){
    assert.match(script,new RegExp(`key:'${viewport}'`));
  }
  for(const evidence of [
    'expanded-navigation.png',
    'explain-drawer.png',
    'table-region.png',
    'light-mode.png',
    'persona-scalper.png',
    'persona-research.png',
    'mobile-navigation.png',
    'side-by-side.png',
    'annotated-differences.png',
    'console-errors.json',
    'tested-interactions.json',
    'artifact-manifest.json'
  ]){
    assert.match(script,new RegExp(evidence.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
  }
});

test('approved HTML remains review-only and outside the production frontend',async()=>{
  const [referenceReadme,build]=await Promise.all([
    read('design/reference/README.md'),
    read('scripts/build-frontend.mjs')
  ]);
  assert.match(referenceReadme,/must not appear in `dist\/frontend`/);
  assert.match(referenceReadme,/removed from the branch before final merge/);
  assert.doesNotMatch(build,/design\/reference|QELLY_EXPECTED_FULL_UI_WORKING/);
});
