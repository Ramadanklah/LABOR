#!/bin/bash
# Production deployment script for Lab Results System

set -e  # Exit on any error

echo "🚀 Starting production deployment..."

# Check if required environment variables are set
if [ -z "$JWT_SECRET" ]; then
    echo "❌ Error: JWT_SECRET environment variable is required"
    exit 1
fi

if [ -z "$MIRTH_OUTBOUND_URL" ]; then
    echo "❌ Error: MIRTH_OUTBOUND_URL environment variable is required"
    exit 1
fi

if [ -z "$MIRTH_OUTBOUND_SECRET" ]; then
    echo "❌ Error: MIRTH_OUTBOUND_SECRET environment variable is required"
    exit 1
fi

echo "✅ Environment variables validated"

# Install dependencies
echo "📦 Installing dependencies..."
npm ci --production

# Start the application
echo "🎯 Starting application..."
npm start