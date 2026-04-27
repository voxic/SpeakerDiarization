# Speaker Diarization & Transcription System

A cloud-powered speaker diarization and transcription system that processes multi-speaker audio recordings, separates speakers, and transcribes speech using ElevenLabs Speech-to-Text API.

## Features

- Multi-speaker audio file upload and processing
- Real-time progress tracking
- Speaker diarization and identification (via ElevenLabs)
- Speech-to-text transcription with timestamps (via ElevenLabs)
- Web UI for playback and speaker tagging
- Automatic timestamp extraction from filenames (format: `YYYY-MM-DD_HH-MM-SS.ext`)
- Audio segment playback by speaker
- Docker-based deployment

## Ubuntu 24.04 VM Preparation

If you're setting up on a fresh Ubuntu 24.04 VM, follow these steps:

### 1. Update System Packages

```bash
sudo apt update
sudo apt upgrade -y
```

### 2. Install Docker Engine

```bash
# Install prerequisites
sudo apt install -y ca-certificates curl

# Add Docker's official GPG key
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

# Add Docker repository
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Install Docker Engine
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
```

### 3. Install Docker Compose (standalone)

If you need the standalone Docker Compose (in addition to the plugin):

```bash
# Download latest Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

### 4. Add User to Docker Group

```bash
# Add your user to the docker group
sudo usermod -aG docker $USER

# Log out and log back in for group changes to take effect
# Or use: newgrp docker
```

### 5. Verify Installation

```bash
# Verify Docker is running
sudo systemctl status docker

# Enable Docker to start on boot
sudo systemctl enable docker

# Test Docker installation
docker --version
docker compose version
```

### 6. Configure Firewall (if enabled)

If UFW is enabled, allow necessary ports:

```bash
sudo ufw allow 3001/tcp  # Next.js web UI
sudo ufw allow 27017/tcp # MongoDB (if accessing externally)
sudo ufw allow 8081/tcp  # Mongo Express (if accessing externally)
```

### 7. Install Git (if not already installed)

```bash
sudo apt install -y git
```

## Prerequisites

- Docker and Docker Compose (see Ubuntu 24.04 VM Preparation above)
- ElevenLabs account with API key (for Speech-to-Text API)
- At least 2 CPU cores and 2GB RAM (reduced requirements since processing is done in the cloud)

## Quick Start

1. **Clone and configure:**
   ```bash
   cp .env.example .env
   # Edit .env and add your ELEVENLABS_API_KEY
   # Optionally set ELEVENLABS_LANGUAGE to lock transcription to a specific language
   # Examples: "eng" (English), "es" (Spanish), "fr" (French), "de" (German), etc.
   # Leave unset for auto-detection (default)
   ```

2. **Get ElevenLabs API Key:**
   - Create account at https://elevenlabs.io
   - Go to Settings → API Keys
   - Create a new API key
   - Add the key to your `.env` file as `ELEVENLABS_API_KEY`

3. **Build and start:**
   ```bash
   docker-compose build
   docker-compose up -d
   ```

4. **Access the application:**
   - Web UI: http://localhost:3001
   - MongoDB: mongodb://localhost:27017

## Project Structure

```
speaker-diarization-system/
├── docker-compose.yml
├── .env
├── .env.example
├── README.md
├── mongo-init.js
├── nextjs-app/          # Next.js frontend/backend
└── python-worker/       # Audio processing worker (uses ElevenLabs API)
```

## Usage

1. **Upload audio files:**
   - Use filename format: `YYYY-MM-DD_HH-MM-SS.ext` (e.g., `2025-11-10_14-33-23.mp3`)
   - Upload via web UI or API
   - Supported formats: MP3, WAV, M4A, FLAC, OGG

2. **Monitor processing:**
   - View real-time progress in the dashboard
   - Processing time depends on ElevenLabs API response time (typically faster than local processing)

3. **Review results:**
   - View transcriptions with speaker labels
   - Tag unknown speakers
   - Play individual segments

## API Documentation

See the design document for complete API specifications.

## Performance

- **Processing Speed:** Depends on ElevenLabs API (typically faster than local processing)
- **CPU Requirements:** Minimal (2+ cores) since processing is done in the cloud
- **Memory:** 2GB+ recommended (reduced from 8GB since no local models are loaded)
- **Network:** Requires internet connection for API calls

## Configuration

### Language Locking

By default, ElevenLabs auto-detects the language in your audio. To lock transcription to a specific language, set the `ELEVENLABS_LANGUAGE` environment variable:

```bash
# In your .env file or docker-compose.yml
ELEVENLABS_LANGUAGE=eng  # English
ELEVENLABS_LANGUAGE=es   # Spanish
ELEVENLABS_LANGUAGE=fr   # French
ELEVENLABS_LANGUAGE=de   # German
# ... etc (see ElevenLabs supported languages)
```

**Common language codes:**
- `eng` - English
- `es` - Spanish
- `fr` - French
- `de` - German
- `it` - Italian
- `pt` - Portuguese
- `ru` - Russian
- `ja` - Japanese
- `zh` - Chinese
- `ar` - Arabic

If `ELEVENLABS_LANGUAGE` is not set, ElevenLabs will auto-detect the language (default behavior).

**Note:** The system also accepts common language codes like `en`, `es`, etc., which are automatically converted to ElevenLabs format (`en` → `eng`).

## Troubleshooting

- Check logs: `docker-compose logs -f worker`
- Verify ElevenLabs API key is set correctly in `.env`
- Ensure sufficient disk space for audio files
- Check MongoDB connection: `docker-compose exec mongo mongosh speaker_db`
- Verify internet connectivity (required for ElevenLabs API calls)
- Check ElevenLabs API quota/limits if processing fails

## Migration from Local Processing

If you were previously using local Whisper and pyannote.audio models:

- The system now uses ElevenLabs Speech-to-Text API for both diarization and transcription
- No need for HuggingFace tokens or local model downloads
- Reduced resource requirements (2GB RAM vs 8GB+)
- Faster processing times (cloud-based)
- Requires internet connection and ElevenLabs API key

## License

See LICENSE file for details.
