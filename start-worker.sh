#!/bin/bash

# Start Python worker for audio processing

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR/python-worker"

# Check if .env file exists
if [ ! -f "$SCRIPT_DIR/.env" ]; then
    echo "Error: .env file not found. Please copy .env.example to .env and configure it."
    exit 1
fi

# Load environment variables
set -a
source "$SCRIPT_DIR/.env"
set +a

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo "Creating Python virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment
source venv/bin/activate

# Install/upgrade dependencies
echo "Installing Python dependencies..."
pip install --upgrade pip
pip install -r requirements.txt

# Create storage directories if they don't exist
# Handle both relative and absolute paths
STORAGE_PATH=${STORAGE_PATH:-./storage}
if [[ "$STORAGE_PATH" != /* ]]; then
    # Relative path - make it relative to project root
    STORAGE_PATH="$SCRIPT_DIR/$STORAGE_PATH"
fi
mkdir -p "$STORAGE_PATH/recordings" "$STORAGE_PATH/segments" "$STORAGE_PATH/speakers"
export STORAGE_PATH

# Set thread limits if not set
export OMP_NUM_THREADS=${OMP_NUM_THREADS:-4}
export MKL_NUM_THREADS=${MKL_NUM_THREADS:-4}

echo "Starting Python worker..."
python worker.py

