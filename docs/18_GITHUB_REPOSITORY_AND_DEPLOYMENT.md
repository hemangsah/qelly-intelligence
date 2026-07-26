# GitHub Repository and Deployment Guide

## Authoritative repository

- Repository: `https://github.com/hemangsah/qelly-intelligence`
- Default branch: `main`
- Release state: preview deployable

GitHub hosts the source repository, pull-request workflow, CI evidence, CodeQL analysis, release archives, and container images. GitHub Pages cannot run the Node.js backend and is not a full deployment target.

## Repository controls

Protect `main` and require the current workflows before merge:

- Continuous Integration
- Production Foundation Services
- Container Build
- CodeQL

Enable secret scanning, Dependabot alerts, private vulnerability reporting, and required pull-request review. Do not permit force pushes or branch deletion on `main`. The workflows use least-privilege permissions, immutable action commit pins, cancellation for superseded runs, locked npm installation, dependency review, secret scanning, current product validation, inventory validation, smoke tests, and bounded artifact retention.

## Tagged releases

Create a semver tag only after the current `package.json` version and release notes are approved. The tagged-release workflow reruns the current test/build/validation/smoke gates, creates an archive from tracked Git objects, writes its SHA-256 sidecar, and publishes both through GitHub Releases.

Do not create a compatibility tag based on the historical internal release label `27.0.0`; the user-facing product version is `0.9.0-preview.1`.

## Runtime deployment

The backend requires a persistent container host. Vercel is configured to publish only the static `dist/frontend` artifact. The API, worker, Redis consumer, streaming routes, migrations, backup/restore jobs, and ClamAV TCP integration remain on container or managed infrastructure and must not be forced into ephemeral request functions.

Before any public deployment:

- provision managed PostgreSQL, Redis, private S3-compatible storage, and a private ClamAV service;
- configure external transactional email and signed-webhook delivery;
- inject secrets through a managed secret store;
- run migrations in a protected one-time job before traffic is switched;
- verify `/api/health`, `/api/ready`, workers, backups, restore, rollback, monitoring, and alerting;
- validate provider licensing, attribution, caching, rate limits, and regional rules;
- retain live trading, transfer, withdrawal, custody, key, and recovery-phrase routes as disabled.

## Repository secrets

Ordinary CI and pull-request validation require no third-party production secrets. GitHub's scoped `GITHUB_TOKEN` is used only in jobs that publish a tagged release or GHCR image. Never commit `.env` files, provider credentials, user data, private keys, recovery phrases, database passwords, or production tokens.
