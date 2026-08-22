import { lstat, readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, 'dist/frontend');
const expectedBasePath = '/qelly-intelligence/';

const requiredFiles = [
  'index.html',
  '404.html',
  'qelly-config.js',
  'BUILD_INFO.json',
  'manifest.webmanifest',
  'favicon.svg',
  'favicon.ico',
  'apple-touch-icon.png',
  'safari-pinned-tab.svg',
  'icons/qelly-192.png',
  'icons/qelly-512.png',
  'icons/qelly-maskable-512.png',
  'social/qelly-social-preview.png',
  'assets/app.js',
  'assets/static-preview-api.mjs',
  'assets/persona-profiles.mjs',
  'assets/shell-foundations.mjs',
  'assets/icon-registry.mjs',
  'assets/hash-route-state.mjs',
  'assets/route-registry.mjs',
  'assets/qelly-foundations.css',
  'assets/ui-rescue.css',
  'assets/qelly-premium-reset.css',
  'assets/premium-foundations.css',
  'assets/premium-rankings.css',
  'assets/premium-table.css',
  'assets/premium-chart.css',
  'assets/premium-mobile.css',
  'assets/premium-font-surface.css',
  'assets/premium-font-worldquant-arkham.css',
  'assets/qelly-font-governance.css',
  'assets/qelly-ui-lock-v5.css',
  'assets/qelly-ui-lock-v5-markets.css',
  'assets/qelly-ui-lock-v5-3.css',
  'assets/qelly-ui-lock-v5.mjs',
  'assets/qelly-ui-lock-v5-3.mjs',
  'assets/fonts/ibm-plex-sans-variable.woff2',
  'assets/fonts/ibm-plex-sans-variable.woff2.LICENSE.txt',
  'assets/routes/asset-rankings.mjs',
  'assets/routes/asset-rankings-premium.mjs',
  'assets/routes/asset-rankings-data.mjs',
  'assets/routes/asset-rankings-chart.mjs',
  'assets/routes/asset-rankings-table.mjs',
  'assets/routes/calculator-center.mjs',
  'assets/routes/india-finance-center.mjs',
  'assets/routes/indicator-library.mjs',
  'assets/routes/formula-library.mjs',
  'assets/routes/saved-calculations.mjs',
  'assets/routes/formula-detail.mjs',
  'assets/routes/indicator-detail.mjs',
  'assets/routes/calculator-detail.mjs',
  'assets/routes/saved-calculation-detail.mjs',
  'assets/calculation/formula-engine.mjs',
  'assets/calculation/formula-engine-extended.mjs',
  'assets/calculation/fresh-formula-catalog.mjs',
  'assets/calculation/fresh-formula-core.mjs',
  'assets/calculation/fresh-formula-tvm-loans-fixed.mjs',
  'assets/calculation/fresh-formula-returns-portfolio.mjs',
  'assets/calculation/fresh-formula-risk-statistics.mjs',
  'assets/calculation/fresh-formula-regression-derivatives.mjs',
  'assets/calculation/fresh-formula-fx-crypto-exposure.mjs',
  'assets/calculation/fresh-formula-utilities.mjs',
  'assets/calculation/indicator-engine.mjs',
  'assets/calculation/indicator-engine-extended.mjs',
  'assets/calculation/fresh-indicator-catalog.mjs',
  'assets/calculation/persistence.mjs',
  'assets/tokens.css',
  'assets/tokens.json',
  'assets/qelly-brand.css',
  'assets/qelly-brand.mjs',
  'assets/brand/qelly-logo-primary.svg',
  'assets/brand/qelly-symbol.svg',
  'packages/accessibility/accessibility.mjs',
  'packages/ui-primitives/primitives.mjs',
  'packages/data-grid/data-grid.mjs',
  'packages/charting/chart-shell.mjs'
];

const allowedExtensions = new Set(['.html', '.css', '.js', '.mjs', '.json', '.webmanifest', '.xml', '.svg', '.png', '.ico', '.woff2', '.txt']);
const textExtensions = new Set(['.html', '.css', '.js', '.mjs', '.json', '.webmanifest', '.xml', '.svg', '.txt']);
const forbiddenFilePattern = /(^|\/)(?:\.env(?:\.|$)|runtime(?:\/|$)|uploads?(?:\/|$))|(?:^|\/).+\.(?:zip|tar|tgz|gz|7z|rar|db|sqlite|sqlite3|wal|shm|pem|key|p12|pfx)$/i;
const forbiddenTextPatterns = [
  ['private-key', /-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/],
  ['credential-bearing-url', /\b(?:postgres(?:ql)?|redis(?:s)?|mysql|mongodb(?:\+srv)?|https?):\/\/[^/\s:@]+:[^/\s@]+@/i],
  ['github-token', /\bgh[pousr]_[A-Za-z0-9]{20,}\b/],
  ['aws-access-key', /\bAKIA[0-9A-Z]{16}\b/],
  ['slack-token', /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/],
  ['stripe-live-secret', /\bsk_live_[A-Za-z0-9]{16,}\b/],
  ['google-api-key', /\bAIza[0-9A-Za-z_-]{30,}\b/],
  ['npm-token', /\bnpm_[A-Za-z0-9]{30,}\b/]
];

async function walk(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    const info = await lstat(absolute);
    if (info.isSymbolicLink()) throw new Error(`Symbolic links are not allowed in the Pages artifact: ${path.relative(output, absolute)}`);
    if (info.isDirectory()) files.push(...await walk(absolute));
    else if (info.isFile()) files.push(absolute);
  }
  return files;
}

const relative = file => path.relative(output, file).replaceAll('\\', '/');

function parseRuntimeConfig(text) {
  const match = text.match(/^window\.__QELLY_CONFIG__=Object\.freeze\((\{.*\})\);\s*$/s);
  if (!match) throw new Error('qelly-config.js must contain one frozen JSON object');
  return JSON.parse(match[1]);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function pngDimensions(buffer) {
  assert(buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])), 'PNG asset has an invalid signature');
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

const files = await walk(output);
const names = files.map(relative).sort();
const nameSet = new Set(names);

for (const required of requiredFiles) assert(nameSet.has(required), `Missing required Pages artifact file: ${required}`);
for (const name of names) {
  assert(allowedExtensions.has(path.extname(name).toLowerCase()), `Unexpected file type in Pages artifact: ${name}`);
  assert(!forbiddenFilePattern.test(name), `Forbidden file in Pages artifact: ${name}`);
}
for (const file of files.filter(candidate => textExtensions.has(path.extname(candidate).toLowerCase()))) {
  const text = await readFile(file, 'utf8');
  for (const [rule, pattern] of forbiddenTextPatterns) assert(!pattern.test(text), `Potential ${rule} in Pages artifact: ${relative(file)}`);
}

const font = 'assets/fonts/ibm-plex-sans-variable.woff2';
const fontInfo = await stat(path.join(output, font));
assert(fontInfo.size > 10000 && fontInfo.size < 500000, `${font} has an implausible variable-font size`);
const licenseText = await readFile(path.join(output, 'assets/fonts/ibm-plex-sans-variable.woff2.LICENSE.txt'), 'utf8');
assert(/SIL OPEN FONT LICENSE/i.test(licenseText), 'IBM Plex license notice missing');
assert(!names.some(name => /assets\/fonts\/geist-(?:mono-)?variable\.woff2$/.test(name)), 'Superseded Geist product fonts must not ship');

const config = parseRuntimeConfig(await readFile(path.join(output, 'qelly-config.js'), 'utf8'));
assert(
  JSON.stringify(Object.keys(config).sort()) === JSON.stringify(['apiBaseUrl', 'backendAvailable', 'basePath', 'dataMode', 'deploymentStage', 'previewLabel', 'staticVisualPreview'].sort()),
  'qelly-config.js contains unexpected fields'
);
assert(
  config.apiBaseUrl === '' &&
  config.deploymentStage === 'github-pages-static-preview' &&
  config.basePath === expectedBasePath &&
  config.staticVisualPreview === true &&
  config.previewLabel === 'Static visual preview' &&
  config.dataMode === 'deterministic-demo' &&
  config.backendAvailable === false,
  'Static preview configuration truth mismatch'
);

const index = await readFile(path.join(output, 'index.html'), 'utf8');
assert(index.includes(`<base href="${expectedBasePath}">`), 'index.html missing repository base path');
for (const asset of [
  'manifest.webmanifest',
  'qelly-brand.css',
  'qelly-font-governance.css',
  'qelly-ui-lock-v5.css',
  'qelly-ui-lock-v5-markets.css',
  'qelly-ui-lock-v5-3.css',
  'qelly-ui-lock-v5.mjs',
  'qelly-ui-lock-v5-3.mjs'
]) {
  assert(index.includes(asset), `index.html missing governed asset: ${asset}`);
}
const fontGovernance = await readFile(path.join(output, 'assets/qelly-font-governance.css'), 'utf8');
assert(fontGovernance.includes('ibm-plex-sans-variable.woff2'), 'Font governance stylesheet must reference the packaged IBM Plex variable font');

const app = await readFile(path.join(output, 'assets/app.js'), 'utf8');
for (const phrase of ["import { parseHashRoute } from './hash-route-state.mjs'", 'routeQuery: new URLSearchParams()', 'query:state.routeQuery']) {
  assert(app.includes(phrase), `app.js missing query-safe detail routing: ${phrase}`);
}
assert(!/from\s+["']\/packages\//.test(app), 'app.js contains root-relative package imports');

const routeRegistry = await import(`${pathToFileURL(path.join(output, 'assets/route-registry.mjs')).href}?review=${Date.now()}`);
assert(routeRegistry.routeDefinitions.length === 71, 'Static preview route registry must contain exactly 71 routes');
const routeIds = new Set(routeRegistry.routeDefinitions.map(item => item.route));
for (const route of ['qelly-verify', 'calculator-center', 'india-finance', 'indicator-library', 'formula-library', 'saved-calculations', 'formula-detail', 'indicator-detail', 'calculator-detail', 'saved-calculation-detail']) {
  assert(routeIds.has(route), `Missing public/static route ${route}`);
}

const formulaEngine = await import(`${pathToFileURL(path.join(output, 'assets/calculation/formula-engine-extended.mjs')).href}?review=${Date.now()}`);
const indicatorEngine = await import(`${pathToFileURL(path.join(output, 'assets/calculation/indicator-engine-extended.mjs')).href}?review=${Date.now()}`);
assert(formulaEngine.listFormulaDefinitions().length === 151, 'Static preview must expose 151 formulas');
assert(indicatorEngine.listIndicatorDefinitions().length === 54, 'Static preview must expose 54 indicators');

for (const file of ['assets/routes/formula-detail.mjs', 'assets/routes/indicator-detail.mjs', 'assets/routes/calculator-detail.mjs', 'assets/routes/saved-calculation-detail.mjs']) {
  const text = await readFile(path.join(output, file), 'utf8');
  assert(/DETERMINISTIC|FRESH_REIMPLEMENTATION|SHARED/.test(text), `${file} missing truth-state language`);
}

const manifest = JSON.parse(await readFile(path.join(output, 'manifest.webmanifest'), 'utf8'));
assert(manifest.name === 'Qelly Intelligence' && manifest.start_url === './#/market' && manifest.scope === './', 'Web app manifest truth mismatch');
for (const requiredSize of ['192x192', '512x512']) {
  assert(manifest.icons?.some(icon => icon.sizes === requiredSize && icon.src.startsWith('./icons/')), `Missing ${requiredSize} icon`);
}

const svgFiles = ['favicon.svg', 'safari-pinned-tab.svg', 'assets/brand/qelly-logo-primary.svg', 'assets/brand/qelly-symbol.svg'];
for (const name of svgFiles) {
  const svg = await readFile(path.join(output, name), 'utf8');
  assert(/^<svg\b/.test(svg.trim()) && /viewBox=/.test(svg) && !/<script\b|\son\w+=|\b(?:href|xlink:href)=["']https?:/i.test(svg), `${name} is unsafe or invalid`);
}
for (const [name, width, height] of [
  ['icons/qelly-192.png', 192, 192],
  ['icons/qelly-512.png', 512, 512],
  ['icons/qelly-maskable-512.png', 512, 512],
  ['apple-touch-icon.png', 180, 180],
  ['social/qelly-social-preview.png', 1200, 630]
]) {
  const dimensions = pngDimensions(await readFile(path.join(output, name)));
  assert(dimensions.width === width && dimensions.height === height, `${name} dimensions invalid`);
}

const redirect = await readFile(path.join(output, '404.html'), 'utf8');
assert(
  redirect.includes(JSON.stringify(expectedBasePath)) && (redirect.includes("'#/'+route") || redirect.includes("'#/'+'route".replace('+\'', ''))),
  '404.html must preserve hash direct navigation'
);

for (const file of files.filter(candidate => /\.(?:mjs|js)$/.test(candidate))) {
  const text = await readFile(file, 'utf8');
  for (const match of text.matchAll(/(?:from\s*|import\s*\()\s*["'](\.[^"']+)["']/g)) {
    const target = path.resolve(path.dirname(file), match[1]);
    assert(target.startsWith(`${output}${path.sep}`), `Module import escapes artifact: ${relative(file)}`);
    assert(nameSet.has(relative(target)), `Missing import target: ${relative(file)} -> ${match[1]}`);
  }
}

const buildInfo = JSON.parse(await readFile(path.join(output, 'BUILD_INFO.json'), 'utf8'));
assert(
  buildInfo.artifact === 'static-frontend' &&
  buildInfo.staticVisualPreview === true &&
  buildInfo.apiBaseConfigured === false &&
  buildInfo.basePath === expectedBasePath &&
  buildInfo.fonts?.selfHosted === true &&
  buildInfo.fonts?.ui === 'IBM Plex Sans Variable' &&
  buildInfo.fonts?.licensedOptionalActive === false,
  'BUILD_INFO truth mismatch'
);

console.log(JSON.stringify({
  status: 'pages-preview-validation-passed',
  label: 'Static visual preview',
  output: path.relative(root, output),
  basePath: expectedBasePath,
  files: names.length,
  routeCount: 71,
  formulaCount: 151,
  indicatorCount: 54,
  detailRoutes: 4,
  uiLock: 'UI_LOCK_V5_3',
  fonts: ['ibm-plex-sans-variable.woff2'],
  nativeFigma: 'UNAVAILABLE',
  secretFindings: 0
}, null, 2));
