#!/bin/bash

echo "🔧 Fixing Vite Client Issues..."
echo

echo "Step 1: Stopping any running Node processes..."
pkill -f "node.*vite" 2>/dev/null || true
pkill -f "npx vite" 2>/dev/null || true

echo "Step 2: Cleaning up caches and dependencies..."
cd client
rm -rf node_modules package-lock.json .vite dist 2>/dev/null || true

echo "Step 3: Reinstalling dependencies..."
npm install

echo "Step 4: Starting Vite development server..."
echo
echo "🚀 Starting client on http://localhost:3000"
echo "Press Ctrl+C to stop the server"
echo

npm start