# Release A1 Local and Production-Simulation Runbook

## Offline/local development
1. Install Node.js 22+.
2. Copy `.env.example` to `.env`.
3. Keep `NODE_ENV=development`, `QELLY_DATABASE_MODE=sqlite`, and `QELLY_JOB_QUEUE_MODE=database`.
4. Run `npm start`.
5. Open `http://127.0.0.1:4480`.

## Docker production simulation
1. Set strong `QELLY_SESSION_SECRET`, `QELLY_PASSWORD_PEPPER`, database and Redis credentials.
2. Run `docker compose up --build`.
3. The migration service must complete before API and worker become ready.
4. Verify `/api/health` and `/api/ready`.
5. Run registration, login, CSRF mutation, job and logout smoke tests.

## Seed
Run `npm run seed` with explicit seed-user environment values. Never commit seed passwords.

## Safety
Do not enable live trading, transfers, withdrawals or custody from this release.
