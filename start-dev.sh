#!/bin/bash

# Labor Results Web App - Development Startup Script
echo "🚀 Starting Labor Results Web App..."
echo ""

# Function to handle cleanup on exit
cleanup() {
    echo ""
    echo "🛑 Shutting down servers..."
    kill $BACKEND_PID $FRONTEND_PID 2>/dev/null
    exit 0
}

# Set up signal handlers
trap cleanup SIGINT SIGTERM

# Start backend server
echo "📡 Starting backend server on http://localhost:5000..."
cd server
npm start &
BACKEND_PID=$!
cd ..

# Wait a moment for backend to start
sleep 2

# Start frontend server
echo "🌐 Starting frontend server on http://localhost:3000..."
cd client
npm run dev &
FRONTEND_PID=$!
cd ..

echo ""
echo "✅ Both servers are starting up..."
echo "📡 Backend:  http://localhost:5000"
echo "🌐 Frontend: http://localhost:3000"
echo ""
echo "Demo credentials:"
echo "  BSNR: 123456789"
echo "  LANR: 1234567"
echo "  Password: securepassword"
echo ""
echo "Press Ctrl+C to stop both servers"
echo ""

# Wait for both processes
wait $BACKEND_PID $FRONTEND_PID