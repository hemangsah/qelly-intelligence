import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { formatDiscoveryEvidenceValue } from '../apps/web/public/assets/routes/discovery-hub-enhancement.mjs';

const modulePath = new URL('../apps/web/public/assets/routes/discovery-hub-enhancement.mjs', import.meta.url);
const cssPath = new URL('../apps/web/public/assets/routes/discovery-hub-enhancement.css', import.meta.url);
const indexPath = new URL('../apps/web/public/index.html', import.meta.url);

test('Discovery Hub formats structured evidence values without object coercion', () => {
  assert.equal(formatDiscoveryEvidenceValue({ value: '24', unit: 'count' }), '24');
  assert.equal(formatDiscoveryEvidenceValue({ value: '62', unit: 'percent' }), '62%');
  assert.equal(formatDiscoveryEvidenceValue({ value: '95.5', unit: 'score' }), '95.5');
  assert.equal(formatDiscoveryEvidenceValue({ value: null, unit: 'score' }), 'N/A');
});

test('Discovery Hub enhancement preserves the evidence API and patches only presentation', async () => {
  const source = await readFile(modulePath, 'utf8');
  assert.match(source, /\/api\/v1\/discovery\/overview/);
  assert.match(source, /item\.value/);
  assert.match(source, /\.q-kpi-value/);
  assert.match(source, /textContent\s*=\s*formatDiscoveryEvidenceValue/);
  assert.doesNotMatch(source, /innerHTML\s*=\s*formatDiscoveryEvidenceValue/);
  assert.doesNotMatch(source, /\.slice\s*\(/);
  assert.doesNotMatch(source, /\.filter\s*\(/);
});

test('Discovery mobile density remains route-scoped and keeps every collection scroll-discoverable', async () => {
  const css = await readFile(cssPath, 'utf8');
  const source = await readFile(modulePath, 'utf8');
  assert.match(css, /@media\s*\(max-width:768px\)/);
  assert.match(css, /#main\[data-discovery-hub-enhanced="active"\]/);
  assert.match(css, /grid-auto-flow:column!important/);
  assert.match(css, /overflow-x:auto!important/);
  assert.match(css, /scroll-snap-type:x proximity/);
  assert.doesNotMatch(css, /display\s*:\s*none/i);
  assert.doesNotMatch(css, /visibility\s*:\s*hidden/i);
  assert.match(source, /tabIndex\s*=\s*0/);
  assert.match(source, /role', 'region'/);
  assert.match(source, /aria-label/);
});

test('application shell loads and awaits the Discovery enhancement before first reveal', async () => {
  const html = await readFile(indexPath, 'utf8');
  assert.match(html, /assets\/routes\/discovery-hub-enhancement\.css/);
  assert.match(html, /assets\/routes\/discovery-hub-enhancement\.mjs/);
  assert.match(html, /window\.__qellyDiscoveryEnhancementReady\?\?Promise\.resolve\(\)/);
});
