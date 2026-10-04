@echo off
cd /d "%~dp0..\.."
echo Starting PostgreSQL, Redis, migration, API and worker through Docker Compose...
docker compose up --build
pause
