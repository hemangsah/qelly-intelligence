@echo off
set NODE_ENV=development
set QELLY_PRODUCTION_FOUNDATION_ENABLED=true
set QELLY_PRODUCTION_IDENTITY_ENABLED=true
set QELLY_DEVELOPMENT_IDENTITY_ENABLED=true
set QELLY_DATABASE_MODE=sqlite
set QELLY_JOB_QUEUE_MODE=database
if "%QELLY_SESSION_SECRET%"=="" set QELLY_SESSION_SECRET=qelly-development-session-secret-change-before-production-2026
cd /d "%~dp0..\.."
node src\server\server.mjs
pause
