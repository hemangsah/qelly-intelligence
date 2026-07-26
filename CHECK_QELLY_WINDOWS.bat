@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul || (echo Node.js 22 or newer is required.& pause & exit /b 1)
call npm.cmd test || exit /b 1
call npm.cmd run validate || exit /b 1
call npm.cmd run smoke || exit /b 1
call npm.cmd run inventory || exit /b 1
call npm.cmd run release:check || exit /b 1
echo All Qelly Part 21 checks passed.
pause
