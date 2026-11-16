@echo off
title EcoLoop Backend (Django)
cd /d "%~dp0backend"
echo ====================================================
echo   EcoLoop Django REST API Server
echo ====================================================
echo API Root:    http://127.0.0.1:8000/api/
echo Swagger UI:  http://127.0.0.1:8000/api/docs/
echo Redoc UI:    http://127.0.0.1:8000/api/redoc/
echo Django Admin:http://127.0.0.1:8000/admin/
echo ====================================================
call .\venv\Scripts\activate.bat
python manage.py runserver 127.0.0.1:8000
pause

