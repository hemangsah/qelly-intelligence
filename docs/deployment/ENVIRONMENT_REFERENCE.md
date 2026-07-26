# Production Environment Reference

Never commit values. Store them in the deployment platform's encrypted secret manager.

## Required production modes

- `NODE_ENV=production`
- `QELLY_DATABASE_MODE=postgres`
- `QELLY_JOB_QUEUE_MODE=redis`
- `QELLY_OBJECT_STORAGE_MODE=s3`
- `QELLY_MALWARE_SCANNER_MODE=clamav`
- `QELLY_DELIVERY_MODE=external`
- `QELLY_STRICT_PRODUCTION_DEPENDENCIES=true`

## Required secrets and endpoints

- `DATABASE_URL`
- `REDIS_URL`
- `QELLY_SESSION_SECRET`
- `QELLY_PASSWORD_PEPPER`
- `QELLY_SECRET_KEYRING_JSON`
- `QELLY_SECRET_ACTIVE_KEY_ID`
- `S3_ENDPOINT`, `S3_BUCKET`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`
- `CLAMAV_HOST`, `CLAMAV_PORT`
- `QELLY_EMAIL_API_URL`, `QELLY_EMAIL_API_TOKEN`
- `QELLY_WEBHOOK_SIGNING_SECRET`
- `QELLY_OUTBOUND_ALLOWED_ORIGINS`
- `QELLY_WEBAUTHN_RP_ID`, `QELLY_WEBAUTHN_ORIGINS`

## Forbidden production overrides

The environment validator rejects production configurations that explicitly permit SQLite, the database queue, local object storage, the foundation scanner, local delivery, private outbound networks, or insecure HTTP delivery.
