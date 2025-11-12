# Speaker Diarization & Transcription System

A self-hosted speaker diarization and transcription system that processes multi-speaker audio recordings, separates speakers, identifies them against known voice profiles, and transcribes speech.

## Features

- Multi-speaker audio file upload and processing
- Real-time progress tracking
- Speaker diarization and identification
- Speech-to-text transcription with timestamps
- Web UI for playback and speaker tagging
- Automatic timestamp extraction from filenames (format: `YYYY-MM-DD_HH-MM-SS.ext`)
- Audio segment playback by speaker
- Simple script-based deployment

## Prerequisites

- **Node.js 20+** and npm
- **Python 3.11+** with pip
- **Docker** (for MongoDB - can also install MongoDB natively)
- **FFmpeg 4.x** (for audio processing)
- **HuggingFace account** with access token (for pyannote.audio models)
- **At least 4 CPU cores and 8GB RAM** (recommended: 8 cores, 16GB RAM)

### System Dependencies

Run the setup script to install system dependencies:

```bash
./setup.sh
```

Or install manually:

**Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install -y python3.11 python3-pip python3-venv nodejs npm docker.io ffmpeg build-essential
```

**macOS:**
```bash
brew install node python@3.11 docker ffmpeg
```

**Note:** MongoDB runs in Docker by default. To install MongoDB natively instead, see the MongoDB documentation.

## Quick Start

1. **Configure environment:**
   ```bash
   cp .env.example .env
   # Edit .env and add your HUGGINGFACE_TOKEN
   ```

2. **Get HuggingFace Token:**
   - Create account at https://huggingface.co
   - Go to Settings → Access Tokens
   - Create a new token
   - Accept model terms:
     - https://huggingface.co/pyannote/speaker-diarization-3.1
     - https://huggingface.co/pyannote/embedding
   - Add token to `.env` file

3. **Start all services:**
   ```bash
   ./start.sh
   ```

   This will:
   - Start MongoDB (in Docker)
   - Build and start the Next.js application
   - Start the Python worker

4. **Access the application:**
   - Web UI: http://localhost:3001
   - MongoDB: mongodb://localhost:27017

5. **Stop all services:**
   ```bash
   ./stop.sh
   ```

### Running Services Individually

You can also run services individually:

```bash
# Start MongoDB only
./start-mongodb.sh

# Start Next.js only (in a separate terminal)
./start-nextjs.sh

# Start Python worker only (in a separate terminal)
./start-worker.sh
```

## Project Structure

```
speaker-diarization-system/
├── .env                 # Environment configuration
├── .env.example         # Environment template
├── start.sh             # Start all services
├── stop.sh              # Stop all services
├── start-mongodb.sh     # Start MongoDB
├── start-nextjs.sh      # Start Next.js app
├── start-worker.sh      # Start Python worker
├── setup.sh             # Install system dependencies
├── README.md
├── mongo-init.js        # MongoDB initialization
├── nextjs-app/          # Next.js frontend/backend
└── python-worker/       # Audio processing worker
```

## Usage

1. **Upload audio files:**
   - Use filename format: `YYYY-MM-DD_HH-MM-SS.ext` (e.g., `2025-11-10_14-33-23.mp3`)
   - Upload via web UI or API

2. **Monitor processing:**
   - View real-time progress in the dashboard
   - Processing time: ~50-75 seconds per minute of audio (base model)

3. **Review results:**
   - View transcriptions with speaker labels
   - Tag unknown speakers
   - Play individual segments

## API Documentation

See the design document for complete API specifications.

## Performance

- **Processing Speed:** ~50-75 seconds per minute of audio (base Whisper model)
- **CPU Requirements:** 4+ cores recommended
- **Memory:** 8GB+ recommended per worker

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

### General

- Verify HuggingFace token is set correctly in `.env`
- Ensure sufficient disk space for audio files
- Check that all required ports are available (3001, 27017)

## License

See LICENSE file for details.

