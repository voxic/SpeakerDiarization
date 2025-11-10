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
- Docker-based deployment

## Prerequisites

- Docker and Docker Compose
- HuggingFace account with access token (for pyannote.audio models)
- At least 4 CPU cores and 8GB RAM (recommended: 8 cores, 16GB RAM)

## Quick Start

1. **Clone and configure:**
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

3. **Build and start:**
   ```bash
   docker-compose build
   docker-compose up -d
   ```

4. **Access the application:**
   - Web UI: http://localhost:3000
   - MongoDB: mongodb://localhost:27017
   - Mongo Express (optional): http://localhost:8081

## Project Structure

```
speaker-diarization-system/
├── docker-compose.yml
├── .env
├── .env.example
├── README.md
├── mongo-init.js
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

- Check logs: `docker-compose logs -f worker`
- Verify HuggingFace token is set correctly
- Ensure sufficient disk space for audio files
- Check MongoDB connection: `docker-compose exec mongo mongosh speaker_db`

## License

See LICENSE file for details.

