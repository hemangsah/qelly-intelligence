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
  const [premium,evidence,clean,base,completion,orchestrator]=await Promise.all([
    read('scripts/ui-review-premium.mjs'),read('scripts/ui-review-premium-evidence.mjs'),read('scripts/ui-review-persona-clean.mjs'),read('scripts/ui-review.mjs'),read('scripts/ui-review-complete.mjs'),read('scripts/ui-review-orchestrator.mjs')
  ]);
  const combined=[premium,evidence,clean,base,completion,orchestrator].join('\n');
  for(const viewport of ['desktop-1440','desktop-1728','tablet-1024','tablet-768','mobile-390','mobile-430'])assert.match(premium,new RegExp(viewport));
  for(const mode of ['discovery-mode','terminal-mode','research-mode'])assert.match(premium,new RegExp(mode));
  for(const artifact of ['expanded-navigation-premium.png','command-palette-premium.png','explain-drawer-premium.png','filters.png','column-manager.png','chart-tooltip.png','candlesticks.png','table-region-premium.png','light-mode-premium.png','reduced-motion-premium.png','old-vs-new-desktop.png','old-vs-new-mobile.png','MOTION_QA.md','ACCESSIBILITY_QA.md','PERFORMANCE_QA.md','CONSOLE_ERRORS.json','INTERACTIONS.json','KNOWN_DIFFERENCES.json','ARTIFACT_MANIFEST.json','VALIDATION_SUMMARY.json'])assert.match(premium,new RegExp(artifact.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
  for(const artifact of ['query-builder.png','master-frame-evidence.png','MASTER_FRAME_EVIDENCE.md'])assert.match(evidence,new RegExp(artifact.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
  for(const slug of ['scalper-velocity','investor-compound','aggressive-alpha','quant-operator','research-oracle','signal-access']){
    assert.match(evidence,new RegExp(`['\"]${slug}['\"]`));
    assert.match(clean,new RegExp(`['\"]${slug}['\"]`));
  }
  assert.match(evidence,/personas\.map\(\(\[,slug\]\)=>`implementation\/persona-\$\{slug\}\.png`\)/);
  assert.match(evidence,/`persona-\$\{slug\}\.png`/);
  assert.match(clean,/\.q-toast-stack\{display:none!important\}/);
  assert.match(clean,/clean-persona-captures/);
  for(const browser of ['chromium','firefox','webkit'])assert.match(premium,new RegExp(browser));
  assert.match(combined,/old-vs-new-desktop\.png/);
});

test('premium review is authoritative without discarding legacy regression evidence',async()=>{
  const orchestrator=await read('scripts/ui-review-orchestrator.mjs');
  assert.match(orchestrator,/authoritativePasses=\['scripts\/ui-review-premium\.mjs','scripts\/ui-review-premium-evidence\.mjs','scripts\/ui-review-persona-clean\.mjs'\]/);
  assert.match(orchestrator,/premium\.code!==0\|\|evidence\.code!==0\|\|personaClean\.code!==0/);
  assert.match(orchestrator,/legacy-ui-review-nonzero-reconciled/);
  assert.match(orchestrator,/Legacy screenshot passes are retained only as regression evidence/);
  assert.doesNotMatch(orchestrator,/completion\.code!==0\|\|premium\.code!==0/);
});

test('premium evidence pass governs personas query builder shell and honest Figma boundary',async()=>{
  const evidence=await read('scripts/ui-review-premium-evidence.mjs');
  for(const phrase of ['all-six-personas','configured-query-builder','premium-shell-manual-contract','titleNotTruncated','tableInFirstScreen','previewMentions<=3','forbiddenGlyphs.length===0'])assert.match(evidence,new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
  assert.match(evidence,/not an export from a hosted Figma file/i);
  assert.match(evidence,/Run `figma\/code\.js` inside Figma/);
});

test('premium polish prevents tablet wrapping and sizes route SVG icons',async()=>{
  const [assembly,polish]=await Promise.all([read('apps/web/public/assets/qelly-premium-reset.css'),read('apps/web/public/assets/premium-polish.css')]);
  assert.match(assembly,/premium-polish\.css/);
  assert.match(polish,/q-command-trigger>span:nth-child\(2\)/);
  assert.match(polish,/text-overflow:ellipsis/);
  assert.match(polish,/white-space:nowrap/);
  assert.match(polish,/\.q-route-icon/);
  assert.match(polish,/@media\(max-width:1180px\)/);
});

test('structural prototype remains review-only and is not final target',async()=>{
  const [referenceReadme,build]=await Promise.all([read('design/reference/README.md'),read('scripts/build-frontend.mjs')]);
  assert.match(referenceReadme,/structural prototype/i);
  assert.match(referenceReadme,/not the final visual target/i);
  assert.match(referenceReadme,/must not appear in `dist\/frontend`/);
  assert.doesNotMatch(build,/design\/reference|QELLY_EXPECTED_FULL_UI_WORKING/);
});
