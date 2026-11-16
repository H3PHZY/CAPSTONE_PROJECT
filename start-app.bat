@echo off
title Launch EcoLoop
cd /d "%~dp0"
echo ========================================================
echo        EcoLoop Platform Launcher
echo ========================================================
echo.
echo [1/2] Launching Django REST API on port 8000...
start "EcoLoop Backend (Django)" "%~dp0start-backend.bat"

echo [2/2] Launching Next.js Web App on port 3000...
start "EcoLoop Frontend (Next.js)" "%~dp0start-frontend.bat"

echo.
echo ========================================================
echo   Services are running!
echo   - Frontend:   http://localhost:3000
echo   - Backend:    http://127.0.0.1:8000/api/
echo   - Swagger UI: http://127.0.0.1:8000/api/docs/
echo ========================================================
echo.

