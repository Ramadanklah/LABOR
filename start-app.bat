@echo off
echo Starting Lab Results Application...
echo.

echo Stopping any existing Node processes...
taskkill /f /im node.exe >nul 2>&1

echo.
echo Starting Backend Server (Port 5000)...
cd /d "%~dp0server"
start "Backend Server" cmd /k "node server.js"

echo.
echo Waiting for backend to start...
timeout /t 3 /nobreak >nul

echo.
echo Starting Frontend Server (Port 3001)...
cd /d "%~dp0client"
start "Frontend Server" cmd /k "npm run dev"

echo.
echo Waiting for frontend to start...
timeout /t 5 /nobreak >nul

echo.
echo ========================================
echo   Lab Results Application Started!
echo ========================================
echo.
echo Backend:  http://localhost:5000
echo Frontend: http://localhost:3001
echo.
echo Login with:
echo   Email: admin@laborresults.de
echo   Password: admin123
echo.
echo Press any key to exit...
pause >nul