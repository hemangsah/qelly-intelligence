@echo off
setlocal
cd /d "%~dp0"
set QELLY_LIVE_MARKET_ENABLED=true
if not exist .env copy /Y .env.example .env >nul
where node >nul 2>nul || (echo Node.js 22 or newer is required.& pause & exit /b 1)
echo Starting Qelly Intelligence Part 22 at http://127.0.0.1:4480
node --env-file=.env src\server\server.mjs
pause
