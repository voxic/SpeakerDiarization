#!/bin/bash

# Master script to start all services

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}Starting Speaker Diarization System...${NC}"

# Check if .env exists
if [ ! -f ".env" ]; then
    echo -e "${YELLOW}Warning: .env file not found. Creating from .env.example...${NC}"
    if [ -f ".env.example" ]; then
        cp .env.example .env
        echo -e "${YELLOW}Please edit .env and add your HUGGINGFACE_TOKEN${NC}"
    else
        echo "Error: .env.example not found. Please create .env file manually."
        exit 1
    fi
fi

# Start MongoDB
echo -e "${GREEN}[1/3] Starting MongoDB...${NC}"
./start-mongodb.sh

# Wait a moment for MongoDB to be ready
sleep 3

# Start Next.js in background
echo -e "${GREEN}[2/3] Starting Next.js application...${NC}"
./start-nextjs.sh > nextjs.log 2>&1 &
NEXTJS_PID=$!
echo "Next.js PID: $NEXTJS_PID"

# Wait a moment for Next.js to start
sleep 5

# Start Python worker in background
echo -e "${GREEN}[3/3] Starting Python worker...${NC}"
./start-worker.sh > worker.log 2>&1 &
WORKER_PID=$!
echo "Worker PID: $WORKER_PID"

# Save PIDs to file for easy stopping
echo "$NEXTJS_PID" > .nextjs.pid
echo "$WORKER_PID" > .worker.pid

echo ""
echo -e "${GREEN}All services started!${NC}"
echo ""
echo "Services:"
echo "  - MongoDB: mongodb://localhost:27017"
echo "  - Next.js: http://localhost:3001"
echo "  - Worker: Running (PID: $WORKER_PID)"
echo ""
echo "Logs:"
echo "  - Next.js: tail -f nextjs.log"
echo "  - Worker: tail -f worker.log"
echo ""
echo "To stop all services: ./stop.sh"
echo "To stop individual services: kill <PID>"

