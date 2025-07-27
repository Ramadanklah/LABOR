@echo off
echo 🔧 Fixing Vite Client Issues...
echo.

echo Step 1: Stopping any running processes...
taskkill /f /im node.exe >nul 2>&1

echo Step 2: Cleaning up caches and dependencies...
cd client
if exist node_modules rmdir /s /q node_modules
if exist package-lock.json del package-lock.json
if exist .vite rmdir /s /q .vite
if exist dist rmdir /s /q dist

echo Step 3: Reinstalling dependencies...
npm install

echo Step 4: Starting Vite development server...
echo.
echo 🚀 Starting client on http://localhost:3000
echo Press Ctrl+C to stop the server
echo.

npm start