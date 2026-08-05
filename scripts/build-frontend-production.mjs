// Transactional SMTP has passed account-level configuration and is enabled for the production release build.
process.env.QELLY_ENABLE_AUTH_EMAIL_DELIVERY='true';
await import('./build-frontend.mjs');
