const VALID_ENVIRONMENTS = new Set(['local', 'test', 'preview', 'staging', 'production']);
const FORBIDDEN_PUBLIC_BETA_FLAGS = new Set([
  'realMoneyTrading',
  'custody',
  'depositsWithdrawals',
  'privateKeyStorage',
  'seedPhraseCollection',
  'autonomousExecution'
]);

export function validatePublicBetaRuntimeConfig(input) {
  if (!input || typeof input !== 'object') throw new TypeError('Runtime configuration must be an object.');
  const environment = String(input.environment || 'local');
  if (!VALID_ENVIRONMENTS.has(environment)) throw new RangeError(`Unsupported environment: ${environment}`);
  const flags = { ...(input.flags || {}) };
  const violations = [];
  for (const name of FORBIDDEN_PUBLIC_BETA_FLAGS) {
    if (flags[name] === true || flags[name] === 'enabled') violations.push(name);
  }
  if (violations.length) {
    throw new Error(`Public-beta safety boundary violated: ${violations.join(', ')}`);
  }
  const publicBasePath = String(input.publicBasePath || '/qelly-intelligence/');
  if (!publicBasePath.startsWith('/') || !publicBasePath.endsWith('/')) {
    throw new TypeError('publicBasePath must start and end with a slash.');
  }
  return Object.freeze({
    environment,
    publicBasePath,
    flags: Object.freeze(flags),
    providerTimeoutMs: Math.max(100, Number(input.providerTimeoutMs || 8000)),
    errorReporting: Boolean(input.errorReporting),
    readOnlyConnections: Boolean(input.readOnlyConnections),
    realMoneyTrading: false,
    custody: false,
    depositsWithdrawals: false,
    privateKeyStorage: false,
    seedPhraseCollection: false,
    autonomousExecution: false
  });
}

export function publicBetaSafetySnapshot(config) {
  const value = validatePublicBetaRuntimeConfig(config);
  return Object.freeze({
    environment: value.environment,
    readOnlyConnections: value.readOnlyConnections,
    realMoneyTrading: false,
    custody: false,
    secretMaterialAccepted: false
  });
}
