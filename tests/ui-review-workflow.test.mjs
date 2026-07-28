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

test('font selection follows a rendered legal candidate board',async()=>{
  const board=await read('scripts/font-comparison-board-local.mjs');
  for(const phrase of ['IBM Plex Sans Variable','GT Eesti Pro Display + Text','Manrope Variable','Plus Jakarta Sans Variable','font-candidate-board-before-selection.png','font-final-selection-board.png',"license:'OFL-1.1'","active:false","semantic-inline-svg"])assert.ok(board.includes(phrase));
  assert.ok(board.indexOf('candidate-board-before-selection')<board.lastIndexOf('final-selection-after-comparison'));
  assert.match(board,/GT Eesti[^\n]+licen[cs]e/i);
});

test('font and surface artifact remains comprehensive',async()=>{
  const [pass,stable]=await Promise.all([read('scripts/ui-review-font-surface.mjs'),read('scripts/ui-review-font-surface-stable.mjs')]);
  for(const viewport of ['desktop-1728','desktop-1440','desktop-1280','tablet-1024','tablet-768','mobile-430','mobile-390','mobile-360'])assert.ok(pass.includes(viewport));
  for(const artifact of ['typography-closeup.png','command-palette-font-surface.png','metric-rail.png','table-font-surface.png','mobile-asset-row.png','chart-font-surface.png','navigation-font-surface.png','filters-bottom-sheet-ready.png','columns-tonal-menu.png','explain-tonal-drawer.png','light-porcelain-font-surface.png','typography-before-after.png','command-palette-before-after.png','metric-before-after.png','chart-frame-before-after.png','CURRENT_TYPOGRAPHY_COMPUTED.json','SURFACE_REDUCTION.json','FONT_SURFACE_VALIDATION.json'])assert.ok(pass.includes(artifact));
  for(const gate of ['localPlex','fontShiftZero','weightDiscipline','radiusDiversity','nativeSelectsGone','borderReduction','mobilePulseRail','paletteHierarchy','reducedMotion','consoleClean'])assert.ok(stable.includes(gate)||pass.includes(gate));
  assert.ok(pass.includes('reduction>=.35'));
  assert.ok(stable.includes('loadedFiles.length===1'));
  assert.ok(stable.includes('ibm-plex-sans-variable.woff2'));
});

test('state-based mobile sheet review has no arbitrary sleeps',async()=>{
  const [stable,orchestrator]=await Promise.all([read('scripts/ui-review-font-surface-stable.mjs'),read('scripts/ui-review-orchestrator.mjs')]);
  assert.ok(stable.includes("locator('[data-mi-filter-close]').last().click()"));
  assert.ok(stable.includes('aria-hidden=\\"true\\"'));
  assert.ok(stable.includes("waitFor({state:'attached'})"));
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

test('editable Figma handoff matches IBM Plex production typography',async()=>{
  const [plugin,spec,checklist,matrix,alignment]=await Promise.all([read('figma-plugin/code.js'),read('design/figma/QELLY_FIGMA_MASTER_SPEC.md'),read('design/figma/QELLY_DESIGN_REVIEW_CHECKLIST.md'),read('design/figma/QELLY_FIGMA_COMPONENT_MATRIX.csv'),read('design/figma/QELLY_IBM_PLEX_ALIGNMENT.md')]);
  for(const phrase of ["family:'IBM Plex Sans'",'IBM Plex Sans Variable','GT Eesti commercial licence gate','all text and numeric roles'])assert.ok(plugin.includes(phrase));
  assert.doesNotMatch(plugin,/Geist Sans Variable|Geist Mono Variable|family:'Geist'/);
  assert.match(spec,/IBM Plex Sans Variable/);
  assert.match(spec,/inactive commercial reference/i);
  assert.match(checklist,/IBM Plex Sans Variable is the active/);
  assert.match(checklist,/GT Eesti Pro Display and Text remain inactive/);
  assert.match(matrix,/Typography,IBM Plex Sans semantic type system/);
  assert.match(alignment,/production website/i);
  assert.match(alignment,/semantic inline SVG icons/i);
});

test('IBM Plex is selected everywhere and GT Eesti remains licence gated',async()=>{
  const [assembly,css,build,audit,decision,index]=await Promise.all([read('apps/web/public/assets/qelly-premium-reset.css'),read('apps/web/public/assets/premium-font-worldquant-arkham.css'),read('scripts/build-frontend.mjs'),read('design/research/CURRENT_TYPOGRAPHY_AUDIT.md'),read('design/research/QELLY_WORLDQUANT_ARKHAM_FONT_DECISION.md'),read('apps/web/public/index.html')]);
  assert.ok(assembly.includes('premium-font-worldquant-arkham.css'));
  for(const phrase of ['Qelly IBM Plex Sans','Arial','Helvetica Neue','--q-font-display','--q-font-text','--q-font-mono','tabular-nums lining-nums','font-feature-settings','GT Eesti Pro Display','GT Eesti Pro Text'])assert.ok(css.includes(phrase));
  assert.doesNotMatch(css,/@font-face[^}]*GT Eesti/is);
  assert.ok(build.includes('@fontsource-variable/ibm-plex-sans'));
  assert.ok(build.includes('ibm-plex-sans-variable.woff2'));
  assert.ok(build.includes("licensedOptionalActive:false"));
  assert.ok(index.includes('ibm-plex-sans-variable.woff2'));
  assert.doesNotMatch(index,/geist-(?:mono-)?variable\.woff2/);
  assert.match(audit,/IBM Plex Sans Variable/);
  assert.match(audit,/GT Eesti/);
  assert.match(decision,/commercial Grilli Type family/i);
  assert.match(decision,/must not become active/i);
});
