import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { inspectDeploymentEnvironment } from '../src/production/deployment-environment.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const example = await readFile(path.join(root, '.env.example'), 'utf8');
const requiredSafety = [
  'QELLY_LIVE_TRADING_ENABLED=false',
  'QELLY_ASSET_TRANSFERS_ENABLED=false',
  'QELLY_WITHDRAWALS_ENABLED=false',
  'QELLY_PRIVATE_KEYS_ENABLED=false',
  'QELLY_RECOVERY_PHRASES_ENABLED=false'
];
const missingSafety = requiredSafety.filter((entry) => !example.includes(entry));
const result = inspectDeploymentEnvironment(process.env);
if (missingSafety.length || !result.ok) {
  console.error(JSON.stringify({
    status: 'environment-invalid',
    production: result.production,
    stage: result.stage,
    missingSafety,
    failures: result.failures
  }, null, 2));
  process.exit(1);
}
console.log(JSON.stringify({
  status: 'environment-valid',
  production: result.production,
  stage: result.stage,
  strictProductionDependencies: result.production,
  safetyFlags: 'disabled'
}, null, 2));
