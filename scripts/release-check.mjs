import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { apiRoutes, contracts, productVersion, routes } from '../src/server/route-manifest.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readJson = async (file) => JSON.parse(await readFile(path.join(root, file), 'utf8'));
const pkg = await readJson('package.json');
const validation = await readJson('validation/PRODUCT_VALIDATION.json');
const smoke = await readJson('validation/SMOKE_LOG.json');
const routeInventory = await readJson('artifacts/QELLY_ROUTE_INVENTORY.json');
const apiInventory = await readJson('artifacts/QELLY_API_INVENTORY.json');
const sourceTree = (await readFile(path.join(root, 'artifacts/QELLY_SOURCE_TREE.txt'), 'utf8'))
  .trim()
  .split(/\r?\n/)
  .filter(Boolean);
const schemas = (await readdir(path.join(root, 'packages/schemas'))).filter((name) => name.endsWith('.json'));
const envExample = await readFile(path.join(root, '.env.example'), 'utf8');
const readme = await readFile(path.join(root, 'README.md'), 'utf8');
const vercel = await readJson('vercel.json');
const readmeUrls = [...readme.matchAll(/\]\((https?:\/\/[^)\s]+)\)/g)].map(([, url]) => url);
const canonicalPublicSiteUrl = new URL('https://qelly-intelligence.pages.dev');

const required = [
  'LICENSE',
  'SECURITY.md',
  'CONTRIBUTING.md',
  'packages/migrations/105_scope_a_decision_provenance.sql',
  'packages/migrations/107_calculator_indicator_foundation.sql',
  'packages/migrations/108_saved_calculation_lifecycle.sql',
  'docs/deployment/VERCEL_IMPORT_CHECKLIST.md',
  'docs/deployment/ENVIRONMENT_REFERENCE.md',
  'docs/deployment/PRODUCTION_DEPENDENCY_POLICY.md',
  'docs/deployment/ROLLBACK_RUNBOOK.md',
  'docs/deployment/BACKUP_RESTORE_RUNBOOK.md'
];
for (const file of required) await stat(path.join(root, file));

const identity = spawnSync(process.execPath, ['scripts/production-identity-check.mjs'], {
  cwd: root,
  encoding: 'utf8',
  env: {
    ...process.env,
    NODE_ENV: 'test',
    QELLY_DEVELOPMENT_IDENTITY_ENABLED: 'false'
  }
});
const secrets = spawnSync(process.execPath, ['scripts/secret-scan.mjs'], {
  cwd: root,
  encoding: 'utf8'
});
const functionPaths = Object.keys(vercel.functions ?? {});
const result = {
  status: 'release-check-passed',
  productVersion,
  packageVersion: pkg.version,
  routes: routes.length,
  apiContracts: apiRoutes.length,
  contracts: contracts.size,
  schemas: schemas.length,
  validationCurrent: validation.status === 'product-validation-passed'
    && validation.productVersion === productVersion
    && validation.routes === routes.length
    && validation.apiContracts === apiRoutes.length
    && validation.schemas === schemas.length,
  smokeCurrent: smoke.status === 'smoke-passed'
    && smoke.productVersion === productVersion
    && smoke.requests === 290,
  routeInventoryCurrent: routeInventory.productVersion === productVersion
    && routeInventory.count === routes.length,
  apiInventoryCurrent: apiInventory.productVersion === productVersion
    && apiInventory.count === apiRoutes.length,
  sourceInventoryPresent: sourceTree.length > 450 && new Set(sourceTree).size === sourceTree.length,
  productionIdentityIsolation: identity.status === 0
    && identity.stdout.includes('production-identity-isolation-passed'),
  secretScan: secrets.status === 0 && secrets.stdout.includes('secret-scan-passed'),
  financialSafety: [
    'QELLY_LIVE_TRADING_ENABLED=false',
    'QELLY_ASSET_TRANSFERS_ENABLED=false',
    'QELLY_WITHDRAWALS_ENABLED=false',
    'QELLY_PRIVATE_KEYS_ENABLED=false',
    'QELLY_RECOVERY_PHRASES_ENABLED=false'
  ].every((value) => envExample.includes(value)),
  truthfulDeployability: readme.includes('**Public beta deployed.**')
    && readmeUrls.some((candidate) => {
      try {
        const parsed = new URL(candidate);
        return parsed.protocol === canonicalPublicSiteUrl.protocol
          && parsed.hostname === canonicalPublicSiteUrl.hostname
          && parsed.pathname === '/'
          && parsed.search === ''
          && parsed.hash === '';
      } catch {
        return false;
      }
    })
    && readme.includes('Cloudflare Pages Functions')
    && !readme.includes('Public production deployment verified'),
  vercelFunctionPathsExist: functionPaths.every((file) => sourceTree.includes(file))
};
const bad = Object.entries(result).filter(([, value]) => value === false || value == null);
if (pkg.version !== productVersion
  || routes.length !== 71
  || apiRoutes.length !== 207
  || contracts.size !== 18
  || schemas.length !== 72
  || bad.length) {
  throw new Error(JSON.stringify({
    result,
    bad,
    identityStderr: identity.stderr.trim(),
    secretScanStderr: secrets.stderr.trim()
  }, null, 2));
}
console.log(JSON.stringify(result, null, 2));
