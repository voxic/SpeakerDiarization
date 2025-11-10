# Quick Start Guide

## Prerequisites

1. **Docker and Docker Compose** installed
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

### 3. Build and Start

```bash
# Build all services
docker-compose build

# Start services
docker-compose up -d

# View logs
docker-compose logs -f
```

### 4. Access the Application

- **Web UI**: http://localhost:3000
- **MongoDB**: mongodb://localhost:27017
- **Mongo Express** (optional): http://localhost:8081

## First Upload

1. Go to http://localhost:3000
2. Click "Upload Recording"
3. Upload an audio file with filename format: `YYYY-MM-DD_HH-MM-SS.ext`
   - Example: `2025-11-10_14-33-23.mp3`
4. Wait for processing to complete
5. View results in the recordings list

## Troubleshooting

### Worker not processing jobs

Check worker logs:
```bash
docker-compose logs -f worker
```

Common issues:
- Missing or invalid HuggingFace token
- Insufficient disk space
- Model download in progress (first run takes longer)

### MongoDB connection issues

Check MongoDB logs:
```bash
docker-compose logs -f mongo
```

Verify connection:
```bash
docker-compose exec mongo mongosh speaker_db
```

### Next.js build errors

Rebuild the Next.js service:
```bash
docker-compose build nextjs
docker-compose up -d nextjs
```

## Stopping Services

```bash
docker-compose down
```

To also remove volumes (deletes all data):
```bash
docker-compose down -v
```

