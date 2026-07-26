# Release A5 Runbook

1. Copy `.env.example` and configure local-safe values.
2. Run `npm test`, `npm run smoke`, `npm run validate`.
3. Start with `npm start`.
4. For staging, review `deploy/staging/manifest.json` and `deploy/staging/docker-compose.staging.yml`.
5. Never enable live trading, transfers, withdrawals, private keys, or recovery phrases.
