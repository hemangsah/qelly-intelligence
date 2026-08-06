import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = (relative) => readFile(new URL(`../${relative}`, import.meta.url), 'utf8');

test('official Qelly logo vectors are safe and governed', async () => {
  const files = ['qelly-logo-primary.svg', 'qelly-logo-dark.svg', 'qelly-logo-light.svg', 'qelly-symbol.svg', 'qelly-symbol-small.svg'];
  for (const name of files) {
    const value = await source(`apps/web/public/assets/brand/${name}`);
    assert.match(value, /<svg/);
    assert.match(value, /viewBox=/);
    assert.doesNotMatch(value, /<script|on\w+\s*=|(?:href|src)\s*=\s*["']https?:\/\/|foreignObject/i);
    assert.match(value, /Qelly/i);
  }
});

test('brand runtime is session-aware and reduced-motion safe', async () => {
  const value = await source('apps/web/public/assets/qelly-brand.mjs');
  assert.match(value, /sessionStorage/);
  assert.match(value, /prefers-reduced-motion/);
  assert.match(value, /qelly\.brand\.opening\.v1/);
  assert.match(value, /data-qelly-brand-hero/);
  assert.match(value, /width="304" height="84"/);
  assert.match(value, /width="84" height="84"/);
  assert.match(value, /qellyReviewHoldOpening/);
});

test('brand shell contains intentional edge bleed without document overflow', async () => {
  const value = await source('apps/web/public/assets/qelly-brand.css');
  assert.match(value, /\.q-global-strip,\.q-command-bar\{box-sizing:border-box;max-width:100vw\}/);
  assert.match(value, /#main\{overflow-x:hidden;overflow-x:clip\}/);
});

test('PWA assets and build-time IBM Plex lock are preserved', async () => {
  const index = await source('apps/web/public/index.html');
  const build = await source('scripts/build-frontend.mjs');
  const manifest = JSON.parse(await source('apps/web/public/manifest.webmanifest'));
  assert.doesNotMatch(index, /ibm-plex-sans-variable\.woff2/);
  assert.match(build, /ibm-plex-sans-variable\.woff2/);
  assert.match(build, /rel="preload"/);
  assert.match(index, /qelly-brand\.css/);
  assert.match(index, /qelly-brand\.mjs/);
  assert.ok(manifest.icons.some((item) => item.purpose === 'maskable'));
});

test('brand renderer is deterministic, cross-browser and fail closed', async () => {
  const value = await source('scripts/logo-brand-review.mjs');
  assert.match(value, /chromium, firefox, webkit/);
  assert.match(value, /waitUntil:\s*'domcontentloaded'/);
  assert.doesNotMatch(value, /networkidle/);
  assert.match(value, /PerformanceObserver\.supportedEntryTypes/);
  assert.match(value, /layout-shift/);
  assert.match(value, /RENDERER_FAILURES\.json/);
  assert.match(value, /applyReviewFlags/);
  assert.match(value, /location\.hash = `#\/\$\{expectedRoute\}`/);
  assert.match(value, /overflowElements/);
  assert.match(value, /holdOpening: !repeat/);
  assert.match(value, /let serverPort = 4173/);
  assert.match(value, /const port = 4174/);
  assert.match(value, /OVERFLOW_QA\.json/);
  assert.match(value, /captureOpening\(launcher, browserName, 'full-motion'\)/);
  assert.match(value, /captureOpening\(launcher, browserName, 'reduced'\)/);
  assert.match(value, /captureOpening\(launcher, browserName, 'repeat-session'\)/);
  assert.match(value, /qelly-logo-first-brand-system-review/);
  assert.match(value, /deliveryFontBinariesRemoved/);
  for (const viewport of ['360, 800', '390, 844', '430, 932', '768, 1024', '1024, 768', '1280, 800', '1440, 1000', '1728, 1080', '1920, 1080']) assert.match(value, new RegExp(viewport.replace(', ', ',\\s*')));
});

test('specialist workflows cover the logo branch without weakening existing checks', async () => {
  const workflows = [
    '.github/workflows/typography-governance.yml',
    '.github/workflows/font-comparison.yml',
    '.github/workflows/ui-review.yml',
    '.github/workflows/theme-intelligence-review.yml'
  ];
  for (const workflow of workflows) {
    const value = await source(workflow);
    assert.match(value, /feature\/logo-first-brand-system/);
    assert.match(value, /agent\/ui-rescue-asset-rankings/);
  }
  const typography = await source('.github/workflows/typography-governance.yml');
  const ibm = await source('.github/workflows/font-comparison.yml');
  const ui = await source('.github/workflows/ui-review.yml');
  const theme = await source('.github/workflows/theme-intelligence-review.yml');
  assert.match(typography, /IBM Plex Sans Variable permanent canonical font/);
  assert.match(ibm, /count=.*find dist\/frontend\/assets\/fonts/s);
  assert.match(ui, /npm run ui:review/);
  assert.match(theme, /theme-intelligence-review-complete-stable\.mjs/);
});

test('logo review workflow inspects the historical failure and packages only successful evidence', async () => {
  const value = await source('.github/workflows/logo-brand-review.yml');
  assert.match(value, /actions:\s*read/);
  assert.match(value, /30364816898/);
  assert.match(value, /90293254601/);
  assert.match(value, /if:\s*success\(\)/);
  assert.match(value, /unzip -t qelly-logo-first-brand-system-review\.zip/);
  assert.match(value, /qelly-logo-first-brand-system-review\.zip\.metadata\.json/);
  assert.doesNotMatch(value, /deploy-pages|pages:\s*write|id-token:\s*write/);
});
