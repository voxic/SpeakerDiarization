# Quick Start Guide

## System Setup

### Automated Setup (Recommended)

Run the setup script to install all system dependencies:

```bash
./setup.sh
```

This will install:
- Node.js and npm
- Python 3.11+ and pip
- Docker (for MongoDB)
- FFmpeg
- Build tools

### Manual Setup

**Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install -y python3.11 python3-pip python3-venv nodejs npm docker.io ffmpeg build-essential
sudo systemctl enable docker
sudo systemctl start docker
sudo usermod -aG docker $USER
# Log out and log back in for docker group changes
```

**macOS:**
```bash
brew install node python@3.11 docker ffmpeg
```

## Prerequisites

1. **System dependencies** installed (see System Setup above)
2. **HuggingFace Account** with access token

## Setup Steps

### 1. Get HuggingFace Token

1. Create account at https://huggingface.co
2. Go to Settings → Access Tokens
3. Create a new token
4. Accept model terms:
   - https://huggingface.co/pyannote/speaker-diarization-3.1
   - https://huggingface.co/pyannote/embedding

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` and add your HuggingFace token:
```
HUGGINGFACE_TOKEN=your_token_here
```

### 3. Start All Services

```bash
./start.sh
```

This will:
- Start MongoDB (in Docker)
- Build and start the Next.js application
- Start the Python worker

### 4. Access the Application

- **Web UI**: http://localhost:3001
- **MongoDB**: mongodb://localhost:27017

### 5. View Logs

```bash
# View Next.js logs
tail -f nextjs.log

# View worker logs
tail -f worker.log
```

## First Upload

1. Go to http://localhost:3001
2. Click "Upload Recording"
3. Upload an audio file with filename format: `YYYY-MM-DD_HH-MM-SS.ext`
   - Example: `2025-11-10_14-33-23.mp3`
4. Wait for processing to complete
5. View results in the recordings list

## Running Services Individually

You can run services in separate terminals for better log visibility:

```bash
# Terminal 1: MongoDB
./start-mongodb.sh

# Terminal 2: Next.js
./start-nextjs.sh

# Terminal 3: Python Worker
./start-worker.sh
```

## Troubleshooting

### Worker not processing jobs

Check worker logs:
```bash
tail -f worker.log
```

Common issues:
- Missing or invalid HuggingFace token
- Insufficient disk space
- Model download in progress (first run takes longer)

### Next.js not starting

Check Next.js logs:
```bash
tail -f nextjs.log
```

Common issues:
- Port 3001 already in use
- Missing dependencies: run `cd nextjs-app && npm install`
- Build required: run `cd nextjs-app && npm run build`

### MongoDB connection issues

Check if MongoDB is running:
```bash
docker ps | grep speaker-mongo
```

Start MongoDB:
```bash
./start-mongodb.sh
```

Verify connection:
```bash
docker exec -it speaker-mongo mongosh speaker_db
```

## Stopping Services

Stop all services:
```bash
./stop.sh
```

Stop individual services:
```bash
# Stop Next.js (if running in foreground, use Ctrl+C)
# Or kill the process: kill $(cat .nextjs.pid)

# Stop Worker (if running in foreground, use Ctrl+C)
# Or kill the process: kill $(cat .worker.pid)

# Stop MongoDB
docker stop speaker-mongo
```

## Development Mode

For development, you can run Next.js in dev mode:

```bash
cd nextjs-app
npm install
npm run dev
```

This will start Next.js in development mode with hot reloading on port 3000 (or the port specified in your environment).
