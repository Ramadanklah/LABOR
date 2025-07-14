@echo off
echo Starting Labor Results Web App...
echo.

echo Starting backend server on http://localhost:5000...
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
echo   Password: securepassword
echo.
echo Close the terminal windows to stop the servers
pause