import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {routeDefinitions} from '../apps/web/public/assets/route-registry.mjs';
import {APPEARANCE_MODES,FONT_STACK,THEME_FAMILIES} from '../apps/web/public/assets/theme-intelligence-data.mjs';

const read=(path)=>readFile(new URL(`../${path}`,import.meta.url),'utf8');

test('blueprint route inventory is complete and route identifiers are unique',()=>{
  assert.equal(routeDefinitions.length,71);
  const routes=routeDefinitions.map((item)=>item.route);
  assert.equal(new Set(routes).size,routes.length);
  assert.ok(routeDefinitions.every((item)=>item.label&&item.section&&item.route));
});

test('appearance system preserves light, dark, OLED, high-contrast and adaptive modes',()=>{
  for(const mode of ['dark','light','oled','high-contrast','system','scheduled'])assert.ok(APPEARANCE_MODES.includes(mode),mode);
  assert.ok(THEME_FAMILIES.length>=10);
  for(const family of THEME_FAMILIES){
    assert.ok(family.dark&&family.light,`${family.id} requires light and dark palettes`);
    for(const palette of [family.dark,family.light]){
      for(const token of ['canvas','surface','panel','raised','overlay','text','secondary','muted','border','divider','accent','accentText','positive','negative','warning','info','focus','selected','grid'])assert.match(palette[token],/^#[0-9A-F]{6}$/i,`${family.id}.${token}`);
    }
  }
});

test('canonical typography and semantic colors match the governed blueprint',async()=>{
  const foundations=await read('apps/web/public/assets/theme-intelligence-foundations.css');
  assert.match(FONT_STACK,/Qelly IBM Plex Sans/);
  assert.match(foundations,/--q-font-display:"Qelly IBM Plex Sans"/);
  assert.match(foundations,/--q-positive:/);
  assert.match(foundations,/--q-negative:/);
  assert.match(foundations,/--q-warning:/);
  assert.match(foundations,/--q-info:/);
  assert.match(foundations,/data-market-palette="color-blind"/);
  assert.match(foundations,/data-appearance="high-contrast"/);
  assert.match(foundations,/focus-visible/);
});

test('application shell preserves accessibility and no broken font preload',async()=>{
  const html=await read('apps/web/public/index.html');
  assert.match(html,/class="skip-link" href="#main"/);
  assert.match(html,/main id="main" tabindex="-1"/);
  assert.match(html,/aria-label="Toggle appearance"/);
  assert.doesNotMatch(html,/rel="preload"[^>]*ibm-plex-sans-variable\.woff2/i);
  assert.match(html,/document\.fonts\?\.ready/);
});

test('theme controls expose accessible names and governed persistence boundaries',async()=>{
  const bootstrap=await read('apps/web/public/assets/theme-intelligence-bootstrap.mjs');
  assert.match(bootstrap,/setAttribute\('aria-label','Open Theme Studio'\)/);
  assert.match(bootstrap,/credentials:'include'/);
  assert.match(bootstrap,/X-Qelly-CSRF/);
  assert.match(bootstrap,/staticVisualPreview/);
  assert.match(bootstrap,/high-contrast/);
});

test('responsive and reduced-motion contracts are present in the production CSS',async()=>{
  const files=await Promise.all([
    read('apps/web/public/assets/qelly-foundations.css'),
    read('apps/web/public/assets/premium-mobile.css'),
    read('apps/web/public/assets/theme-intelligence-foundations.css')
  ]);
  const css=files.join('\n');
  assert.match(css,/prefers-reduced-motion/);
  assert.match(css,/safe-area-inset-bottom/);
  assert.match(css,/focus-visible/);
  assert.match(css,/forced-colors|high-contrast/);
});
