import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const text = (relative) => readFile(new URL(relative, root), 'utf8');
const bytes = (relative) => readFile(new URL(relative, root));
const gitBlobSha = (value) => createHash('sha1').update(`blob ${value.length}\0`).update(value).digest('hex');

test('approved primary and symbol geometry remain exact', async () => {
  const primary = await bytes('apps/web/public/assets/brand/qelly-logo-primary.svg');
  const symbol = await bytes('apps/web/public/assets/brand/qelly-symbol.svg');
  assert.equal(gitBlobSha(primary), 'b9437fc4d753b6efd691b47dbd8d027d643dfcbf');
  assert.equal(gitBlobSha(symbol), 'dbf57fb4da9ca06f4a49f8b1c68f67d29ea8a043');
  const primaryText = primary.toString('utf8');
  const symbolText = symbol.toString('utf8');
  assert.match(primaryText, /viewBox="0 0 304 84"/);
  assert.match(symbolText, /viewBox="0 0 84 84"/);
  for (const value of [primaryText, symbolText]) {
    assert.match(value, /#6F1838/);
    assert.match(value, /#16A36A/);
    assert.match(value, /#D33B4A/);
  }
});

test('IBM Plex remains the governed application font source', async () => {
  const index = await text('apps/web/public/index.html');
  const packageJson = JSON.parse(await text('package.json'));
  const build = await text('scripts/build-frontend.mjs');
  assert.match(index, /\.\/assets\/fonts\/ibm-plex-sans-variable\.woff2/);
  assert.doesNotMatch(index, /fonts\.googleapis|use\.typekit|Geist|Manrope|Plus Jakarta/i);
  assert.equal(packageJson.devDependencies['@fontsource-variable/ibm-plex-sans'], '5.2.8');
  assert.match(build, /@fontsource-variable\/ibm-plex-sans/);
  assert.match(build, /ibm-plex-sans-variable\.woff2/);
});

test('brand and semantic colors stay governed by approved source assets', async () => {
  const tokens = JSON.parse(await text('design/brand/QELLY_LOGO_TOKENS.json'));
  const serialized = JSON.stringify(tokens).toUpperCase();
  assert.match(serialized, /6F1838/);
  assert.match(serialized, /16A36A/);
  assert.match(serialized, /D33B4A/);
  const theme = await text('apps/web/public/assets/theme-intelligence.mjs');
  assert.match(theme, /IBM Plex Sans Variable permanent canonical font/);
  assert.match(theme, /GT Eesti inactive licence gate/);
});

test('downloadable review workflows retain font-binary sanitization', async () => {
  const workflows = [
    '.github/workflows/logo-brand-review.yml',
    '.github/workflows/logo-brand-visual-correction-review.yml',
    '.github/workflows/ui-review.yml',
    '.github/workflows/theme-intelligence-review.yml'
  ];
  const combined = (await Promise.all(workflows.map(text))).join('\n');
  assert.match(combined, /font|woff|deliveryFontBinariesRemoved/i);
  const freeze = await text('design/QELLY_BRAND_FOUNDATION_FREEZE.md');
  assert.match(freeze, /No broad redesign/);
  assert.match(freeze, /IBM Plex Sans Variable/);
  assert.match(freeze, /all 13 approved theme families/);
});
