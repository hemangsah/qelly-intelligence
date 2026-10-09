import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=(path)=>readFile(new URL(`../${path}`,import.meta.url),'utf8');

test('production state banners do not receive a decorative grid-breaking brand child',async()=>{
  const brand=await read('apps/web/public/assets/qelly-brand.mjs');
  const stateInstaller=brand.slice(brand.indexOf('function installStateBrand'),brand.indexOf('function installCommandBrand'));
  assert.match(stateInstaller,/if\(productionProduct\(\)\)/);
  assert.match(stateInstaller,/querySelectorAll\('\.qelly-state-brand'\)/);
  assert.match(stateInstaller,/node\)=>node\.remove\(\)/);
  assert.match(stateInstaller,/return;/);
});

test('Feature Universe mobile layout uses readable open rows and owned responsive CSS',async()=>{
 const [route,css]=await Promise.all([read('apps/web/public/assets/routes/feature-universe.mjs'),read('apps/web/public/assets/routes/feature-index.css')]);
 assert.doesNotMatch(route,/style\.setProperty|MOBILE_PRESENTATION|q-universe-route-grid/);
 assert.match(css,/@media\(max-width:640px\)[\s\S]*\.q-feature-workflows ol[\s\S]*grid-template-columns:minmax\(0,1fr\)/);
 assert.match(css,/\.q-feature-groups li a\{[^}]*min-height:48px/);
 assert.match(css,/font:700 20px\/1\.35/);
 assert.match(css,/\.q-feature-index p\{[^}]*font-size:16px/);
});

test('accepted V7 routes render one shell instead of overlapping production and terminal shells',async()=>{
  const css=await read('apps/web/public/assets/qelly-v53-lock-shell.css');
  assert.match(css,/@media\(min-width:901px\)[\s\S]*:is\(\.q-product-header,#context-shelf\)\{display:none!important\}/);
  assert.match(css,/@media\(max-width:900px\)[\s\S]*\.q-v53-lock-system,\.q-v53-lock-command,\.q-v53-lock-contextbar\{display:none!important\}/);
  assert.match(css,/#main\{width:100%!important;margin:0!important;padding-top:0!important\}/);
});

test('mobile production shell and governed routes meet readable touch-first floors',async()=>{
  const [shell,family]=await Promise.all([
    read('apps/web/public/assets/qelly-v53-production-shell-status.css'),
    read('apps/web/public/assets/qelly-v53-family-harmonization.css')
  ]);
  assert.match(shell,/Deep mobile usability repair/);
  assert.match(shell,/\.q-product-search[\s\S]*height:44px;[\s\S]*min-height:44px/);
  assert.match(shell,/#context-shelf \.q-category-shelf button\{[\s\S]*min-height:44px!important/);
  assert.match(family,/--q-v53-text-body:13px/);
  assert.match(family,/--q-v53-text-meta:11px/);
  assert.match(family,/button:not\(\[hidden\]\)[\s\S]*min-height:44px!important/);
  assert.match(family,/input:not\(\[type="hidden"\]\)[\s\S]*min-height:44px!important;font-size:13px!important/);
  assert.match(family,/\.q-state-banner\{grid-template-columns:minmax\(0,1fr\)!important/);
  assert.match(family,/:focus-visible\{outline:3px solid/);
  assert.match(family,/\.q-kpi-meta[\s\S]*\.q-source-line/);
  assert.match(family,/data-v53-route="theme-lab"[\s\S]*\.q-ti-audit-item span/);
  assert.match(family,/data-v53-route="qelly-verify"[\s\S]*\.q-v53-verify-mobile-nav/);
});
