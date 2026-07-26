const SAFETY_FLAGS = [
  'QELLY_LIVE_TRADING_ENABLED',
  'QELLY_ASSET_TRANSFERS_ENABLED',
  'QELLY_WITHDRAWALS_ENABLED',
  'QELLY_PRIVATE_KEYS_ENABLED',
  'QELLY_RECOVERY_PHRASES_ENABLED'
];

const REQUIRED_MODES = {
  QELLY_PRODUCTION_FOUNDATION_ENABLED: 'true',
  QELLY_PRODUCTION_IDENTITY_ENABLED: 'true',
  QELLY_DEVELOPMENT_IDENTITY_ENABLED: 'false',
  QELLY_DATABASE_MODE: 'postgres',
  QELLY_JOB_QUEUE_MODE: 'redis',
  QELLY_OBJECT_STORAGE_MODE: 's3',
  QELLY_MALWARE_SCANNER_MODE: 'clamav',
  QELLY_REQUIRE_EXTERNAL_MALWARE_SCANNER: 'true',
  QELLY_DELIVERY_MODE: 'external',
  QELLY_SESSION_COOKIE_SAME_SITE: 'None',
  QELLY_STRICT_PRODUCTION_DEPENDENCIES: 'true',
  QELLY_REQUIRE_ACTIVE_WORKER: 'true',
  QELLY_POSTGRES_TLS_REJECT_UNAUTHORIZED: 'true',
  QELLY_REDIS_TLS_REJECT_UNAUTHORIZED: 'true'
};

const REQUIRED_PRODUCTION = [
  'DATABASE_URL',
  'QELLY_MIGRATION_DATABASE_URL',
  'REDIS_URL',
  'QELLY_SESSION_SECRET',
  'QELLY_PASSWORD_PEPPER',
  'QELLY_SECRET_KEYRING_JSON',
  'QELLY_SECRET_ACTIVE_KEY_ID',
  'QELLY_WORKER_ID',
  'S3_ENDPOINT',
  'S3_BUCKET',
  'S3_REGION',
  'S3_ACCESS_KEY_ID',
  'S3_SECRET_ACCESS_KEY',
  'CLAMAV_HOST',
  'QELLY_WEBHOOK_SIGNING_SECRET',
  'QELLY_EMAIL_API_URL',
  'QELLY_EMAIL_HEALTH_URL',
  'QELLY_EMAIL_API_TOKEN',
  'QELLY_OUTBOUND_ALLOWED_ORIGINS',
  'QELLY_FRONTEND_ORIGINS',
  'QELLY_WEBAUTHN_RP_ID',
  'QELLY_WEBAUTHN_ORIGINS'
];

const FORBIDDEN_OVERRIDES = [
  'QELLY_ALLOW_SQLITE_IN_PRODUCTION',
  'QELLY_ALLOW_DATABASE_QUEUE_IN_PRODUCTION',
  'QELLY_ALLOW_LOCAL_OBJECT_STORAGE_IN_PRODUCTION',
  'QELLY_ALLOW_FOUNDATION_SCANNER_IN_PRODUCTION',
  'QELLY_ALLOW_LOCAL_DELIVERY_IN_PRODUCTION',
  'QELLY_OUTBOUND_ALLOW_PRIVATE',
  'QELLY_OUTBOUND_ALLOW_HTTP'
];

const value = (environment, key) => String(environment[key] ?? '').trim();
const placeholder = (input) => !input || /[<>]|(?:replace[-_ ]?me|example|change[-_ ]?me|placeholder|localhost|127\.0\.0\.1|qelly\.test)/i.test(input);

function urlFailure(raw, { protocols, label, requireSslMode = false, requireCredentials = false, requireUsername = false, requireOrigin = false } = {}) {
  try {
    const parsed = new URL(raw);
    if (!protocols.includes(parsed.protocol)) return `${label} must use ${protocols.join(' or ')}`;
    if (requireCredentials && !parsed.password) return `${label} must include managed-service credentials`;
    if (requireUsername && !parsed.username) return `${label} must include a database username`;
    if (!requireCredentials && (parsed.username || parsed.password)) return `${label} must not contain URL credentials`;
    if (requireSslMode && !['require', 'verify-ca', 'verify-full'].includes(String(parsed.searchParams.get('sslmode') ?? '').toLowerCase())) {
      return `${label} must set sslmode=require, verify-ca, or verify-full`;
    }
    if (requireOrigin && parsed.toString().replace(/\/$/, '') !== parsed.origin) return `${label} must be an exact origin without a path, query, or fragment`;
    return null;
  } catch {
    return `${label} must be a valid URL`;
  }
}

export function decodeKeyMaterial(valueToDecode) {
  const raw = String(valueToDecode ?? '').trim();
  if (/^[a-f0-9]{64}$/i.test(raw)) return Buffer.from(raw, 'hex');
  if (/^[A-Za-z0-9+/]{43}=$/.test(raw) || /^[A-Za-z0-9_-]{43}$/.test(raw)) {
    const buffer = Buffer.from(raw, raw.includes('-') || raw.includes('_') ? 'base64url' : 'base64');
    if (buffer.length === 32) return buffer;
  }
  throw Object.assign(new Error('Key material must be exactly 32 bytes encoded as 64 hex characters, base64, or base64url'), {
    code: 'secret_key_material_invalid'
  });
}

export function inspectDeploymentEnvironment(environment = process.env) {
  const production = environment.NODE_ENV === 'production';
  const stage = value(environment, 'QELLY_DEPLOYMENT_ENVIRONMENT') || (production ? 'production' : 'development');
  const failures = [];
  if (!['development', 'test', 'preview', 'production'].includes(stage)) failures.push('QELLY_DEPLOYMENT_ENVIRONMENT must be development, test, preview, or production');
  if (production && !['preview', 'production'].includes(stage)) failures.push('NODE_ENV=production requires QELLY_DEPLOYMENT_ENVIRONMENT=preview or production');
  if (production) {
    for (const key of REQUIRED_PRODUCTION) if (placeholder(value(environment, key))) failures.push(`${key} is missing or contains a placeholder`);
    for (const [key, expected] of Object.entries(REQUIRED_MODES)) if (value(environment, key) !== expected) failures.push(`${key} must equal ${expected}`);
    for (const key of FORBIDDEN_OVERRIDES) if (value(environment, key) === 'true') failures.push(`${key}=true is forbidden in a strict deployment`);
    for (const key of SAFETY_FLAGS) if (value(environment, key) !== 'false') failures.push(`${key} must equal false`);

    for (const [key, label] of [['DATABASE_URL', 'DATABASE_URL'], ['QELLY_MIGRATION_DATABASE_URL', 'QELLY_MIGRATION_DATABASE_URL']]) {
      const failure = urlFailure(value(environment, key), { protocols: ['postgres:', 'postgresql:'], label, requireSslMode: true, requireCredentials: true, requireUsername: true });
      if (failure) failures.push(failure);
    }
    const redisFailure = urlFailure(value(environment, 'REDIS_URL'), { protocols: ['rediss:'], label: 'REDIS_URL', requireCredentials: true });
    if (redisFailure) failures.push(redisFailure);
    const s3Failure = urlFailure(value(environment, 'S3_ENDPOINT'), { protocols: ['https:'], label: 'S3_ENDPOINT' });
    if (s3Failure) failures.push(s3Failure);
    for (const key of ['QELLY_EMAIL_API_URL', 'QELLY_EMAIL_HEALTH_URL']) {
      const failure = urlFailure(value(environment, key), { protocols: ['https:'], label: key });
      if (failure) failures.push(failure);
    }
    if (value(environment, 'QELLY_SESSION_SECRET').length < 32) failures.push('QELLY_SESSION_SECRET must contain at least 32 characters');
    if (value(environment, 'QELLY_PASSWORD_PEPPER').length < 24) failures.push('QELLY_PASSWORD_PEPPER must contain at least 24 characters');
    if (value(environment, 'QELLY_WEBHOOK_SIGNING_SECRET').length < 32) failures.push('QELLY_WEBHOOK_SIGNING_SECRET must contain at least 32 characters');

    const origins = value(environment, 'QELLY_OUTBOUND_ALLOWED_ORIGINS').split(',').map((entry) => entry.trim()).filter(Boolean);
    if (!origins.length || origins.some((origin) => urlFailure(origin, { protocols: ['https:'], label: 'QELLY_OUTBOUND_ALLOWED_ORIGINS entry', requireOrigin: true }))) {
      failures.push('QELLY_OUTBOUND_ALLOWED_ORIGINS must contain only explicit HTTPS origins');
    }
    for (const key of ['QELLY_EMAIL_API_URL', 'QELLY_EMAIL_HEALTH_URL']) {
      try {
        if (!origins.includes(new URL(value(environment, key)).origin)) failures.push(`QELLY_OUTBOUND_ALLOWED_ORIGINS must include the ${key} origin`);
      } catch {}
    }
    if (!/^[a-zA-Z0-9._-]{3,120}$/.test(value(environment, 'QELLY_WORKER_ID'))) failures.push('QELLY_WORKER_ID must be a stable safe identifier');
    const webauthnOrigins = value(environment, 'QELLY_WEBAUTHN_ORIGINS').split(',').map((entry) => entry.trim()).filter(Boolean);
    if (!webauthnOrigins.length || webauthnOrigins.some((origin) => urlFailure(origin, { protocols: ['https:'], label: 'QELLY_WEBAUTHN_ORIGINS entry', requireOrigin: true }))) {
      failures.push('QELLY_WEBAUTHN_ORIGINS must contain only HTTPS origins');
    }
    const frontendOrigins = value(environment, 'QELLY_FRONTEND_ORIGINS').split(',').map((entry) => entry.trim().replace(/\/$/, '')).filter(Boolean);
    if (!frontendOrigins.length || frontendOrigins.some((origin) => urlFailure(origin, { protocols: ['https:'], label: 'QELLY_FRONTEND_ORIGINS entry', requireOrigin: true }))) {
      failures.push('QELLY_FRONTEND_ORIGINS must contain only explicit HTTPS origins');
    }
    for (const origin of frontendOrigins) if (!webauthnOrigins.map((entry) => entry.replace(/\/$/, '')).includes(origin)) failures.push(`QELLY_WEBAUTHN_ORIGINS must include frontend origin ${origin}`);
    try {
      const keys = JSON.parse(value(environment, 'QELLY_SECRET_KEYRING_JSON'));
      if (!keys || typeof keys !== 'object' || Array.isArray(keys) || !Object.keys(keys).length) throw new Error('keyring must be a non-empty object');
      const active = value(environment, 'QELLY_SECRET_ACTIVE_KEY_ID');
      if (!Object.hasOwn(keys, active)) failures.push('QELLY_SECRET_ACTIVE_KEY_ID must identify a key in QELLY_SECRET_KEYRING_JSON');
      for (const [keyId, material] of Object.entries(keys)) {
        if (!/^[a-zA-Z0-9._-]{3,64}$/.test(keyId)) failures.push(`Secret key ID ${keyId} is invalid`);
        try { decodeKeyMaterial(material); } catch (error) { failures.push(`Secret key ${keyId}: ${error.message}`); }
      }
    } catch (error) {
      if (!String(error.message).startsWith('Secret key')) failures.push('QELLY_SECRET_KEYRING_JSON must be valid JSON containing a non-empty key map');
    }
  } else {
    for (const key of SAFETY_FLAGS) if (value(environment, key) === 'true') failures.push(`${key}=true violates Qelly safety boundaries`);
  }
  return {
    ok: failures.length === 0,
    production,
    stage,
    failures: [...new Set(failures)],
    safety: Object.fromEntries(SAFETY_FLAGS.map((key) => [key, value(environment, key) || 'false']))
  };
}

export function validateDeploymentEnvironment(environment = process.env) {
  const result = inspectDeploymentEnvironment(environment);
  if (!result.ok) {
    throw Object.assign(new Error(`Deployment environment is invalid: ${result.failures.join('; ')}`), {
      code: 'deployment_environment_invalid',
      details: { stage: result.stage, failures: result.failures }
    });
  }
  return result;
}
