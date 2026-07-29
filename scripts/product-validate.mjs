import { readFile, readdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { apiRoutes, contracts, productVersion, routes } from '../src/server/route-manifest.mjs';
import { routeDefinitions } from '../apps/web/public/assets/route-registry.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
const index = await readFile(path.join(root, 'apps/web/public/index.html'), 'utf8');
const service = await readFile(path.join(root, 'src/markets/public-market-service.mjs'), 'utf8');
const evidence = await readFile(path.join(root, 'src/evidence/decision-provenance-store.mjs'), 'utf8');
const schemas = (await readdir(path.join(root, 'packages/schemas'))).filter((name) => name.endsWith('.json'));
for (const file of schemas) JSON.parse(await readFile(path.join(root, 'packages/schemas', file), 'utf8'));
const requiredPublicBetaSchemas = [
  'public-beta-truth-state.schema.json',
  'public-beta-evidence-metadata.schema.json'
];

const requiredFiles = [
  'package.json',
  'package-lock.json',
  'README.md',
  '.env.example',
  '.gitignore',
  'LICENSE',
  'SECURITY.md',
  'CONTRIBUTING.md',
  'vercel.json',
  '.github/workflows/ci.yml',
  '.github/workflows/container.yml',
  '.github/workflows/production-foundation-services.yml',
  '.github/workflows/release.yml',
  '.github/workflows/codeql.yml',
  'packages/migrations/105_scope_a_decision_provenance.sql',
  'docs/deployment/VERCEL_IMPORT_CHECKLIST.md',
  'docs/deployment/ENVIRONMENT_REFERENCE.md',
  'docs/deployment/PRODUCTION_DEPENDENCY_POLICY.md',
  'docs/deployment/ROLLBACK_RUNBOOK.md',
  'docs/deployment/BACKUP_RESTORE_RUNBOOK.md',
  'QELLY_PRODUCT_ARCHITECTURE.md',
  'QELLY_INFORMATION_ARCHITECTURE.md',
  'QELLY_REFERENCE_SYNTHESIS.md',
  'QELLY_DESIGN_PRINCIPLES.md',
  'QELLY_DESIGN_TOKENS.json',
  'QELLY_MOTION_TOKENS.json',
  'QELLY_CHART_TOKENS.json',
  'QELLY_COMPONENT_INVENTORY.csv',
  'QELLY_ROUTE_INVENTORY.csv',
  'QELLY_SCREEN_MATRIX.csv',
  'QELLY_FEATURE_MATRIX.csv',
  'QELLY_PROVIDER_MATRIX.csv',
  'QELLY_LICENSING_MATRIX.csv',
  'QELLY_ACCESSIBILITY_STANDARD.md',
  'QELLY_WRITING_STANDARD.md',
  'QELLY_RESPONSIVE_STANDARD.md',
  'QELLY_FIGMA_HANDOFF.md',
  'QELLY_FRONTEND_ARCHITECTURE.md',
  'QELLY_BACKEND_DOMAIN_MAP.md',
  'QELLY_DATA_NORMALIZATION.md',
  'QELLY_IMPLEMENTATION_ROADMAP.md',
  'QELLY_VALIDATION_REPORT.md',
  'figma-plugin/manifest.json',
  'figma-plugin/code.js'
];
const missingFiles = [];
for (const file of requiredFiles) {
  try {
    await stat(path.join(root, file));
  } catch {
    missingFiles.push(file);
  }
}

const requiredPublic = [
  '/api/v1/public/providers',
  '/api/v1/public/markets/overview',
  '/api/v1/public/markets/assets',
  '/api/v1/public/markets/assets/:id',
  '/api/v1/public/markets/assets/:id/candles'
];
const requiredEvidence = [
  '/api/v1/evidence/graphs',
  '/api/v1/evidence/explain-move',
  '/api/v1/evidence/graphs/:id',
  '/api/v1/evidence/graphs/:id/traverse',
  '/api/v1/evidence/graphs/:id/export'
];
const dangerous = [
  '/api/v1/orders',
  '/api/v1/transfers',
  '/api/v1/withdrawals',
  '/api/v1/private-keys',
  '/api/v1/recovery-phrases'
];
const routeNames = routeDefinitions.map((item) => item.route);
const checks = {
  packageName: pkg.name === 'qelly-intelligence',
  version: pkg.version === productVersion,
  requiredFiles: missingFiles.length === 0,
  routes: routes.length === 61 && new Set(routes).size === routes.length,
  routeRegistry: routeNames.length === routes.length && routes.every((route) => routeNames.includes(route)),
  apiContracts: apiRoutes.length === 187 && new Set(apiRoutes).size === apiRoutes.length,
  contracts: contracts.size === 17,
  publicApis: requiredPublic.every((route) => apiRoutes.includes(route)),
  evidenceApis: requiredEvidence.every((route) => apiRoutes.includes(route)),
  dangerousAbsent: dangerous.every((route) => !apiRoutes.includes(route)),
  brand: index.includes('Qelly Intelligence · Verifiable Market Intelligence') && !/Release A5/i.test(index),
  evidenceIntegrity: [
    'DecisionRecord',
    'RiskAssessment',
    'EDGE_TYPES',
    'orphanedEdgeIds',
    'evidence.graph.created.v1'
  ].every((value) => evidence.includes(value)),
  truthLabels: [
    'live-public',
    'simulated',
    'degraded',
    'fallbackReason',
    'marketCap:null'
  ].every((value) => service.includes(value)),
  schemas: schemas.length === 67 && requiredPublicBetaSchemas.every((name) => schemas.includes(name))
};
const failed = Object.entries(checks).filter(([, value]) => !value);
if (failed.length) {
  throw new Error(JSON.stringify({ failed, missingFiles }, null, 2));
}

const result = {
  status: 'product-validation-passed',
  generatedAt: new Date().toISOString(),
  productVersion,
  routes: routes.length,
  apiContracts: apiRoutes.length,
  contracts: contracts.size,
  schemas: schemas.length,
  requiredFiles: requiredFiles.length,
  checks
};
await writeFile(path.join(root, 'validation/PRODUCT_VALIDATION.json'), `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify(result, null, 2));
