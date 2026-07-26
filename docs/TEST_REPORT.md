# Qelly Test Report

- Command: `npm test`
- Result: 264 passed, 0 failed, 0 skipped.
- Full product check: typecheck, lint, environment validation, secret scan, tests, cold builds, and product validation passed.
- Smoke: 260 requests passed, including static runtime configuration, public market evidence, and Decision Provenance create/replay/read/traverse/export.
- Limit: target-host PostgreSQL, Redis, S3, ClamAV, email and webhook services were not available in this workspace.
