import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const readSources=()=>Promise.all([
  readFile(new URL('../apps/web/public/assets/qelly-brand.mjs',import.meta.url),'utf8'),
  readFile(new URL('../apps/web/public/assets/qelly-canonical-shell-brand.css',import.meta.url),'utf8'),
  readFile(new URL('../apps/web/public/assets/app.js',import.meta.url),'utf8'),
  readFile(new URL('../apps/web/public/assets/app.css',import.meta.url),'utf8'),
  readFile(new URL('../apps/web/public/assets/brand/qelly-logo-dark.svg',import.meta.url),'utf8'),
  readFile(new URL('../apps/web/public/assets/brand/qelly-logo-light.svg',import.meta.url),'utf8')
]);

test('top-left workspace branding uses the canonical Qelly lockup asset',async()=>{
  const [brand,css,,,darkLogo,lightLogo]=await readSources();
  assert.match(brand,/const horizontalLogo=\(\)=>asset\(isLight\(\)\?'qelly-logo-light\.svg':'qelly-logo-dark\.svg'\)/);
  assert.match(brand,/document\.getElementById\('workspace-switcher'\)/);
  assert.match(brand,/data-qelly-workspace-lockup data-lockup/);
  assert.match(brand,/class="q-workspace-brand-home" href="#\/market"/);
  assert.match(css,/\.q-workspace-switcher\[data-qelly-canonical-brand="true"\]/);
  for(const logo of [darkLogo,lightLogo]){
    assert.match(logo,/viewBox="0 0 304 84"/);
    assert.match(logo,/<title[^>]*>Qelly<\/title>/);
    assert.match(logo,/C24 58 30 50 40 40 C51 29 61 22 76 17/);
  }
});

test('route rendering cannot permanently replace the canonical top-left logo',async()=>{
  const [brand,,app]=await readSources();
  assert.match(app,/switcher\.innerHTML=/);
  assert.match(app,/<span aria-hidden="true">Q<\/span>/);
  assert.match(brand,/function installWorkspaceBrand\(\)/);
  assert.match(brand,/if\(!target\|\|target\.querySelector\('\[data-qelly-workspace-lockup\]'\)\)return/);
  assert.match(brand,/new MutationObserver\(refresh\)\.observe\(document\.documentElement,\{childList:true,subtree:true\}\)/);
  assert.match(brand,/window\.addEventListener\('hashchange',\(\)=>requestAnimationFrame\(refresh\)\)/);
  const workspaceInstall=brand.indexOf('installWorkspaceBrand();');
  const observer=brand.indexOf('new MutationObserver(refresh)');
  assert.ok(workspaceInstall>=0&&observer>workspaceInstall);
});

test('the synthetic QL pseudo-logo is neutralized while canonical markup is restored',async()=>{
  const [,css,,legacyCss]=await readSources();
  assert.match(legacyCss,/content:'QL'/);
  assert.match(css,/data-qelly-canonical-brand="true"\]\>span::after/);
  assert.match(css,/content:none!important/);
  assert.match(css,/display:none!important/);
  assert.doesNotMatch(css,/content:\s*['"](?:Q|QL)['"]/);
});

test('theme changes update every canonical lockup rather than changing logo geometry',async()=>{
  const [brand]=await readSources();
  assert.match(brand,/document\.querySelectorAll\('img\[data-lockup\]'\)\.forEach\(\(node\)=>node\.src=horizontalLogo\(\)\)/);
  assert.match(brand,/attributeFilter:\['data-appearance','data-resolved-appearance','data-theme-family'\]/);
  assert.doesNotMatch(brand,/workspace-switcher[\s\S]*innerHTML=`<span aria-hidden="true">Q<\/span>/);
});

test('workspace context remains separate from the immutable brand asset',async()=>{
  const [brand,css]=await readSources();
  assert.match(brand,/function workspaceContext\(target\)/);
  assert.match(brand,/data-qelly-workspace-title/);
  assert.match(brand,/data-qelly-workspace-subtitle/);
  assert.match(brand,/class="q-workspace-context" data-qelly-workspace-context/);
  assert.match(css,/q-workspace-context/);
  assert.match(css,/text-overflow:ellipsis/);
});
