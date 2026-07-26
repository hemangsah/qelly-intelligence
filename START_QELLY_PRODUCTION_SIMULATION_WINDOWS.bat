@echo off
echo Starting PostgreSQL, Redis, migration, API and worker through Docker Compose...
docker compose up --build
pause
