import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const text = (relative) => readFile(new URL(relative, root), 'utf8');

test('UI_LOCK_V5_3 is explicitly locked and loaded after V5', async () => {
  const [index, lock, css, runtime] = await Promise.all([
    text('apps/web/public/index.html'),
    text('docs/UI_LOCK_V5_3.md'),
    text('apps/web/public/assets/qelly-ui-lock-v5-3.css'),
    text('apps/web/public/assets/qelly-ui-lock-v5-3.mjs')
  ]);

  assert.match(lock, /LOCKED FOR IMPLEMENTATION/);
  assert.match(lock, /e077489ba482f0df9258a14c0074adb1bc9eee02d4740b7fb683fdf7df3b2855/);
  assert.match(index, /qelly-ui-lock-v5-3\.css/);
  assert.match(index, /qelly-ui-lock-v5-3\.mjs/);
  assert.ok(index.indexOf('qelly-ui-lock-v5-markets.css') < index.indexOf('qelly-ui-lock-v5-3.css'));
  assert.ok(index.indexOf('qelly-ui-lock-v5.mjs') < index.indexOf('qelly-ui-lock-v5-3.mjs'));
  assert.match(runtime, /dataset\.uiLockV53='active'/);
  assert.match(css, /data-ui-lock-v5-3="active"/);
});

test('V5.3 keeps the governed seven-layer shell explicit', async () => {
  const runtime = await text('apps/web/public/assets/qelly-ui-lock-v5-3.mjs');
  for (const layer of [
    'system-strip',
    'command-bar',
    'navigation-rail',
    'context-bar',
    'analytical-workspace',
    'intelligence-inspector',
    'activity-tray'
  ]) assert.match(runtime, new RegExp(layer));

  assert.match(runtime, /Intelligence Inspector — source context/);
  assert.match(runtime, /Activity and intelligence actions/);
});

test('compact navigation retains accessible labels', async () => {
  const runtime = await text('apps/web/public/assets/qelly-ui-lock-v5-3.mjs');
  assert.match(runtime, /setAttribute\('aria-label',label\)/);
  assert.match(runtime, /setAttribute\('title',label\)/);
  assert.match(runtime, /qelly\.ui-lock-v5-3\.rail/);
});

test('V5.3 preserves evidence and safety boundaries', async () => {
  const [lock, runtime, css] = await Promise.all([
    text('docs/UI_LOCK_V5_3.md'),
    text('apps/web/public/assets/qelly-ui-lock-v5-3.mjs'),
    text('apps/web/public/assets/qelly-ui-lock-v5-3.css')
  ]);
  assert.match(lock, /no order entry, live execution, custody, wallet signing, deposits, withdrawals, private keys or recovery phrases/i);
  assert.match(runtime, /data-v53-evidence-adjacent/);
  assert.match(css, /q-source-line/);
  assert.match(css, /prefers-reduced-motion:reduce/);
  assert.doesNotMatch(`${runtime}\n${css}`, /place order|execute trade|connect wallet|deposit funds|withdraw funds|buy now|sell now/i);
});

test('V5.3 operational typography does not regress to six-pixel body labels', async () => {
  const css = await text('apps/web/public/assets/qelly-ui-lock-v5-3.css');
  assert.match(css, /--q-v53-text-body:12px/);
  assert.match(css, /--q-v53-text-small:11px/);
  assert.match(css, /--q-v53-text-meta:9px/);
  assert.doesNotMatch(css, /font-size:\s*[1-7](?:\.\d+)?px/);
});
