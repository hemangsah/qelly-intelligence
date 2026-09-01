import { readFile, readdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { apiRoutes, contracts, productVersion, routes } from '../src/server/route-manifest.mjs';
import { routeDefinitions } from '../apps/web/public/assets/route-registry.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
const index = await readFile(path.join(root, 'apps/web/public/index.html'), 'utf8');
const routeInventory = await readFile(path.join(root, 'design/inventory/QELLY_ROUTE_INVENTORY.csv'), 'utf8');
const routeInventoryRoutes = routeInventory.split(/\r?\n/).slice(1).map((line) => line.match(/^"\d+","#\/([^"]+)"/)?.[1]).filter(Boolean);
const service = await readFile(path.join(root, 'src/markets/public-market-service.mjs'), 'utf8');
const evidence = await readFile(path.join(root, 'src/evidence/decision-provenance-store.mjs'), 'utf8');
const themeStudio = await readFile(path.join(root, 'apps/web/public/assets/routes/theme-intelligence-studio.mjs'), 'utf8');
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
  '.github/workflows/containers.yml',
  '.github/workflows/production-foundation-services.yml',
  '.github/workflows/release.yml',
  '.github/workflows/security.yml',
  'packages/migrations/105_scope_a_decision_provenance.sql',
  'packages/migrations/107_calculator_indicator_foundation.sql',
  'packages/migrations/108_saved_calculation_lifecycle.sql',
  'packages/contracts/calculator-indicator-foundation.contract.json',
  'packages/schemas/saved-calculation-input.schema.json',
  'packages/schemas/saved-calculation-update.schema.json',
  'packages/schemas/saved-calculation-restore.schema.json',
  'apps/web/public/assets/calculation/formula-engine.mjs',
  'apps/web/public/assets/calculation/formula-engine-extended.mjs',
  'apps/web/public/assets/calculation/fresh-formula-catalog.mjs',
  'apps/web/public/assets/calculation/indicator-engine.mjs',
  'apps/web/public/assets/calculation/indicator-engine-extended.mjs',
  'apps/web/public/assets/calculation/fresh-indicator-catalog.mjs',
  'apps/web/public/assets/calculation/persistence.mjs',
  'apps/web/public/assets/routes/calculator-center.mjs',
  'apps/web/public/assets/routes/india-finance-center.mjs',
  'apps/web/public/assets/routes/indicator-library.mjs',
  'apps/web/public/assets/routes/formula-library.mjs',
  'apps/web/public/assets/routes/saved-calculations.mjs',
  'apps/web/public/assets/routes/formula-detail.mjs',
  'apps/web/public/assets/routes/indicator-detail.mjs',
  'apps/web/public/assets/routes/calculator-detail.mjs',
  'apps/web/public/assets/routes/saved-calculation-detail.mjs',
  'src/calculations/saved-calculation-routes.mjs',
  'tests/fresh-formula-catalog.test.mjs',
  'tests/fresh-indicator-catalog.test.mjs',
  'tests/calculation-service-parity.test.mjs',
  'tests/browser-saved-calculation-lifecycle.test.mjs',
  'tests/saved-calculation-lifecycle.test.mjs',
  'docs/deployment/VERCEL_IMPORT_CHECKLIST.md',
  'docs/deployment/ENVIRONMENT_REFERENCE.md',
  'docs/deployment/PRODUCTION_DEPENDENCY_POLICY.md',
  'docs/deployment/ROLLBACK_RUNBOOK.md',
  'docs/deployment/BACKUP_RESTORE_RUNBOOK.md',
  'docs/governance/QELLY_PRODUCT_ARCHITECTURE.md',
  'docs/governance/QELLY_INFORMATION_ARCHITECTURE.md',
  'docs/governance/QELLY_REFERENCE_SYNTHESIS.md',
  'docs/governance/QELLY_DESIGN_PRINCIPLES.md',
  'design/tokens/QELLY_DESIGN_TOKENS.json',
  'design/tokens/QELLY_MOTION_TOKENS.json',
  'design/tokens/QELLY_CHART_TOKENS.json',
  'design/inventory/QELLY_COMPONENT_INVENTORY.csv',
  'design/inventory/QELLY_ROUTE_INVENTORY.csv',
  'design/inventory/QELLY_SCREEN_MATRIX.csv',
  'design/inventory/QELLY_FEATURE_MATRIX.csv',
  'docs/governance/QELLY_PROVIDER_MATRIX.csv',
  'docs/governance/QELLY_LICENSING_MATRIX.csv',
  'docs/governance/QELLY_ACCESSIBILITY_STANDARD.md',
  'docs/governance/QELLY_WRITING_STANDARD.md',
  'docs/governance/QELLY_RESPONSIVE_STANDARD.md',
  'docs/governance/QELLY_FIGMA_HANDOFF.md',
  'docs/governance/QELLY_FRONTEND_ARCHITECTURE.md',
  'docs/governance/QELLY_BACKEND_DOMAIN_MAP.md',
  'docs/governance/QELLY_DATA_NORMALIZATION.md',
  'docs/governance/QELLY_IMPLEMENTATION_ROADMAP.md',
  'docs/governance/QELLY_VALIDATION_REPORT.md',
  'design/figma/plugins/core/manifest.json',
  'design/figma/plugins/core/code.js'
];
const missingFiles = [];
for (const file of requiredFiles) {
  try {
    await stat(path.join(root, file));
  } catch {
    missingFiles.push(file);
  }
}
const forbiddenPublicFiles = [
  'apps/web/public/assets/qelly-v53-lock-candidate-convergence.mjs',
  'apps/web/public/assets/qelly-v53-lock-candidate-convergence.css'
];
const presentForbiddenPublicFiles = [];
for (const file of forbiddenPublicFiles) {
  try {
    await stat(path.join(root, file));
    presentForbiddenPublicFiles.push(file);
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
}

const requiredPublic = [
  '/api/v1/public/providers',
  '/api/v1/public/markets/overview',
  '/api/v1/public/markets/assets',
  '/api/v1/public/markets/assets/:id',
  '/api/v1/public/markets/assets/:id/candles',
  '/api/v1/discovery/asset-intelligence',
  '/api/v1/discovery/advanced-chart',
  '/api/v1/discovery/fundamentals-estimates',
  '/api/v1/discovery/filing-workspace'
];
const requiredEvidence = [
  '/api/v1/evidence/graphs',
  '/api/v1/evidence/explain-move',
  '/api/v1/evidence/graphs/:id',
  '/api/v1/evidence/graphs/:id/traverse',
  '/api/v1/evidence/graphs/:id/export'
];
const requiredSavedLifecycle = [
  '/api/v1/calculations/saved',
  '/api/v1/calculations/saved/:id',
  '/api/v1/calculations/saved/:id/revisions',
  '/api/v1/calculations/saved/:id/duplicate',
  '/api/v1/calculations/saved/:id/restore'
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
  forbiddenPublicAssetsAbsent: presentForbiddenPublicFiles.length === 0,
  routes: routes.length === 71 && new Set(routes).size === routes.length,
  routeRegistry: routeNames.length === routes.length && routes.every((route) => routeNames.includes(route)) && routeNames.every((route) => routes.includes(route)),
  routeInventory: routeInventoryRoutes.length === routes.length && routes.every((route) => routeInventoryRoutes.includes(route)) && routeInventoryRoutes.every((route) => routes.includes(route)),
  apiContracts: apiRoutes.length === 209 && new Set(apiRoutes).size === apiRoutes.length,
  contracts: contracts.size === 18,
  publicApis: requiredPublic.every((route) => apiRoutes.includes(route)),
  evidenceApis: requiredEvidence.every((route) => apiRoutes.includes(route)),
  savedLifecycleApis: requiredSavedLifecycle.every((route) => apiRoutes.includes(route)),
  dangerousAbsent: dangerous.every((route) => !apiRoutes.includes(route)),
  brand: index.includes('Qelly Intelligence · Verifiable Market Intelligence') && !/Release A5/i.test(index),
  themeStudioTruth: themeStudio.includes('DESIGN TOKEN SAMPLE · NO MARKET OBSERVATIONS') && themeStudio.includes('No provider observation is attached') && !/\b(?:BTC|ETH|SOL|AAPL|GOLD)\b|\bLive\b|64,466|3,412|2,431|180\.19M/.test(themeStudio),
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
  schemas: schemas.length === 72 && requiredPublicBetaSchemas.every((name) => schemas.includes(name))
};
const failed = Object.entries(checks).filter(([, value]) => !value);
if (failed.length) {
  throw new Error(JSON.stringify({ failed, missingFiles, presentForbiddenPublicFiles }, null, 2));
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
