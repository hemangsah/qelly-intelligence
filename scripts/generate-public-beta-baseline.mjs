import { readFile, writeFile, readdir, mkdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

const root = process.cwd();
const stateDir = path.join(root, 'project-state');
await mkdir(stateDir, { recursive: true });

const csvCell = (value) => {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};
const csv = (header, rows) => `${[header, ...rows].map((row) => row.map(csvCell).join(',')).join('\n')}\n`;
const sha256 = (value) => createHash('sha256').update(value).digest('hex');

async function walk(directory) {
  const output = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.name === '.git' || entry.name === 'node_modules' || entry.name.startsWith('.brand-')) continue;
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) output.push(...await walk(absolute));
    else if (entry.isFile()) output.push(absolute);
  }
  return output;
}

const routeSource = await readFile(path.join(root, 'apps/web/public/assets/route-registry.mjs'), 'utf8');
const routePattern = /\{ section:'([^']+)', route:'([^']+)', label:'([^']+)', icon:icon\('([^']+)'\), meta:'([^']+)'([^}]*)\}/g;
const routeRows = [];
for (const match of routeSource.matchAll(routePattern)) {
  const [, section, route, label, , milestone, extras] = match;
  const isPublic = extras.includes('public:true');
  const isHidden = extras.includes('hidden:true');
  const anonymousOnly = extras.includes('anonymousOnly:true');
  routeRows.push([
    route,
    label,
    section,
    milestone,
    isPublic,
    isHidden,
    anonymousOnly,
    isPublic ? 'Implemented Deterministically' : 'Partial Prototype',
    isPublic ? 'DEMO' : 'UNAVAILABLE',
    isPublic
      ? 'Static visual-preview route; backend/provider connectivity is not implied.'
      : 'Route shell exists; authenticated, persistent or provider-backed behavior requires backend evidence.'
  ]);
}
routeRows.sort((a, b) => a[0].localeCompare(b[0]));
await writeFile(path.join(stateDir, 'QELLY_ROUTE_STATUS.csv'), csv(
  ['route','label','section','milestone','public','hidden','anonymous_only','classification','data_state','notes'],
  routeRows
));

const sourceFiles = (await walk(root)).filter((file) => /\.(?:mjs|js|json|html)$/.test(file));
const endpoints = new Map();
const registerEndpoint = (method, endpoint, source, classification, dataState, notes) => {
  const normalized = endpoint
    .replace(/\$\{[^}]+\}/g, '{parameter}')
    .replace(/\(\[\^\/\]\+\)/g, '{parameter}');
  const key = `${method} ${normalized}`;
  if (!endpoints.has(key)) endpoints.set(key, [method, normalized, source, classification, dataState, notes]);
};
for (const file of sourceFiles) {
  const relative = path.relative(root, file).split(path.sep).join('/');
  let value;
  try { value = await readFile(file, 'utf8'); } catch { continue; }
  for (const match of value.matchAll(/["'`](\/api\/v1\/[A-Za-z0-9_\-./${}]+)["'`]/g)) {
    registerEndpoint('GET', match[1], relative, 'Inventory Only', 'UNKNOWN', 'Method and connectivity require executable route verification.');
  }
}
const staticPreview = 'apps/web/public/assets/static-preview-api.mjs';
for (const endpoint of [
  '/api/v1/config',
  '/api/v1/auth/status',
  '/api/v1/public/markets/overview',
  '/api/v1/public/markets/assets',
  '/api/v1/public/providers',
  '/api/v1/evidence/graphs',
  '/api/v1/evidence/graphs/{graphId}',
  '/api/v1/evidence/graphs/{graphId}/export',
  '/api/v1/public/markets/assets/{assetId}',
  '/api/v1/public/markets/assets/{assetId}/candles'
]) {
  registerEndpoint('GET', endpoint, staticPreview, 'Implemented Deterministically', 'DEMO', 'Static preview returns deterministic demo data and explicitly reports backend unavailability.');
}
const apiRows = [...endpoints.values()].sort((a, b) => `${a[0]} ${a[1]}`.localeCompare(`${b[0]} ${b[1]}`));
await writeFile(path.join(stateDir, 'QELLY_API_INVENTORY.csv'), csv(
  ['method','endpoint','source_file','classification','data_state','notes'],
  apiRows
));

const tracked = [
  'design/QELLY_BRAND_FOUNDATION_FREEZE.md',
  'config/public-beta.environments.json',
  'config/public-beta.feature-flags.json',
  'packages/schemas/public-beta-truth-state.schema.json',
  'packages/schemas/public-beta-evidence-metadata.schema.json',
  'src/public-beta/truth-state.mjs',
  'src/public-beta/provider-adapter.mjs',
  'src/public-beta/runtime-config.mjs',
  'src/public-beta/observability.mjs'
];
const files = [];
for (const relative of tracked) {
  const absolute = path.join(root, relative);
  const value = await readFile(absolute);
  const details = await stat(absolute);
  files.push({ path: relative, bytes: details.size, sha256: sha256(value) });
}
const commit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const generatedAt = execFileSync('git', ['show', '-s', '--format=%cI', 'HEAD'], { encoding: 'utf8' }).trim();
const manifest = {
  schemaVersion: 1,
  generatedAt,
  sourceCommit: commit,
  foundationCommit: '94fbd4ff91c0d61f87e42724038f03fa5c36f97a',
  classificationPolicy: 'Executable evidence controls status. Registry presence alone is not implementation or connectivity.',
  counts: {
    routes: routeRows.length,
    apiReferences: apiRows.length,
    governedFoundationFiles: files.length
  },
  safety: {
    realMoneyTrading: false,
    custody: false,
    depositsWithdrawals: false,
    privateKeyStorage: false,
    seedPhraseCollection: false,
    autonomousExecution: false
  },
  files
};
await writeFile(path.join(stateDir, 'QELLY_IMPLEMENTATION_MANIFEST.json'), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(JSON.stringify({ result: 'passed', ...manifest.counts, sourceCommit: commit }, null, 2));
