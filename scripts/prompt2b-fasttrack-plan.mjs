import { appendFile, readFile } from 'node:fs/promises';

const modeFile = process.env.QELLY_FAST_TRACK_MODE_FILE ?? 'project-state/QELLY_PROMPT2B_FAST_TRACK_MODE.json';
const config = JSON.parse(await readFile(modeFile, 'utf8'));
const browsers = ['chromium','firefox','webkit'];
const routes = ['calculator-center','india-finance','indicator-library','formula-library','saved-calculations','formula-detail','indicator-detail','calculator-detail','saved-calculation-detail'];
const a11yRoutes = [
  'auth-login','auth-register','auth-recovery','account-session','onboarding','discovery-hub','live-markets','identity-access','security-evidence',
  'security-setup','secure-import-vault','passkey-center','account-recovery','delivery-operations','platform-readiness','secret-rotation','quarantine-review','staging-assurance',
  'calculator-center','india-finance','indicator-library','formula-library','saved-calculations','formula-detail','indicator-detail','calculator-detail','saved-calculation-detail'
];
if (!['focused','acceptance'].includes(config.mode)) throw new Error(`Unsupported mode: ${config.mode}`);
const browserMatrix = config.mode === 'acceptance'
  ? browsers.flatMap(browser => routes.map(route => ({ browser, route })))
  : config.focus.browserShards;
const accessibilityMatrix = config.mode === 'acceptance'
  ? a11yRoutes.map(route => ({ route }))
  : config.focus.a11yRoutes.map(route => ({ route }));
const browserKeys = new Set(browserMatrix.map(item => `${item.browser}|${item.route}`));
if (browserKeys.size !== browserMatrix.length) throw new Error('Duplicate browser shard in plan');
for (const item of browserMatrix) {
  if (!browsers.includes(item.browser) || !routes.includes(item.route)) throw new Error(`Invalid browser shard: ${JSON.stringify(item)}`);
}
if (config.mode === 'acceptance' && browserMatrix.length !== 27) throw new Error(`Acceptance requires exactly 27 browser shards, got ${browserMatrix.length}`);
const a11yKeys = new Set(accessibilityMatrix.map(item => item.route));
if (a11yKeys.size !== accessibilityMatrix.length) throw new Error('Duplicate accessibility shard in plan');
for (const item of accessibilityMatrix) if (!a11yRoutes.includes(item.route)) throw new Error(`Invalid accessibility route: ${item.route}`);
if (config.mode === 'acceptance' && accessibilityMatrix.length !== 27) throw new Error(`Acceptance requires exactly 27 accessibility shards, got ${accessibilityMatrix.length}`);
const output = {
  mode: config.mode,
  browserMatrix,
  accessibilityMatrix,
  browserShardCount: browserMatrix.length,
  browserCaseCount: browserMatrix.length * 72,
  accessibilityShardCount: accessibilityMatrix.length,
  accessibilityCheckCount: accessibilityMatrix.length * 2
};
if (process.env.GITHUB_OUTPUT) {
  await appendFile(process.env.GITHUB_OUTPUT, `mode=${output.mode}\n`);
  await appendFile(process.env.GITHUB_OUTPUT, `browser_matrix=${JSON.stringify({ include: browserMatrix })}\n`);
  await appendFile(process.env.GITHUB_OUTPUT, `a11y_matrix=${JSON.stringify({ include: accessibilityMatrix })}\n`);
  await appendFile(process.env.GITHUB_OUTPUT, `browser_shards=${output.browserShardCount}\n`);
  await appendFile(process.env.GITHUB_OUTPUT, `browser_cases=${output.browserCaseCount}\n`);
  await appendFile(process.env.GITHUB_OUTPUT, `a11y_shards=${output.accessibilityShardCount}\n`);
  await appendFile(process.env.GITHUB_OUTPUT, `a11y_checks=${output.accessibilityCheckCount}\n`);
}
console.log(JSON.stringify(output, null, 2));
