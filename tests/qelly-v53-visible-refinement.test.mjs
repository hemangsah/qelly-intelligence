import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const CSS = 'apps/web/public/assets/qelly-v53-visible-refinement.css';
const RUNTIME = 'apps/web/public/assets/qelly-ui-lock-v5-3.mjs';

test('V5.3 refinement is additive and activated by the approved lock runtime', async () => {
  const [css, runtime] = await Promise.all([read(CSS), read(RUNTIME)]);
  assert.match(runtime, /qelly-v53-visible-refinement\.css/);
  assert.match(runtime, /dataset\.uiLockV53Refinement='2026-08-09'/);
  assert.match(runtime, /document\.head\.append\(link\)/);
  assert.match(css, /Additive presentation-only polish after UI_LOCK_V5_3/);
});

test('visible refinement strengthens the governed high-value surfaces', async () => {
  const css = await read(CSS);
  for (const selector of [
    '.q-live-command-deck',
    '.q-live-chart-shell',
    '.q-v5-market-metric',
    '.q-v5-evidence-ribbon',
    '.q-context-drawer',
    '.q-ti-preview-shell',
    '.q-ti-theme-card',
    '.q-compare-tray'
  ]) {
    assert.ok(css.includes(selector), `missing visible refinement for ${selector}`);
  }
  assert.match(css, /data-v53-route="market"/);
  assert.match(css, /data-v53-evidence-adjacent="true"/);
});

test('refinement preserves responsive, light-theme and reduced-motion contracts', async () => {
  const css = await read(CSS);
  assert.match(css, /data-appearance="light"/);
  assert.match(css, /@media \(max-width:767px\)/);
  assert.match(css, /@media \(prefers-reduced-motion:reduce\)/);
  assert.match(css, /transition:none!important/);
});

test('refinement introduces no live execution or custody controls', async () => {
  const [css, runtime] = await Promise.all([read(CSS), read(RUNTIME)]);
  const source = `${css}\n${runtime}`.toLowerCase();
  const forbidden = [
    'place order',
    'execute trade',
    'buy now',
    'sell now',
    'connect wallet',
    'private key',
    'recovery phrase',
    'withdraw funds',
    'deposit funds'
  ];
  for (const phrase of forbidden) assert.equal(source.includes(phrase), false, `forbidden control phrase: ${phrase}`);
});
