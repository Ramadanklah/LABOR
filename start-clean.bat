@echo off
echo ========================================
echo   Labor Results App - Clean Startup
echo ========================================
echo.

echo 🛑 Stopping all Node processes...
taskkill /f /im node.exe >nul 2>&1
timeout /t 2 /nobreak >nul

echo.
echo 🚀 Starting Backend Server (Port 5000)...
cd /d "%~dp0server"
start "Backend Server" cmd /k "node server.js"

echo.
echo ⏳ Waiting for backend to initialize...
timeout /t 4 /nobreak >nul

echo.
echo 🎨 Starting Frontend Server (Port 3001)...
cd /d "%~dp0client"
start "Frontend Server" cmd /k "npm run dev"

echo.
echo ⏳ Waiting for frontend to start...
timeout /t 6 /nobreak >nul

echo.
echo ========================================
echo   ✅ APPLICATION READY!
echo ========================================
echo.
echo 🌐 Frontend: http://localhost:3001
echo 🔧 Backend:  http://localhost:5000
echo 🧹 Clear Cache: http://localhost:3001/clear-storage.html
echo.
echo 🔑 Login Credentials:
echo    Email: admin@laborresults.de
echo    Password: admin123
echo.
echo ⚠️  IMPORTANT: Only use port 3001 (NOT 3002)
echo.
echo Press any key to exit...
pause >nul