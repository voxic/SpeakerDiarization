#!/bin/bash

# Start MongoDB using Docker (simplest approach)
# Alternatively, you can install MongoDB natively and run: mongod --dbpath /path/to/data

set -e

echo "Starting MongoDB..."

# Check if MongoDB container is already running
if docker ps | grep -q "speaker-mongo"; then
    echo "MongoDB container is already running"
    exit 0
fi

# Check if MongoDB container exists but is stopped
if docker ps -a | grep -q "speaker-mongo"; then
    echo "Starting existing MongoDB container..."
    docker start speaker-mongo
else
    echo "Creating and starting MongoDB container..."
    docker run -d \
        --name speaker-mongo \
        -p 27017:27017 \
        -v speaker-mongo-data:/data/db \
        -e MONGO_INITDB_DATABASE=speaker_db \
        --restart unless-stopped \
        mongo:7
    
    # Wait a moment for MongoDB to start
    sleep 2
    
    # Initialize database if mongo-init.js exists
    if [ -f "mongo-init.js" ]; then
        echo "Initializing database..."
        docker cp mongo-init.js speaker-mongo:/docker-entrypoint-initdb.d/init.js
        # Note: init script only runs on first container creation
    fi
fi

echo "MongoDB is running on mongodb://localhost:27017"
echo "To stop: docker stop speaker-mongo"
echo "To remove: docker stop speaker-mongo && docker rm speaker-mongo"

