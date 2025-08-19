@echo off
echo ========================================
echo Lab Results Application Setup and Fix
echo ========================================
echo.

echo 1. Checking Node.js installation...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Node.js is not installed or not in PATH
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)
echo    Node.js is installed

echo.
echo 2. Installing server dependencies...
cd server
if not exist node_modules (
    echo    Installing npm packages...
    npm install
    if %errorlevel% neq 0 (
        echo ERROR: Failed to install server dependencies
        pause
        exit /b 1
    )
) else (
    echo    Dependencies already installed
)

echo.
echo 3. Installing client dependencies...
cd ..\client
if not exist node_modules (
    echo    Installing npm packages...
    npm install
    if %errorlevel% neq 0 (
        echo ERROR: Failed to install client dependencies
        pause
        exit /b 1
    )
) else (
    echo    Dependencies already installed
)

echo.
echo 4. Building client application...
npm run build
if %errorlevel% neq 0 (
    echo ERROR: Failed to build client application
    pause
    exit /b 1
)

cd ..

echo.
echo 5. Testing server configuration...
node test-server-config.js

echo.
echo 6. Importing LDT files...
node import-ldt-files.js

echo.
echo ========================================
echo Setup completed!
echo ========================================
echo.
echo Next steps:
echo 1. Configure email settings in server\.env if needed
echo 2. Start the server: cd server && npm start
echo 3. Start the client: cd client && npm run dev
echo 4. Visit http://localhost:3002 to use the application
echo.
echo Default login credentials:
echo   Admin: admin@laborresults.de / admin123
echo   Doctor: doctor@laborresults.de / doctor123
echo   Lab Tech: lab@laborresults.de / lab123
echo.
pause