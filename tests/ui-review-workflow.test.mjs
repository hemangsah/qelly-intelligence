import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=(file)=>readFile(path.join(root,file),'utf8');

test('UI review remains PR-only and cannot deploy',async()=>{
  const workflow=await read('.github/workflows/ui-review.yml');
  assert.match(workflow,/pull_request:/);
  assert.match(workflow,/workflow_dispatch:/);
  assert.doesNotMatch(workflow,/\n\s+push:/);
  assert.match(workflow,/agent\/ui-rescue-asset-rankings/);
  assert.match(workflow,/npm ci --ignore-scripts/);
  assert.match(workflow,/playwright install --with-deps chromium firefox webkit/);
  assert.match(workflow,/name: qelly-ui-rescue-review/);
  assert.doesNotMatch(workflow,/deploy-pages|pages: write|id-token: write/);
});

test('premium artifact captures required viewports modes interactions and browsers',async()=>{
  const [premium,base,completion,orchestrator]=await Promise.all([
    read('scripts/ui-review-premium.mjs'),read('scripts/ui-review.mjs'),read('scripts/ui-review-complete.mjs'),read('scripts/ui-review-orchestrator.mjs')
  ]);
  const combined=[premium,base,completion,orchestrator].join('\n');
  for(const viewport of ['desktop-1440','desktop-1728','tablet-1024','tablet-768','mobile-390','mobile-430'])assert.match(premium,new RegExp(viewport));
  for(const mode of ['discovery-mode','terminal-mode','research-mode'])assert.match(premium,new RegExp(mode));
  for(const evidence of ['expanded-navigation-premium.png','command-palette-premium.png','explain-drawer-premium.png','filters.png','column-manager.png','chart-tooltip.png','candlesticks.png','table-region-premium.png','light-mode-premium.png','reduced-motion-premium.png','old-vs-new-desktop.png','old-vs-new-mobile.png','MOTION_QA.md','ACCESSIBILITY_QA.md','PERFORMANCE_QA.md','CONSOLE_ERRORS.json','INTERACTIONS.json','KNOWN_DIFFERENCES.json','ARTIFACT_MANIFEST.json','VALIDATION_SUMMARY.json'])assert.match(premium,new RegExp(evidence.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
  for(const persona of ['persona-scalper.png','persona-research.png','persona-signal-access.png'])assert.match(combined,new RegExp(persona.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
  for(const browser of ['chromium','firefox','webkit'])assert.match(premium,new RegExp(browser));
  assert.match(orchestrator,/ui-review-premium\.mjs/);
});

test('structural prototype remains review-only and is not final target',async()=>{
  const [referenceReadme,build]=await Promise.all([read('design/reference/README.md'),read('scripts/build-frontend.mjs')]);
  assert.match(referenceReadme,/structural prototype/i);
  assert.match(referenceReadme,/not the final visual target/i);
  assert.match(referenceReadme,/must not appear in `dist\/frontend`/);
  assert.doesNotMatch(build,/design\/reference|QELLY_EXPECTED_FULL_UI_WORKING/);
});
