#!/bin/bash

# Start Next.js application

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR/nextjs-app"

# Check if .env file exists
if [ ! -f "$SCRIPT_DIR/.env" ]; then
    echo "Error: .env file not found. Please copy .env.example to .env and configure it."
    exit 1
fi

# Load environment variables from parent directory
set -a
source "$SCRIPT_DIR/.env"
set +a

# Set PORT if not set
export PORT=${PORT:-3001}

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
fi

# Check if .next build exists
if [ ! -d ".next" ]; then
    echo "Building Next.js application..."
    npm run build
fi

# Create storage directories if they don't exist
# Handle both relative and absolute paths
STORAGE_PATH=${STORAGE_PATH:-./storage}
if [[ "$STORAGE_PATH" != /* ]]; then
    # Relative path - make it relative to project root
    STORAGE_PATH="$SCRIPT_DIR/$STORAGE_PATH"
fi
mkdir -p "$STORAGE_PATH/recordings" "$STORAGE_PATH/segments" "$STORAGE_PATH/speakers"
export STORAGE_PATH

echo "Starting Next.js application on port $PORT..."
echo "Storage path: $STORAGE_PATH"

# For standalone mode, we need to run from .next/standalone if it exists
if [ -d ".next/standalone" ]; then
    cd .next/standalone
    PORT=$PORT node server.js
else
    npm start
fi

