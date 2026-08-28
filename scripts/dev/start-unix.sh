#!/usr/bin/env sh
set -eu
ROOT="$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)"
cd "$ROOT"
export NODE_ENV="${NODE_ENV:-development}"
export QELLY_PRODUCTION_FOUNDATION_ENABLED="${QELLY_PRODUCTION_FOUNDATION_ENABLED:-true}"
export QELLY_PRODUCTION_IDENTITY_ENABLED="${QELLY_PRODUCTION_IDENTITY_ENABLED:-true}"
export QELLY_DEVELOPMENT_IDENTITY_ENABLED="${QELLY_DEVELOPMENT_IDENTITY_ENABLED:-true}"
export QELLY_DATABASE_MODE="${QELLY_DATABASE_MODE:-sqlite}"
export QELLY_JOB_QUEUE_MODE="${QELLY_JOB_QUEUE_MODE:-database}"
export QELLY_SESSION_SECRET="${QELLY_SESSION_SECRET:-qelly-development-session-secret-change-before-production-2026}"
exec node src/server/server.mjs
