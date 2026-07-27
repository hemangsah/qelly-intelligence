import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=(file)=>readFile(path.join(root,file),'utf8');

test('review workflows are PR-only and cannot deploy',async()=>{
  for(const file of ['.github/workflows/ui-review.yml','.github/workflows/font-comparison.yml']){
    const workflow=await read(file);
    assert.ok(workflow.includes('pull_request:'));
    assert.ok(!workflow.includes('\n  push:'));
    assert.ok(!/deploy-pages|pages: write|id-token: write/.test(workflow));
  }
});

test('font selection follows a rendered candidate board',async()=>{
  const board=await read('scripts/font-comparison-board-local.mjs');
  for(const phrase of ['Geist Sans Variable','Manrope Variable','Plus Jakarta Sans Variable','font-candidate-board-before-selection.png','font-final-selection-board.png',"license:'OFL-1.1'"])assert.ok(board.includes(phrase));
  assert.ok(board.indexOf('candidate-board-before-selection')<board.lastIndexOf('final-selection-after-comparison'));
});

test('font and surface artifact remains comprehensive',async()=>{
  const pass=await read('scripts/ui-review-font-surface.mjs');
  for(const viewport of ['desktop-1728','desktop-1440','desktop-1280','tablet-1024','tablet-768','mobile-430','mobile-390','mobile-360'])assert.ok(pass.includes(viewport));
  for(const artifact of ['typography-closeup.png','command-palette-font-surface.png','metric-rail.png','table-font-surface.png','mobile-asset-row.png','chart-font-surface.png','navigation-font-surface.png','filters-bottom-sheet-ready.png','columns-tonal-menu.png','explain-tonal-drawer.png','light-porcelain-font-surface.png','typography-before-after.png','command-palette-before-after.png','metric-before-after.png','chart-frame-before-after.png','CURRENT_TYPOGRAPHY_COMPUTED.json','SURFACE_REDUCTION.json','FONT_SURFACE_VALIDATION.json'])assert.ok(pass.includes(artifact));
  for(const gate of ['localGeist','fontShiftZero','weightDiscipline','radiusDiversity','nativeSelectsGone','borderReduction','mobilePulseRail','paletteHierarchy','reducedMotion','consoleClean'])assert.ok(pass.includes(gate));
  assert.ok(pass.includes('reduction>=.35'));
});

test('state-based mobile sheet review has no arbitrary sleeps',async()=>{
  const [stable,orchestrator]=await Promise.all([read('scripts/ui-review-font-surface-stable.mjs'),read('scripts/ui-review-orchestrator.mjs')]);
  assert.ok(stable.includes("locator('[data-mi-filter-close]').last().click()"));
  assert.ok(stable.includes("locator('[data-mi-filter-sheet][aria-hidden=\"true\"]').waitFor({state:'attached'})"));
  assert.ok(stable.includes("locator('[data-mi-column-menu]:not([hidden])').waitFor({state:'visible'})"));
  assert.ok(!/waitForTimeout|setTimeout/.test(stable));
  assert.ok(orchestrator.includes('scripts/ui-review-font-surface-stable.mjs'));
  assert.ok(orchestrator.includes('scripts/font-comparison-board-local.mjs'));
});

test('premium evidence and Figma boundaries remain governed',async()=>{
  const [evidence,referenceReadme,build]=await Promise.all([read('scripts/ui-review-premium-evidence.mjs'),read('design/reference/README.md'),read('scripts/build-frontend.mjs')]);
  for(const phrase of ['all-six-personas','configured-query-builder','premium-shell-manual-contract','titleNotTruncated','tableInFirstScreen','previewMentions<=3','forbiddenGlyphs.length===0'])assert.ok(evidence.includes(phrase));
  assert.match(evidence,/not an export from a hosted Figma file/i);
  assert.match(referenceReadme,/structural prototype/i);
  assert.match(referenceReadme,/not the final visual target/i);
  assert.doesNotMatch(build,/design\/reference|QELLY_EXPECTED_FULL_UI_WORKING/);
});

test('selected fonts and continuous-corner surface tokens are present',async()=>{
  const [assembly,css,build,audit]=await Promise.all([read('apps/web/public/assets/qelly-premium-reset.css'),read('apps/web/public/assets/premium-font-surface.css'),read('scripts/build-frontend.mjs'),read('design/research/CURRENT_TYPOGRAPHY_AUDIT.md')]);
  assert.ok(assembly.includes('premium-font-surface.css'));
  for(const token of ['--q-radius-4','--q-radius-8','--q-radius-12','--q-radius-16','--q-radius-20','--q-radius-24','--q-radius-pill','--q-surface-canvas','--q-surface-floating','--q-border-subtle','--q-shadow-float'])assert.ok(css.includes(token));
  for(const rule of ['font-optical-sizing:auto','font-synthesis:none','tabular-nums lining-nums','appearance:none','scroll-snap-type:x mandatory','q-command-group','q-command-item-copy'])assert.ok(css.includes(rule));
  assert.ok(build.includes('geist-variable.woff2'));
  assert.ok(build.includes('geist-mono-variable.woff2'));
  assert.match(audit,/Geist Sans Variable/);
  assert.match(audit,/Geist Mono Variable/);
});
