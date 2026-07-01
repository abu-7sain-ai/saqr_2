@echo off
title Saqr Frontend Server — Port 3000
echo ============================================================
echo  SAQR FRONTEND — Starting React/Vite development server...
echo ============================================================
echo.

cd /d "%~dp0frontend"
npm run dev

echo.
echo Frontend stopped. Press any key to exit...
pause > nul
