import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const source=(relative)=>readFile(new URL(`../${relative}`,import.meta.url),'utf8');

test('final visual correction is loaded after the retained brand system',async()=>{
  const index=await source('apps/web/public/index.html');
  assert.match(index,/qelly-brand\.css[\s\S]*qelly-brand-visual-correction\.css/);
  assert.match(index,/qelly-brand\.mjs[\s\S]*qelly-brand-visual-correction\.mjs[\s\S]*app\.js/);
});

test('opening resolves to one final lockup with governed timing',async()=>{
  const runtime=await source('apps/web/public/assets/qelly-brand.mjs');
  const css=await source('apps/web/public/assets/qelly-brand-visual-correction.css');
  assert.match(runtime,/overlay\.className=`qelly-opening \$\{reduced\?'is-reduced':'is-full'\}`/);
  assert.match(runtime,/const duration=reduced\?120:1180/);
  assert.match(runtime,/if\(seen\)return/);
  assert.match(css,/\.qelly-opening\.is-reduced \.qelly-opening__symbol/);
  assert.match(css,/@keyframes qelly-symbol-to-lockup/);
  assert.match(css,/\.qelly-opening\.is-full \.qelly-opening__wordmark/);
});

test('desktop shell keeps one primary lockup and mobile retains the compact symbol',async()=>{
  const css=await source('apps/web/public/assets/qelly-brand-visual-correction.css');
  assert.match(css,/\.q-brand-home \.q-brand-symbol\{display:none!important\}/);
  assert.match(css,/\.q-edge-dock__brand\{display:none!important\}/);
  assert.match(css,/@media\(max-width:520px\)[\s\S]*\.q-brand-home \.q-brand-symbol\{display:block!important\}/);
});

test('porcelain daylight overrides the complete static-preview shell',async()=>{
  const css=await source('apps/web/public/assets/qelly-brand-visual-correction.css');
  for(const selector of ['.q-global-strip','.q-command-bar','.q-context-shelf','.q-edge-dock','.q-rail','.q-mobile-navigation','.qelly-hero']){
    assert.match(css,new RegExp(selector.replaceAll('.','\\.')));
  }
  assert.match(css,/data-resolved-appearance="light"/);
  assert.doesNotMatch(css,/--q-positive\s*:/);
  assert.doesNotMatch(css,/--q-negative\s*:/);
});

test('state pages suppress the repeated hero and mobile clearance has one owner',async()=>{
  const runtime=await source('apps/web/public/assets/qelly-brand.mjs');
  const bridge=await source('apps/web/public/assets/qelly-brand-visual-correction.mjs');
  const css=await source('apps/web/public/assets/qelly-brand-visual-correction.css');
  assert.match(runtime,/blockingStates\.has\(previewState\)/);
  assert.match(bridge,/main\.dataset\.qellyStatePage=value/);
  assert.match(bridge,/main\.querySelector\('\[data-qelly-brand-hero\]'\)\?\.remove\(\)/);
  assert.match(css,/\.q-shell\{padding-bottom:0!important\}/);
  assert.match(css,/#main\{padding-bottom:calc\(var\(--q-brand-mobile-clearance\) \+ 18px\)!important/);
});

test('auth branding is composed inside the form card',async()=>{
  const runtime=await source('apps/web/public/assets/qelly-brand.mjs');
  const bridge=await source('apps/web/public/assets/qelly-brand-visual-correction.mjs');
  assert.match(runtime,/main\.querySelector\('\.q-auth-card'\)/);
  assert.match(bridge,/card\.prepend\(brand\)/);
});

test('final visual reviewer covers readable evidence and fail-closed measurements',async()=>{
  const reviewer=await source('scripts/logo-brand-visual-correction-review.mjs');
  for(const value of ['chromium','firefox','webkit','360,800','390,844','430,932','TRAILING_SPACE_QA.json','DARK_LIGHT_QA.json','CONTRAST_QA.json','NAVIGATION_CLEARANCE_QA.json','QELLY_PR13_FINAL_VISUAL_CORRECTION_INSPECTION.pdf','qelly-logo-first-brand-system-visual-correction-review.zip'])assert.match(reviewer,new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
  assert.match(reviewer,/page\.pdf/);
  assert.match(reviewer,/excessTrailingPx/);
  assert.match(reviewer,/navigationOverlapPx/);
});

test('visual correction workflow cannot deploy or merge',async()=>{
  const workflow=await source('.github/workflows/logo-brand-visual-correction-review.yml');
  assert.match(workflow,/feature\/logo-first-brand-system/);
  assert.match(workflow,/review:brand:visual/);
  assert.match(workflow,/agent\/pr13-final-visual-correction-inspection/);
  assert.doesNotMatch(workflow,/deploy-pages|pages:\s*write|id-token:\s*write|auto-merge|gh pr merge/);
});
