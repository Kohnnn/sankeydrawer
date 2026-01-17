@echo off
echo Starting Financial Sankey Studio...
echo.
cd /d "%~dp0app"
echo Installing dependencies if needed...
call npm install
echo.
echo Starting development server...
call npm run dev
pause
