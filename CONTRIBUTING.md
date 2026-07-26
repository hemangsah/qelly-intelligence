# Contributing to Qelly Intelligence

## Local workflow

Use Node.js 22 or later.

```bash
npm install --ignore-scripts
npm test
npm run validate
npm run smoke
npm run release:check
npm start
```

## Engineering requirements

- Preserve canonical QI identifiers and explicit source/freshness metadata.
- Keep unavailable data unavailable; do not replace it with zero.
- Enforce tenant, user, workspace, CSRF, authorization, schema, idempotency, and audit boundaries for mutations.
- Add tests and update contracts, schemas, route inventories, traceability, and documentation with every capability.
- Do not introduce live trading, transfers, withdrawals, custody, private keys, recovery phrases, licensed-data claims, or production identity claims without an independently validated implementation.
- Keep the application dependency-light unless a dependency has a documented operational and security justification.

## Branches and pull requests

Use a short-lived feature branch. Pull requests should contain a capability summary, truth boundaries, tests, screenshots when UI changes, migration impact, and rollback steps.
