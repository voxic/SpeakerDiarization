#!/bin/bash

# Stop all services

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}Stopping Speaker Diarization System...${NC}"

# Stop Next.js if PID file exists
if [ -f ".nextjs.pid" ]; then
    PID=$(cat .nextjs.pid)
    if ps -p $PID > /dev/null 2>&1; then
        echo "Stopping Next.js (PID: $PID)..."
        kill $PID
        rm .nextjs.pid
    else
        echo -e "${YELLOW}Next.js process not found${NC}"
        rm .nextjs.pid
    fi
fi

# Stop Worker if PID file exists
if [ -f ".worker.pid" ]; then
    PID=$(cat .worker.pid)
    if ps -p $PID > /dev/null 2>&1; then
        echo "Stopping Python worker (PID: $PID)..."
        kill $PID
        rm .worker.pid
    else
        echo -e "${YELLOW}Worker process not found${NC}"
        rm .worker.pid
    fi
fi

# Stop MongoDB container
if docker ps | grep -q "speaker-mongo"; then
    echo "Stopping MongoDB container..."
    docker stop speaker-mongo
else
    echo -e "${YELLOW}MongoDB container not running${NC}"
fi

echo -e "${GREEN}All services stopped${NC}"

