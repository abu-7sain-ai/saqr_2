@echo off
title Saqr Backend Server — Port 8000
echo ============================================================
echo  SAQR BACKEND — Starting FastAPI Engine on port 8000...
echo ============================================================
echo.

cd /d "%~dp0backend"

set PYTHONPATH=.

if exist "..\.venv\Scripts\uvicorn.exe" (
    ..\.venv\Scripts\uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload
) else if exist ".venv\Scripts\uvicorn.exe" (
    .venv\Scripts\uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload
) else (
    echo [ERROR] Virtual environment .venv not found!
    echo Please create virtual env in root or backend folder and run:
    echo python -m venv .venv
)

echo.
echo Backend stopped. Press any key to exit...
pause > nul
