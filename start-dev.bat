@echo off
echo Starting Labor Results Web App...
echo.

echo Checking if port 5000 is available...
netstat -ano | findstr :5000 >nul
if %errorlevel% equ 0 (
    echo.
    echo WARNING: Port 5000 is already in use!
    echo The server will automatically try ports 5001, 5002, etc.
    echo Or you can manually kill the process using port 5000.
    echo.
    echo Run scripts\check-port.bat to manage port conflicts.
    echo.
    pause
)

echo Starting backend server...
cd server
start "Backend Server" cmd /k "npm start"
cd ..

echo Waiting for backend to start...
timeout /t 3 /nobreak >nul

echo Starting frontend server on http://localhost:3000...
cd client  
start "Frontend Server" cmd /k "npm start"
cd ..

echo.
echo Both servers are starting up...
echo Backend:  http://localhost:5000
echo Frontend: http://localhost:3000
echo.
echo Demo credentials:
echo   BSNR: 123456789
echo   LANR: 1234567
echo   Password: dev-only (set via seed.js)
echo.
echo Close the terminal windows to stop the servers
pause