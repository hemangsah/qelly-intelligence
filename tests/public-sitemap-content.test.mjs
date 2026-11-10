import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { renderSitemap, seoStaticResources } from '../scripts/finalize-public-seo.mjs';
import { PUBLIC_CALCULATORS, generatePublicCalculatorNetwork } from '../scripts/generate-public-calculator-network.mjs';
import { PUBLIC_ASSET_RESEARCH, generatePublicAssetResearch } from '../scripts/generate-public-asset-research.mjs';

const base = 'https://terminal.qellyintelligence.com';
const expected = [
  ...['', ...seoStaticResources].map(resource => ({ location: base + '/' + resource, lastmod: null })),
  ...['', ...PUBLIC_CALCULATORS.map(item => item.slug + '/')].map(slug => ({ location: base + '/calculators/' + slug, lastmod: '2026-09-21' })),
  ...PUBLIC_ASSET_RESEARCH.map(item => ({ location: base + '/research/assets/' + item.slug + '/', lastmod: '2026-09-20' })),
];

// Deliberately validate the generator's bounded XML grammar as well as its exact
// current public inventory. Counting <url> tags alone missed escaped text nodes.
function assertPublicSitemap(sitemap) {
  assert.equal(typeof sitemap, 'string');
  assert.doesNotMatch(sitemap, /\\n/, 'Sitemap separators must be real whitespace');
  const root = sitemap.match(/^<\?xml version="1\.0"(?: encoding="UTF-8")?\?>\s*<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">([\s\S]*?)<\/urlset>\s*$/);
  assert.ok(root, 'One standard Sitemap urlset document is required');
  const entry = /<url><loc>([^<]+)<\/loc>(?:<lastmod>(\d{4}-\d{2}-\d{2})<\/lastmod>)?<\/url>/g;
  const rows = [...root[1].matchAll(entry)].map(match => ({ location: match[1], lastmod: match[2] ?? null }));
  assert.equal(root[1].replace(entry, '').trim(), '', 'urlset may contain only URL elements and whitespace');
  assert.equal(rows.length, 49, 'The existing public sitemap inventory is preserved');
  assert.equal(new Set(rows.map(row => row.location)).size, rows.length, 'No duplicate public URLs');
  for (const row of rows) {
    const url = new URL(row.location);
    assert.equal(url.protocol, 'https:');
    assert.equal(url.origin, base);
    assert.equal(url.username, '');
    assert.equal(url.password, '');
    assert.equal(url.search, '');
    assert.equal(url.hash, '');
    assert.doesNotMatch(url.pathname, /\/(?:api|auth(?:-[a-z-]+)?|account(?:-[a-z-]+)?|saved-calculations?|secure-import|quarantine-review|delivery-operations)(?:\/|$)/i, 'No private/auth/API entries');
  }
  assert.deepEqual(rows, expected, 'Every existing URL, order and lastmod is retained');
  return rows;
}

const validExample = () => '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
  + expected.map(row => '<url><loc>' + row.location + '</loc>' + (row.lastmod ? '<lastmod>' + row.lastmod + '</lastmod>' : '') + '</url>').join('\n')
  + '\n</urlset>\n';

test('public sitemap contract rejects escaped text and changed/private URL inventories', () => {
  assert.equal(expected.length, 49);
  const valid = validExample();
  assert.equal(assertPublicSitemap(valid).length, 49);
  const first = expected[0].location;
  const mutations = [
    ['literal newline separator', source => source.replace('</url>\n', '</url>\\n')],
    ['unexpected element-only text', source => source.replace('</url>\n', '</url>unexpected text\n')],
    ['duplicate URL', source => source.replace(expected[1].location, first)],
    ['foreign origin', source => source.replace(first, 'https://foreign.example/')],
    ['URL credentials', source => source.replace(first, 'https://user:secret@terminal.qellyintelligence.com/')],
    ['URL query', source => source.replace(first, first + '?private=value')],
    ['URL fragment', source => source.replace(first, first + '#/account-session')],
    ['private account path', source => source.replace(first, base + '/account-session/')],
    ['authentication path', source => source.replace(first, base + '/auth-login/')],
    ['missing entry', source => source.replace('<url><loc>' + first + '</loc></url>', '')],
    ['changed lastmod', source => source.replace('2026-09-21', '2026-09-22')],
    ['wrong namespace', source => source.replace('http://www.sitemaps.org/schemas/sitemap/0.9', 'https://foreign.example/schema')],
    ['malformed URL element', source => source.replace('</loc>', '</location>')],
    ['changed order', source => source.replace('<url><loc>' + first + '</loc></url>', '<url><loc>temporary</loc></url>').replace('<url><loc>' + expected[1].location + '</loc></url>', '<url><loc>' + first + '</loc></url>').replace('<url><loc>temporary</loc></url>', '<url><loc>' + expected[1].location + '</loc></url>')],
  ];
  for (const [name, mutate] of mutations) assert.throws(() => assertPublicSitemap(mutate(valid)), name);
});

test('the production generator sequence emits 49 URLs with schema-compatible element-only content', async () => {
  const output = await mkdtemp(path.join(os.tmpdir(), 'qelly-public-sitemap-content-'));
  try {
    await writeFile(path.join(output, 'sitemap.xml'), renderSitemap({ publicSiteUrl: base, basePath: '/' }));
    const environment = { QELLY_CANONICAL_SITE_URL: base };
    const calculators = await generatePublicCalculatorNetwork({ output, environment });
    const assets = await generatePublicAssetResearch({ output, environment });
    assert.equal(calculators.calculators, 36);
    assert.equal(calculators.sitemapEntries, 37);
    assert.equal(assets.assets, 6);
    const sitemap = await readFile(path.join(output, 'sitemap.xml'), 'utf8');
    assert.equal(assertPublicSitemap(sitemap).length, 49);
  } finally {
    await rm(output, { recursive: true, force: true });
  }
});
